import {
  buildSynthesizeRequest,
  createTtsJsonTemplate,
  extensionForEncoding,
  GEMINI_TTS_MODEL,
  parseCompactOrFullJson,
  parseSpeakerMapping,
  parseTurn,
  parseTurnsJson,
  resolveSequencedOutputPath,
  resolveTtsOptions,
  writeSequencedOutput,
} from "../mod.ts";

function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, got ${actualJson}`);
  }
}

function assertThrows(fn: () => unknown, includes: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(includes),
      `Expected "${message}" to include "${includes}"`,
    );
    return;
  }
  throw new Error(`Expected function to throw "${includes}".`);
}

Deno.test("parses compact JSON input", () => {
  const options = parseCompactOrFullJson(JSON.stringify({
    text: "Hello",
    prompt: "Read warmly.",
    voice: "Kore",
    language: "en-US",
    encoding: "mp3",
    profiles: ["telephony-class-application"],
    out: "speech.mp3",
  }));

  assertEquals(options.text, "Hello");
  assertEquals(options.encoding, "MP3");
  assertEquals(options.profiles, ["telephony-class-application"]);
});

Deno.test("parses full request JSON input", () => {
  const options = parseCompactOrFullJson(JSON.stringify({
    input: {
      prompt: "Conversation.",
      multiSpeakerMarkup: {
        turns: [{ speaker: "Sam", text: "Hi." }],
      },
    },
    voice: {
      languageCode: "en-US",
      modelName: "wrong-model",
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [{ speakerAlias: "Sam", speakerId: "Kore" }],
      },
    },
    audioConfig: {
      audioEncoding: "LINEAR16",
      speakingRate: 1.1,
      pitch: 2,
      volumeGainDb: 1,
      sampleRateHertz: 24000,
      effectsProfileId: ["handset-class-device"],
    },
    out: "dialogue.wav",
  }));

  assertEquals(options.turns, [{ speaker: "Sam", text: "Hi." }]);
  assertEquals(options.speakers, [{ alias: "Sam", voice: "Kore" }]);
  assertEquals(options.sampleRateHertz, 24000);
});

Deno.test("creates valid compact JSON template", () => {
  const template = createTtsJsonTemplate("compact");
  const options = resolveTtsOptions(
    parseCompactOrFullJson(JSON.stringify(template)),
  );

  assertEquals(options.text, "Hello from gemgen.");
  assertEquals(options.voice, "Achernar");
  assertEquals(options.out, "speech");
});

Deno.test("creates valid full JSON template", () => {
  const template = createTtsJsonTemplate("full");
  const request = buildSynthesizeRequest(
    resolveTtsOptions(parseCompactOrFullJson(JSON.stringify(template))),
  );

  assertEquals(request.voice.modelName, GEMINI_TTS_MODEL);
  assertEquals(request.audioConfig.audioEncoding, "LINEAR16");
});

Deno.test("granular flags override JSON fields", () => {
  const jsonOptions = parseCompactOrFullJson(JSON.stringify({
    text: "From JSON",
    voice: "Kore",
    encoding: "MP3",
    out: "json.mp3",
  }));
  const resolved = resolveTtsOptions(jsonOptions, {
    text: "From flag",
    voice: "Achernar",
    encoding: "LINEAR16",
    out: "flag.wav",
  });

  assertEquals(resolved.text, "From flag");
  assertEquals(resolved.voice, "Achernar");
  assertEquals(resolved.encoding, "LINEAR16");
  assertEquals(resolved.out, "flag.wav");
});

Deno.test("forces Gemini 3.1 model", () => {
  const jsonOptions = parseCompactOrFullJson(JSON.stringify({
    input: { text: "Hello" },
    voice: {
      languageCode: "en-US",
      name: "Kore",
      modelName: "gemini-2.5-pro-tts",
    },
    audioConfig: { audioEncoding: "MP3" },
    out: "speech.mp3",
  }));
  const request = buildSynthesizeRequest(resolveTtsOptions(jsonOptions));

  assertEquals(request.voice.modelName, GEMINI_TTS_MODEL);
  assert(!("model_name" in request.voice));
});

Deno.test("validates enum values", () => {
  assertThrows(
    () => resolveTtsOptions({}, { text: "x", voice: "Nope", out: "x.wav" }),
    "Invalid voice",
  );
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        text: "x",
        encoding: "BAD" as never,
        out: "x.wav",
      }),
    "Invalid encoding",
  );
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        text: "x",
        profiles: ["bad-profile"],
        out: "x.wav",
      }),
    "Invalid audio profile",
  );
});

Deno.test("validates numeric ranges", () => {
  assertThrows(
    () => resolveTtsOptions({}, { text: "x", speakingRate: 2.1, out: "x.wav" }),
    "speaking-rate",
  );
  assertThrows(
    () => resolveTtsOptions({}, { text: "x", pitch: -21, out: "x.wav" }),
    "pitch",
  );
  assertThrows(
    () => resolveTtsOptions({}, { text: "x", volumeGainDb: 17, out: "x.wav" }),
    "volume-gain-db",
  );
});

Deno.test("validates speaker aliases", () => {
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        turns: [{ speaker: "Bad Alias", text: "Hi" }],
        speakers: [{ alias: "Bad Alias", voice: "Kore" }],
        out: "x.wav",
      }),
    "alphanumeric",
  );
});

Deno.test("parses --turn syntax", () => {
  assertEquals(parseTurn("Sam:Hello: again"), {
    speaker: "Sam",
    text: "Hello: again",
  });
  assertThrows(() => parseTurn("Sam"), "alias:text");
});

Deno.test("parses turns-file JSON", () => {
  assertEquals(
    parseTurnsJson(
      '[{"speaker":"Sam","text":"Hi"},{"speaker":"Bob","text":"Hello"}]',
    ),
    [
      { speaker: "Sam", text: "Hi" },
      { speaker: "Bob", text: "Hello" },
    ],
  );
  assertThrows(
    () => parseTurnsJson('{"speaker":"Sam"}'),
    "turns must be an array",
  );
});

Deno.test("builds structured turns request", () => {
  const request = buildSynthesizeRequest(resolveTtsOptions({}, {
    prompt: "Two friends.",
    speakers: [
      parseSpeakerMapping("Sam=Kore"),
      parseSpeakerMapping("Bob=Charon"),
    ],
    turns: [parseTurn("Sam:Hi Bob."), parseTurn("Bob:Hi Sam.")],
    out: "dialogue.wav",
  }));

  assertEquals(request.input.multiSpeakerMarkup?.turns, [
    { speaker: "Sam", text: "Hi Bob." },
    { speaker: "Bob", text: "Hi Sam." },
  ]);
  assertEquals(request.voice.multiSpeakerVoiceConfig?.speakerVoiceConfigs, [
    { speakerAlias: "Sam", speakerId: "Kore" },
    { speakerAlias: "Bob", speakerId: "Charon" },
  ]);
});

Deno.test("preserves repeated profiles in order", () => {
  const request = buildSynthesizeRequest(resolveTtsOptions({}, {
    text: "Hello",
    profiles: ["handset-class-device", "telephony-class-application"],
    out: "speech.wav",
  }));

  assertEquals(request.audioConfig.effectsProfileId, [
    "handset-class-device",
    "telephony-class-application",
  ]);
});

Deno.test("maps encodings to output extensions", () => {
  assertEquals(extensionForEncoding("LINEAR16"), "wav");
  assertEquals(extensionForEncoding("MP3"), "mp3");
  assertEquals(extensionForEncoding("OGG_OPUS"), "ogg");
  assertEquals(extensionForEncoding("PCM"), "pcm");
  assertEquals(extensionForEncoding("ALAW"), "alaw");
  assertEquals(extensionForEncoding("MULAW"), "mulaw");
});

Deno.test("creates parent path and starts sequenced output at 0001", async () => {
  const root = await Deno.makeTempDir({ prefix: "gemgen-output-" });
  try {
    const stem = normalizePath(`${root}/nested/file`);
    const output = await resolveSequencedOutputPath(stem, "LINEAR16");

    assertEquals(normalizePath(output.path), `${stem}0001.wav`);
    assertEquals(output.sequence, 1);
    assert((await Deno.stat(`${root}/nested`)).isDirectory);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("increments from highest existing numbered file", async () => {
  const root = await Deno.makeTempDir({ prefix: "gemgen-output-" });
  try {
    const directory = `${root}/audio`;
    await Deno.mkdir(directory, { recursive: true });
    await Deno.writeTextFile(`${directory}/file0001.wav`, "");
    await Deno.writeTextFile(`${directory}/file0004.wav`, "");
    await Deno.writeTextFile(`${directory}/file0099.mp3`, "");

    const output = await writeSequencedOutput(
      `${directory}/file`,
      "LINEAR16",
      new Uint8Array([1, 2, 3]),
    );

    assertEquals(
      normalizePath(output.path),
      normalizePath(`${directory}/file0005.wav`),
    );
    assertEquals(output.sequence, 5);
    assertEquals((await Deno.readFile(output.path)).byteLength, 3);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("strips known extension from requested output stem", async () => {
  const root = await Deno.makeTempDir({ prefix: "gemgen-output-" });
  try {
    const output = await resolveSequencedOutputPath(
      `${root}/speech.wav`,
      "LINEAR16",
    );
    assertEquals(
      normalizePath(output.path),
      normalizePath(`${root}/speech0001.wav`),
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
