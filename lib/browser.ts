import {
  buildSynthesizeRequest,
  decodeAudioContent,
  GEMINI_TTS_MODEL,
  type Logger,
  type ResolvedTtsOptions,
  type TtsRunResult,
} from "./tts.ts";
import { writeSequencedOutput } from "./output.ts";

const CLOUD_TTS_PAGE = "https://cloud.google.com/text-to-speech";
const DEMO_PAGE =
  "https://www.gstatic.com/cloud-site-ux/text_to_speech/text_to_speech.min.html";
const SYNTHESIZE_URL =
  "https://texttospeech.googleapis.com/v1beta1/text:synthesize";
const PLAYWRIGHT_PACKAGE = "npm:playwright@1.52.0";
const PROXY_TIMEOUT_MS = 120_000;

type DemoFrame = {
  evaluate: <T>(
    pageFunction: (arg?: unknown) => T | Promise<T>,
    arg?: unknown,
  ) => Promise<T>;
  waitForFunction: (
    pageFunction: (...args: unknown[]) => unknown,
    arg?: unknown,
    options?: { timeout?: number },
  ) => Promise<unknown>;
  url: () => string;
};

type BrowserPage = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  waitForLoadState: (
    state: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  waitForTimeout: (timeout: number) => Promise<unknown>;
  frames: () => DemoFrame[];
  mainFrame: () => DemoFrame;
  evaluate: <T>(
    pageFunction: (arg?: unknown) => T | Promise<T>,
    arg?: unknown,
  ) => Promise<T>;
  getByRole: (role: string, options?: Record<string, unknown>) => {
    click: (options?: Record<string, unknown>) => Promise<unknown>;
  };
};

type Browser = {
  newPage: () => Promise<BrowserPage>;
  close: () => Promise<void>;
};

export async function synthesizeWithBrowser(
  options: ResolvedTtsOptions,
  log: Logger = () => {},
): Promise<TtsRunResult> {
  const request = buildSynthesizeRequest(options);
  let browser: Browser | undefined;

  try {
    const { chromium } = await import("npm:playwright@1.52.0");
    browser = await chromium.launch({ headless: false }) as Browser;
    const page = await browser.newPage();

    log(`Opening ${CLOUD_TTS_PAGE}`);
    await page.goto(CLOUD_TTS_PAGE, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(
      () => {},
    );
    await acceptCookies(page);

    const frame = await findDemoFrame(page, log);
    await prepareDemoFrame(frame, request, options);

    const response = await submitWithCaptchaIfNeeded(frame, request, log);
    if (!response.audioContent || typeof response.audioContent !== "string") {
      throw new Error("Text-to-Speech response did not include audioContent.");
    }

    const audio = decodeAudioContent(response.audioContent);
    const output = await writeSequencedOutput(
      options.out,
      options.encoding,
      audio,
    );

    return {
      ok: true,
      command: "tts",
      modelName: GEMINI_TTS_MODEL,
      out: output.path,
      bytes: audio.byteLength,
      voice: options.speakers.length === 0 ? options.voice : undefined,
      language: options.language,
      encoding: options.encoding,
      profiles: options.profiles,
      speakers: options.speakers,
      turns: options.turns.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Executable doesn't exist") ||
      message.includes("Please run the following command")
    ) {
      throw new Error(
        `Playwright Chromium is not installed. Run: deno run -A ${PLAYWRIGHT_PACKAGE} install chromium`,
      );
    }
    throw error;
  } finally {
    if (browser) await closeBrowser(browser, log);
  }
}

async function closeBrowser(browser: Browser, log: Logger): Promise<void> {
  const closed = await Promise.race([
    browser.close().then(() => true).catch(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  if (!closed) {
    log("Browser close timed out; continuing shutdown.");
  }
}

async function acceptCookies(page: BrowserPage): Promise<void> {
  const names = [
    /Accept all/i,
    /Accept/i,
    /Agree/i,
  ];

  for (const name of names) {
    await page.getByRole("button", { name }).click({ timeout: 2_000 }).catch(
      () => {},
    );
  }
}

async function findDemoFrame(
  page: BrowserPage,
  log: Logger,
): Promise<DemoFrame> {
  await page.evaluate(() =>
    (globalThis as unknown as {
      scrollTo: (x: number, y: number) => void;
      document: { body: { scrollHeight: number } };
    }).scrollTo(
      0,
      Math.max(
        0,
        (globalThis as unknown as {
          document: { body: { scrollHeight: number } };
        })
          .document.body.scrollHeight * 0.25,
      ),
    )
  )
    .catch(() => {});
  await page.waitForTimeout(2_000);

  let frame = page.frames().find((candidate) =>
    candidate.url().includes("text_to_speech")
  );
  if (frame) return frame;

  log(
    "Embedded demo was not found on the product page; opening the public demo frame directly.",
  );
  await page.goto(DEMO_PAGE, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(
    () => {},
  );
  frame = page.mainFrame();
  await waitForTsApp(frame);
  return frame;
}

async function waitForTsApp(frame: DemoFrame): Promise<void> {
  await frame.waitForFunction(
    () =>
      Boolean(
        (globalThis as unknown as {
          document: { querySelector: (selector: string) => unknown };
        }).document.querySelector("ts-app"),
      ),
    undefined,
    { timeout: 60_000 },
  );
}

async function prepareDemoFrame(
  frame: DemoFrame,
  request: unknown,
  options: ResolvedTtsOptions,
): Promise<void> {
  await waitForTsApp(frame);
  await frame.evaluate(
    (payload) => {
      const { rawRequest, rawOptions } = payload as {
        rawRequest: unknown;
        rawOptions: Record<string, unknown>;
      };
      const app = (globalThis as unknown as {
        document: { querySelector: (selector: string) => unknown };
      }).document.querySelector("ts-app") as Record<string, unknown>;
      const requestObject = rawRequest as Record<string, unknown>;
      const opts = rawOptions as Record<string, unknown>;

      app.modelSelected = "gemini-3.1-flash-tts-preview";
      app.requestObject = requestObject;

      const input = requestObject.input as Record<string, unknown> | undefined;
      if (typeof input?.text === "string") app.textInput = input.text;
      if (typeof input?.prompt === "string") app.promptInput = input.prompt;
      if (input?.multiSpeakerMarkup) {
        const turns =
          (input.multiSpeakerMarkup as Record<string, unknown>).turns;
        if (Array.isArray(turns)) {
          app.textInput = turns.map((turn) =>
            `${(turn as Record<string, unknown>).speaker}: ${
              (turn as Record<string, unknown>).text
            }`
          ).join("\n");
        }
      }

      const languages = app.languagesAvailable;
      if (Array.isArray(languages) && typeof opts.language === "string") {
        const match = languages.find((language) =>
          typeof language === "object" &&
          language !== null &&
          String((language as Record<string, unknown>).code).toLowerCase() ===
            String(opts.language).toLowerCase()
        );
        if (match) app.languageSelected = match;
      }

      if (typeof opts.voice === "string") app.voiceSelected = opts.voice;
    },
    {
      rawRequest: request,
      rawOptions: {
        language: options.language,
        voice: options.voice,
      },
    },
  );
}

async function submitWithCaptchaIfNeeded(
  frame: DemoFrame,
  request: unknown,
  log: Logger,
): Promise<{ audioContent?: string }> {
  log("Submitting synthesis request through the demo proxy.");
  let result = await trySubmit(frame, request);
  if (result.needsCaptcha) {
    log(
      "CAPTCHA required. Solve it in the visible browser; gemgen will continue automatically.",
    );
    await frame.waitForFunction(
      () => {
        const app = (globalThis as unknown as {
          document: { querySelector: (selector: string) => unknown };
        }).document.querySelector("ts-app") as Record<string, unknown> | null;
        return Boolean(app?.captchaToken);
      },
      undefined,
      { timeout: 0 },
    );
    log("CAPTCHA solved; submitting synthesis request.");
    result = await trySubmit(frame, request);
  }

  if (result.error) throw new Error(result.error);
  return result.response as { audioContent?: string };
}

async function trySubmit(
  frame: DemoFrame,
  request: unknown,
): Promise<{ needsCaptcha?: true; response?: unknown; error?: string }> {
  return await frame.evaluate(
    async (payload) => {
      const { rawRequest, synthesizeUrl, proxyTimeoutMs } = payload as {
        rawRequest: unknown;
        synthesizeUrl: string;
        proxyTimeoutMs: number;
      };
      const app = (globalThis as unknown as {
        document: { querySelector: (selector: string) => unknown };
      }).document.querySelector("ts-app") as {
        captchaToken?: string;
        requestObject?: unknown;
        shouldShowCaptcha?: boolean;
        controlsEnabled?: boolean;
        set?: (path: string, value: unknown) => void;
        verifyUser_?: () => void;
        setAndStartAudio_?: () => void;
        sendAudioRequest_?: (url: string, body: unknown) => Promise<string>;
        __gemgenPatched?: boolean;
      } | null;

      if (!app) return { error: "Could not find the Text-to-Speech demo app." };
      if (typeof app.sendAudioRequest_ !== "function") {
        return {
          error:
            "The Text-to-Speech demo app does not expose sendAudioRequest_.",
        };
      }

      app.requestObject = rawRequest;

      if (!app.captchaToken) {
        if (!app.__gemgenPatched) {
          app.setAndStartAudio_ = () => {};
          app.__gemgenPatched = true;
        }
        app.shouldShowCaptcha = true;
        app.controlsEnabled = false;
        app.set?.("audio.state", "loading");
        app.verifyUser_?.();
        return { needsCaptcha: true };
      }

      let text: string;
      try {
        text = await Promise.race([
          app.sendAudioRequest_(String(synthesizeUrl), rawRequest),
          new Promise<string>((_, reject) =>
            setTimeout(
              () => reject(new Error("Timed out waiting for the demo proxy.")),
              proxyTimeoutMs,
            )
          ),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: message };
      }

      try {
        return { response: JSON.parse(text) };
      } catch {
        return {
          error: `Text-to-Speech proxy returned non-JSON response: ${
            text.slice(0, 160)
          }`,
        };
      }
    },
    {
      rawRequest: request,
      synthesizeUrl: SYNTHESIZE_URL,
      proxyTimeoutMs: PROXY_TIMEOUT_MS,
    },
  );
}
