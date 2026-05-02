export type DemoSubmitScriptConfig = {
  cloudTtsPage: string;
  demoPage: string;
  synthesizeUrl: string;
  proxyTimeoutMs: number;
};

export function buildDemoSubmitCode(
  request: unknown,
  config: DemoSubmitScriptConfig,
): string {
  return `async (page) => {
const request = ${JSON.stringify(request)};
const CLOUD_TTS_PAGE = ${JSON.stringify(config.cloudTtsPage)};
const DEMO_PAGE = ${JSON.stringify(config.demoPage)};
const SYNTHESIZE_URL = ${JSON.stringify(config.synthesizeUrl)};
const PROXY_TIMEOUT_MS = ${config.proxyTimeoutMs};

async function acceptCookies() {
  for (const name of [/Accept all/i, /Accept/i, /Agree/i]) {
    await page.getByRole("button", { name }).click({ timeout: 2000 }).catch(() => {});
  }
}

async function waitForTsApp(frame) {
  await frame.waitForFunction(
    () => Boolean(document.querySelector("ts-app")),
    undefined,
    { timeout: 60000 },
  );
}

async function findDemoFrame() {
  if (!page.url().startsWith("http")) {
    await page.goto(CLOUD_TTS_PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await acceptCookies();
  await page.evaluate(() => scrollTo(0, Math.max(0, document.body.scrollHeight * 0.25))).catch(() => {});
  await page.waitForTimeout(2000);
  let frame = page.frames().find((candidate) => candidate.url().includes("text_to_speech"));
  if (frame) {
    await waitForTsApp(frame);
    return frame;
  }
  await page.goto(DEMO_PAGE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  frame = page.mainFrame();
  await waitForTsApp(frame);
  return frame;
}

async function prepareDemoFrame(frame) {
  await frame.evaluate(({ rawRequest }) => {
    const app = document.querySelector("ts-app");
    if (!app) throw new Error("Could not find the Text-to-Speech demo app.");
    app.modelSelected = "gemini-3.1-flash-tts-preview";
    app.requestObject = rawRequest;

    const input = rawRequest.input || {};
    if (typeof input.text === "string") app.textInput = input.text;
    if (typeof input.prompt === "string") app.promptInput = input.prompt;
    if (input.multiSpeakerMarkup && Array.isArray(input.multiSpeakerMarkup.turns)) {
      app.textInput = input.multiSpeakerMarkup.turns
        .map((turn) => String(turn.speaker) + ": " + String(turn.text))
        .join("\\n");
    }

    if (Array.isArray(app.languagesAvailable)) {
      const match = app.languagesAvailable.find((language) =>
        language && String(language.code).toLowerCase() === String(rawRequest.voice.languageCode).toLowerCase()
      );
      if (match) app.languageSelected = match;
    }
    if (rawRequest.voice && typeof rawRequest.voice.name === "string") {
      app.voiceSelected = rawRequest.voice.name;
    }
  }, { rawRequest: request });
}

async function waitForCaptcha(frame) {
  await frame.waitForFunction(() => {
    const app = document.querySelector("ts-app");
    return Boolean(app && app.captchaToken);
  }, undefined, { timeout: 0 });
}

async function clearCaptchaToken(frame) {
  await frame.evaluate(() => {
    const app = document.querySelector("ts-app");
    if (app) app.captchaToken = undefined;
  });
}

async function trySubmit(frame) {
  return await frame.evaluate(async ({ rawRequest, synthesizeUrl, proxyTimeoutMs }) => {
    const app = document.querySelector("ts-app");
    if (!app) return { error: "Could not find the Text-to-Speech demo app." };
    if (typeof app.sendAudioRequest_ !== "function") {
      return { error: "The Text-to-Speech demo app does not expose sendAudioRequest_." };
    }
    app.requestObject = rawRequest;
    if (!app.captchaToken) {
      if (!app.__gemgenPatched) {
        app.setAndStartAudio_ = () => {};
        app.__gemgenPatched = true;
      }
      app.shouldShowCaptcha = true;
      app.controlsEnabled = false;
      app.set && app.set("audio.state", "loading");
      app.verifyUser_ && app.verifyUser_();
      return { needsCaptcha: true };
    }
    let text;
    try {
      text = await Promise.race([
        app.sendAudioRequest_(String(synthesizeUrl), rawRequest),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for the demo proxy.")), proxyTimeoutMs)),
      ]);
      if (typeof text !== "string") {
        return { error: "Text-to-Speech proxy returned no response text after CAPTCHA." };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
    try {
      return { response: JSON.parse(text) };
    } catch {
      return { error: "Text-to-Speech proxy returned non-JSON response: " + String(text).slice(0, 160) };
    }
  }, {
    rawRequest: request,
    synthesizeUrl: SYNTHESIZE_URL,
    proxyTimeoutMs: PROXY_TIMEOUT_MS,
  });
}

function responseErrorMessage(response) {
  if (!response || !response.error) return undefined;
  const parts = [response.error.status, response.error.code, response.error.message]
    .filter((part) => part !== undefined && part !== null && String(part) !== "")
    .map(String);
  return parts.length ? "Text-to-Speech proxy error: " + parts.join(" - ") : "Text-to-Speech proxy returned an error.";
}

function isCaptchaError(response) {
  const message = (responseErrorMessage(response) || "").toLowerCase();
  return message.includes("captcha") || message.includes("recaptcha");
}

async function submit(frame) {
  let result = await trySubmit(frame);
  if (result.needsCaptcha) {
    await waitForCaptcha(frame);
    result = await trySubmit(frame);
  }
  if (result.error) throw new Error(result.error);
  let response = result.response;
  if (!response) throw new Error("Text-to-Speech demo proxy returned no response.");
  if (isCaptchaError(response)) {
    await clearCaptchaToken(frame);
    result = await trySubmit(frame);
    if (result.needsCaptcha) {
      await waitForCaptcha(frame);
      result = await trySubmit(frame);
    }
    if (result.error) throw new Error(result.error);
    response = result.response;
    if (!response) throw new Error("Text-to-Speech demo proxy returned no response.");
  }
  const upstreamError = responseErrorMessage(response);
  if (upstreamError) throw new Error(upstreamError);
  return response;
}

const frame = await findDemoFrame();
await prepareDemoFrame(frame);
return await submit(frame);
}`;
}
