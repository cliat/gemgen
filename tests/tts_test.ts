import {
  buildSynthesizeRequest,
  buildSynthesizeRequests,
  createTtsJsonTemplate,
  extensionForEncoding,
  GEMINI_TTS_MODEL,
  MAX_PROMPT_BYTES,
  MAX_TEXT_BYTES,
  parseSpeakerMapping,
  parseTtsJsonInput,
  parseTurn,
  parseTurnsJson,
  randomInterCallDelayMs,
  resolveSequencedOutputPath,
  resolveTtsOptions,
  utf8ByteLength,
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

Deno.test("rejects compact JSON input", () => {
  assertThrows(
    () =>
      parseTtsJsonInput(JSON.stringify({
        text: "Hello",
        prompt: "Read warmly.",
        voice: "Kore",
        encoding: "mp3",
      })),
    "full request object",
  );
});

Deno.test("rejects output paths in JSON input", () => {
  assertThrows(
    () =>
      parseTtsJsonInput(JSON.stringify({
        input: { text: ["Hello"] },
        out: "speech",
      })),
    "Output path must be passed with -o, --out",
  );
});

Deno.test("parses full request JSON text array", () => {
  const options = parseTtsJsonInput(JSON.stringify({
    input: {
      text: ["Hello.", "Again."],
      prompt: "Read warmly.",
    },
    voice: {
      languageCode: "en-US",
      name: "Kore",
      modelName: "wrong-model",
    },
    audioConfig: {
      audioEncoding: "mp3",
      speakingRate: 1.1,
      pitch: 2,
      volumeGainDb: 1,
      sampleRateHertz: 24000,
      effectsProfileId: ["handset-class-device"],
    },
  }));

  assertEquals(options.texts, ["Hello.", "Again."]);
  assertEquals(options.encoding, "MP3");
  assertEquals(options.profiles, ["handset-class-device"]);
  assertEquals(options.sampleRateHertz, 24000);
});

Deno.test("parses full request JSON structured turns", () => {
  const options = parseTtsJsonInput(JSON.stringify({
    input: {
      prompt: "Conversation.",
      multiSpeakerMarkup: {
        turns: [{ speaker: "Sam", text: "Hi." }],
      },
    },
    voice: {
      languageCode: "en-US",
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [{ speakerAlias: "Sam", speakerId: "Kore" }],
      },
    },
    audioConfig: {
      audioEncoding: "LINEAR16",
    },
  }));

  assertEquals(options.turns, [{ speaker: "Sam", text: "Hi." }]);
  assertEquals(options.speakers, [{ alias: "Sam", voice: "Kore" }]);
});

Deno.test("validates JSON text arrays", () => {
  assertThrows(
    () =>
      parseTtsJsonInput(JSON.stringify({
        input: { text: "Hello" },
      })),
    "input.text must be an array of strings",
  );
  assertThrows(
    () =>
      parseTtsJsonInput(JSON.stringify({
        input: { text: [] },
      })),
    "input.text must include at least one text item",
  );
  assertThrows(
    () =>
      parseTtsJsonInput(JSON.stringify({
        input: { text: ["Hello", 1] },
      })),
    "input.text[1] must be a string",
  );
});

Deno.test("creates valid full JSON template without out", () => {
  const template = createTtsJsonTemplate();
  assert(Array.isArray(template.input?.text));
  assert(!("out" in template));

  const options = resolveTtsOptions(
    parseTtsJsonInput(JSON.stringify(template)),
    { out: "speech" },
  );

  assertEquals(options.texts[0], "Paste the first narration segment here.");
  assertEquals(options.sampleRateHertz, 48000);
  assertEquals(options.profiles, []);
  assertEquals(options.voice, "Umbriel");
  assertEquals(options.out, "speech");
});

Deno.test("granular flags override JSON fields", () => {
  const jsonOptions = parseTtsJsonInput(JSON.stringify({
    input: { text: ["From JSON 1", "From JSON 2"] },
    voice: { name: "Kore" },
    audioConfig: { audioEncoding: "MP3" },
  }));
  const resolved = resolveTtsOptions(jsonOptions, {
    text: "From flag",
    voice: "Achernar",
    encoding: "LINEAR16",
    out: "flag",
  });

  assertEquals(resolved.texts, ["From flag"]);
  assertEquals(resolved.voice, "Achernar");
  assertEquals(resolved.encoding, "LINEAR16");
  assertEquals(resolved.out, "flag");
});

Deno.test("CLI text overrides JSON dialogue fields", () => {
  const jsonOptions = parseTtsJsonInput(JSON.stringify({
    input: {
      multiSpeakerMarkup: {
        turns: [{ speaker: "Sam", text: "Hi." }],
      },
    },
    voice: {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: [{ speakerAlias: "Sam", speakerId: "Kore" }],
      },
    },
  }));
  const resolved = resolveTtsOptions(jsonOptions, {
    text: "From flag",
    out: "speech",
  });

  assertEquals(resolved.texts, ["From flag"]);
  assertEquals(resolved.turns, []);
  assertEquals(resolved.speakers, []);
});

Deno.test("CLI turns override JSON text fields", () => {
  const jsonOptions = parseTtsJsonInput(JSON.stringify({
    input: { text: ["From JSON"] },
  }));
  const resolved = resolveTtsOptions(jsonOptions, {
    speakers: [parseSpeakerMapping("Sam=Kore")],
    turns: [parseTurn("Sam:From flag")],
    out: "speech",
  });

  assertEquals(resolved.texts, []);
  assertEquals(resolved.turns, [{ speaker: "Sam", text: "From flag" }]);
});

Deno.test("forces Gemini 3.1 model", () => {
  const jsonOptions = parseTtsJsonInput(JSON.stringify({
    input: { text: ["Hello"] },
    voice: {
      languageCode: "en-US",
      name: "Kore",
      modelName: "gemini-2.5-pro-tts",
    },
    audioConfig: { audioEncoding: "MP3" },
  }));
  const request = buildSynthesizeRequest(
    resolveTtsOptions(jsonOptions, { out: "speech" }),
  );

  assertEquals(request.voice.modelName, GEMINI_TTS_MODEL);
  assert(!("model_name" in request.voice));
});

Deno.test("validates enum values", () => {
  assertThrows(
    () => resolveTtsOptions({}, { text: "x", voice: "Nope", out: "x" }),
    "Invalid voice",
  );
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        text: "x",
        encoding: "BAD" as never,
        out: "x",
      }),
    "Invalid encoding",
  );
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        text: "x",
        profiles: ["bad-profile"],
        out: "x",
      }),
    "Invalid audio profile",
  );
});

Deno.test("validates numeric ranges", () => {
  assertThrows(
    () => resolveTtsOptions({}, { text: "x", speakingRate: 2.1, out: "x" }),
    "speaking-rate",
  );
  assertThrows(
    () => resolveTtsOptions({}, { text: "x", pitch: -21, out: "x" }),
    "pitch",
  );
  assertThrows(
    () => resolveTtsOptions({}, { text: "x", volumeGainDb: 17, out: "x" }),
    "volume-gain-db",
  );
});

Deno.test("validates documented text byte limits", () => {
  assertEquals(utf8ByteLength("țară"), 6);
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        text: "a".repeat(MAX_TEXT_BYTES + 1),
        out: "speech",
      }),
    "UTF-8 bytes",
  );
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        text: "Hello",
        prompt: "a".repeat(MAX_PROMPT_BYTES + 1),
        out: "speech",
      }),
    "Prompt is",
  );
});

Deno.test("validates speaker aliases", () => {
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        turns: [{ speaker: "Bad Alias", text: "Hi" }],
        speakers: [{ alias: "Bad Alias", voice: "Kore" }],
        out: "x",
      }),
    "alphanumeric",
  );
});

Deno.test("validates speakers are only used with structured turns", () => {
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        text: "Hello",
        speakers: [parseSpeakerMapping("Sam=Kore")],
        out: "speech",
      }),
    "structured turns",
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
    out: "dialogue",
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
    out: "speech",
  }));

  assertEquals(request.audioConfig.effectsProfileId, [
    "handset-class-device",
    "telephony-class-application",
  ]);
});

Deno.test("builds one synthesis request per text item", () => {
  const options = resolveTtsOptions({}, {
    texts: ["First", "Second"],
    prompt: "Warm.",
    out: "speech",
  });
  const requests = buildSynthesizeRequests(options);

  assertEquals(requests.length, 2);
  assertEquals(requests[0].input.text, "First");
  assertEquals(requests[1].input.text, "Second");
  assertEquals(requests[1].input.prompt, "Warm.");
});

Deno.test("validates start-at for text-array resumes", () => {
  const options = resolveTtsOptions({}, {
    texts: ["First", "Second"],
    startAt: 2,
    out: "speech",
  });

  assertEquals(options.startAt, 2);
  assertThrows(
    () => resolveTtsOptions({}, { text: "Only", startAt: 2, out: "speech" }),
    "between 1 and 1",
  );
  assertThrows(
    () =>
      resolveTtsOptions({}, {
        startAt: 2,
        speakers: [parseSpeakerMapping("Sam=Kore")],
        turns: [parseTurn("Sam:Hello")],
        out: "speech",
      }),
    "text-array input",
  );
});

Deno.test("builds a synthesis request with a text override", () => {
  const request = buildSynthesizeRequest(
    resolveTtsOptions({}, { texts: ["First"], out: "speech" }),
    "Override",
  );

  assertEquals(request.input.text, "Override");
});

Deno.test("random inter-call delay is between five and ten seconds", () => {
  assertEquals(randomInterCallDelayMs(() => 0), 5_000);
  assertEquals(randomInterCallDelayMs(() => 1), 10_000);
  assert(randomInterCallDelayMs(() => 0.5) >= 5_000);
  assert(randomInterCallDelayMs(() => 0.5) <= 10_000);
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
