import {
  buildSynthesizeRequests,
  decodeAudioContent,
  GEMINI_TTS_MODEL,
  type Logger,
  type ResolvedTtsOptions,
  type TtsOutputResult,
  type TtsRunResult,
  utf8ByteLength,
} from "./tts.ts";
import { writeSequencedOutput } from "./output.ts";
import { buildDemoSubmitCode } from "./demo_page_script.ts";

const CLOUD_TTS_PAGE = "https://cloud.google.com/text-to-speech";
const DEMO_PAGE =
  "https://www.gstatic.com/cloud-site-ux/text_to_speech/text_to_speech.min.html";
const SYNTHESIZE_URL =
  "https://texttospeech.googleapis.com/v1beta1/text:synthesize";
const PLAYWRIGHT_CLI_COMMAND = "playwright-cli";
const PLAYWRIGHT_BROWSER = "chrome";
const PROXY_TIMEOUT_MS = 300_000;
const SYNTHESIS_ATTEMPTS = 6;
const RETRY_DELAY_MS = 120_000;

const textDecoder = new TextDecoder();

export function randomInterCallDelayMs(random = Math.random): number {
  return Math.min(10_000, Math.floor(5_000 + random() * 5_001));
}

export async function synthesizeWithBrowser(
  options: ResolvedTtsOptions,
  log: Logger = () => {},
): Promise<TtsRunResult> {
  const allRequests = buildSynthesizeRequests(options);
  const requestOffset = options.turns.length > 0 ? 0 : options.startAt - 1;
  const requests = allRequests.slice(requestOffset);
  const outputs: TtsOutputResult[] = [];
  const sessionName = createSessionName();
  let opened = false;

  try {
    await openCliSession(sessionName, log);
    opened = true;

    for (const [index, request] of requests.entries()) {
      const originalIndex = requestOffset + index + 1;
      const requestLabel = `${originalIndex}/${allRequests.length}`;
      if (requests.length > 1) {
        const text = options.turns.length === 0
          ? options.texts[originalIndex - 1]
          : "";
        const textBytes = text ? utf8ByteLength(text) : 0;
        const promptBytes = options.prompt ? utf8ByteLength(options.prompt) : 0;
        log(
          `Preparing synthesis request ${requestLabel} (${textBytes} text bytes, ${promptBytes} prompt bytes, voice ${
            voiceLabel(options)
          }, language ${options.language}).`,
        );
      }

      const response = await submitWithRetries(
        sessionName,
        request,
        log,
        requestLabel,
      );
      const audio = decodeAudioContent(response.audioContent);
      const output = await writeSequencedOutput(
        options.out,
        options.encoding,
        audio,
      );

      outputs.push({
        out: output.path,
        bytes: audio.byteLength,
        index: originalIndex,
      });

      if (index < requests.length - 1) {
        const delay = randomInterCallDelayMs();
        log(
          `Waiting ${
            (delay / 1000).toFixed(1)
          }s before the next synthesis request.`,
        );
        await sleep(delay);
      }
    }

    return {
      ok: true,
      command: "tts",
      modelName: GEMINI_TTS_MODEL,
      outputs,
      voice: options.speakers.length === 0 ? options.voice : undefined,
      language: options.language,
      encoding: options.encoding,
      profiles: options.profiles,
      speakers: options.speakers,
      turns: options.turns.length,
    };
  } finally {
    if (opened) await closeCliSession(sessionName, log);
  }
}

async function openCliSession(
  sessionName: string,
  log: Logger,
): Promise<void> {
  log(`Opening ${CLOUD_TTS_PAGE} in headed Google Chrome via playwright-cli.`);
  await runPlaywrightCli([
    `-s=${sessionName}`,
    "open",
    CLOUD_TTS_PAGE,
    "--browser",
    PLAYWRIGHT_BROWSER,
    "--headed",
  ], "playwright-cli open");
}

async function closeCliSession(
  sessionName: string,
  log: Logger,
): Promise<void> {
  const result = await runPlaywrightCli(
    [
      `-s=${sessionName}`,
      "close",
    ],
    "playwright-cli close",
    { allowFailure: true },
  );
  if (result.code !== 0) {
    log("playwright-cli close failed; the browser session may still be open.");
  }
}

async function submitWithRetries(
  sessionName: string,
  request: unknown,
  log: Logger,
  requestLabel: string,
): Promise<AudioSynthesizeResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SYNTHESIS_ATTEMPTS; attempt += 1) {
    try {
      if (attempt > 1) {
        log(
          `Retrying synthesis request ${requestLabel} (attempt ${attempt}/${SYNTHESIS_ATTEMPTS}).`,
        );
      }
      const response = await submitWithCaptchaIfNeeded(
        sessionName,
        request,
        log,
      );
      assertAudioResponse(response);
      return response;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= SYNTHESIS_ATTEMPTS || !isRetryableError(message)) {
        throw new Error(`Synthesis request ${requestLabel} failed: ${message}`);
      }
      log(
        `Synthesis request ${requestLabel} failed: ${message}. Waiting ${
          (RETRY_DELAY_MS / 1000).toFixed(0)
        }s before retry.`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  const message = lastError instanceof Error
    ? lastError.message
    : String(lastError);
  throw new Error(`Synthesis request ${requestLabel} failed: ${message}`);
}

async function submitWithCaptchaIfNeeded(
  sessionName: string,
  request: unknown,
  log: Logger,
): Promise<SynthesizeResponse> {
  log(
    "Submitting synthesis request through the demo proxy. If CAPTCHA appears, solve it in the visible Chrome window.",
  );
  const response = await runPlaywrightCode<SynthesizeResponse>(
    sessionName,
    buildDemoSubmitCode(request, {
      cloudTtsPage: CLOUD_TTS_PAGE,
      demoPage: DEMO_PAGE,
      synthesizeUrl: SYNTHESIZE_URL,
      proxyTimeoutMs: PROXY_TIMEOUT_MS,
    }),
  );
  const upstreamError = responseErrorMessage(response);
  if (upstreamError) throw new Error(upstreamError);
  return response;
}

async function runPlaywrightCode<T>(
  sessionName: string,
  code: string,
): Promise<T> {
  const result = await runPlaywrightCli([
    `-s=${sessionName}`,
    "run-code",
    code,
  ], "playwright-cli run-code");
  return extractCliResult<T>(result.stdout);
}

type PlaywrightCliRunOptions = {
  allowFailure?: boolean;
};

type PlaywrightCliRunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type PlaywrightCliInvocation = {
  command: string;
  argsPrefix: string[];
};

let cachedPlaywrightCliInvocation: PlaywrightCliInvocation | undefined;

async function runPlaywrightCli(
  args: string[],
  label: string,
  options: PlaywrightCliRunOptions = {},
): Promise<PlaywrightCliRunResult> {
  const invocation = await playwrightCliInvocation();
  let output: Deno.CommandOutput;
  try {
    output = await new Deno.Command(invocation.command, {
      args: [...invocation.argsPrefix, ...args],
      stdout: "piped",
      stderr: "piped",
    }).output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        "playwright-cli was not found on PATH. Install it with: npm install -g @playwright/cli. Then run: playwright-cli install-browser --browser chrome",
      );
    }
    throw error;
  }

  const stdout = textDecoder.decode(output.stdout);
  const stderr = textDecoder.decode(output.stderr);
  const result = { code: output.code, stdout, stderr };
  if (output.success || options.allowFailure) return result;

  throw new Error(formatCliFailure(label, result));
}

async function playwrightCliInvocation(): Promise<PlaywrightCliInvocation> {
  if (cachedPlaywrightCliInvocation) return cachedPlaywrightCliInvocation;

  const override = Deno.env.get("GEMGEN_PLAYWRIGHT_CLI")?.trim();
  if (override) {
    cachedPlaywrightCliInvocation = { command: override, argsPrefix: [] };
    return cachedPlaywrightCliInvocation;
  }

  if (Deno.build.os === "windows") {
    const windowsInvocation = await findWindowsPlaywrightCliInvocation();
    if (windowsInvocation) {
      cachedPlaywrightCliInvocation = windowsInvocation;
      return windowsInvocation;
    }
  }

  cachedPlaywrightCliInvocation = {
    command: PLAYWRIGHT_CLI_COMMAND,
    argsPrefix: [],
  };
  return cachedPlaywrightCliInvocation;
}

async function findWindowsPlaywrightCliInvocation(): Promise<
  PlaywrightCliInvocation | undefined
> {
  const path = Deno.env.get("PATH") ?? "";
  for (const rawDirectory of path.split(";")) {
    const directory = rawDirectory.trim().replace(/^"|"$/g, "");
    if (!directory) continue;
    const hasShim =
      await fileExists(joinPath(directory, "playwright-cli.cmd")) ||
      await fileExists(joinPath(directory, "playwright-cli.ps1")) ||
      await fileExists(joinPath(directory, "playwright-cli"));
    if (!hasShim) continue;

    const cliJs = joinPath(
      directory,
      "node_modules",
      "@playwright",
      "cli",
      "playwright-cli.js",
    );
    if (!await fileExists(cliJs)) continue;

    const localNode = joinPath(directory, "node.exe");
    return {
      command: await fileExists(localNode) ? localNode : "node",
      argsPrefix: [cliJs],
    };
  }
  return undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch {
    return false;
  }
}

function joinPath(...parts: string[]): string {
  const separator = Deno.build.os === "windows" ? "\\" : "/";
  return parts
    .map((part, index) =>
      index === 0 ? part.replace(/[\\/]$/g, "") : part.replace(/^[\\/]/g, "")
    )
    .filter(Boolean)
    .join(separator);
}

function formatCliFailure(
  label: string,
  result: PlaywrightCliRunResult,
): string {
  const details = [result.stderr.trim(), result.stdout.trim()].filter(Boolean)
    .join("\n");
  return `${label} failed with exit code ${result.code}${
    details ? `:\n${details}` : "."
  }`;
}

function extractCliResult<T>(stdout: string): T {
  const marker = "### Result";
  const start = stdout.indexOf(marker);
  if (start < 0) {
    throw new Error(
      `playwright-cli did not return a result block. Output: ${
        truncate(stdout.trim())
      }`,
    );
  }

  const afterMarker = stdout.slice(start + marker.length).replace(
    /^\r?\n/,
    "",
  );
  const nextSection = afterMarker.search(/\r?\n### /);
  const json =
    (nextSection >= 0 ? afterMarker.slice(0, nextSection) : afterMarker).trim();

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not parse playwright-cli result JSON: ${message}. Result: ${
        truncate(json)
      }`,
    );
  }
}

type SynthesizeResponse = {
  audioContent?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type AudioSynthesizeResponse = SynthesizeResponse & { audioContent: string };

function responseErrorMessage(
  response: SynthesizeResponse | undefined,
): string | undefined {
  if (!response?.error) return undefined;
  const parts = [
    response.error.status,
    response.error.code === undefined ? undefined : String(response.error.code),
    response.error.message,
  ].filter(Boolean);
  return parts.length > 0
    ? `Text-to-Speech proxy error: ${parts.join(" - ")}`
    : "Text-to-Speech proxy returned an error.";
}

function assertAudioResponse(
  response: SynthesizeResponse,
): asserts response is AudioSynthesizeResponse {
  if (typeof response.audioContent === "string") return;
  throw new Error(
    `Text-to-Speech response did not include audioContent. Response keys: ${
      Object.keys(response).join(", ") || "none"
    }.`,
  );
}

function isRetryableError(message: string): boolean {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid_argument") ||
    normalized.includes("not supported") ||
    normalized.includes("must be") ||
    normalized.includes("maximum")
  ) {
    return false;
  }
  return normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("429") ||
    normalized.includes("500") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("504") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("unavailable") ||
    normalized.includes("rate") ||
    normalized.includes("quota") ||
    normalized.includes("captcha") ||
    normalized.includes("proxy") ||
    normalized.includes("no response") ||
    normalized.includes("network") ||
    normalized.includes("a result block") ||
    normalized.includes("audioContent".toLowerCase());
}

function voiceLabel(options: ResolvedTtsOptions): string {
  if (options.speakers.length === 0) return options.voice;
  return options.speakers.map((speaker) => `${speaker.alias}=${speaker.voice}`)
    .join(",");
}

function createSessionName(): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `gemgen_${Date.now()}_${random}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(value: string, length = 500): string {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}
