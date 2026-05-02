export const GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";

export const ENCODINGS = [
  "LINEAR16",
  "ALAW",
  "MULAW",
  "MP3",
  "OGG_OPUS",
  "PCM",
] as const;

export type AudioEncoding = typeof ENCODINGS[number];

export const VOICES = [
  "Achernar",
  "Achird",
  "Algenib",
  "Algieba",
  "Alnilam",
  "Aoede",
  "Autonoe",
  "Callirrhoe",
  "Charon",
  "Despina",
  "Enceladus",
  "Erinome",
  "Fenrir",
  "Gacrux",
  "Iapetus",
  "Kore",
  "Laomedeia",
  "Leda",
  "Orus",
  "Pulcherrima",
  "Puck",
  "Rasalgethi",
  "Sadachbia",
  "Sadaltager",
  "Schedar",
  "Sulafat",
  "Umbriel",
  "Vindemiatrix",
  "Zephyr",
  "Zubenelgenubi",
] as const;

export const LANGUAGES = [
  "ar-EG",
  "bn-BD",
  "nl-NL",
  "en-IN",
  "en-US",
  "fr-FR",
  "de-DE",
  "hi-IN",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "mr-IN",
  "pl-PL",
  "pt-BR",
  "ro-RO",
  "ru-RU",
  "es-ES",
  "ta-IN",
  "te-IN",
  "th-TH",
  "tr-TR",
  "uk-UA",
  "vi-VN",
  "af-ZA",
  "sq-AL",
  "am-ET",
  "ar-001",
  "hy-AM",
  "az-AZ",
  "eu-ES",
  "be-BY",
  "bg-BG",
  "my-MM",
  "ca-ES",
  "ceb-PH",
  "cmn-CN",
  "cmn-tw",
  "hr-HR",
  "cs-CZ",
  "da-DK",
  "en-AU",
  "en-GB",
  "et-EE",
  "fil-PH",
  "fi-FI",
  "fr-CA",
  "gl-ES",
  "ka-GE",
  "el-GR",
  "gu-IN",
  "ht-HT",
  "he-IL",
  "hu-HU",
  "is-IS",
  "jv-JV",
  "kn-IN",
  "kok-IN",
  "lo-LA",
  "la-VA",
  "lv-LV",
  "lt-LT",
  "lb-LU",
  "mk-MK",
  "mai-IN",
  "mg-MG",
  "ms-MY",
  "ml-IN",
  "mn-MN",
  "ne-NP",
  "nb-NO",
  "nn-NO",
  "or-IN",
  "ps-AF",
  "fa-IR",
  "pt-PT",
  "pa-IN",
  "sr-RS",
  "sd-IN",
  "si-LK",
  "sk-SK",
  "sl-SI",
  "es-419",
  "es-MX",
  "sw-KE",
  "sv-SE",
  "ur-PK",
] as const;

export const AUDIO_PROFILES = [
  "wearable-class-device",
  "handset-class-device",
  "headphone-class-device",
  "small-bluetooth-speaker-class-device",
  "medium-bluetooth-speaker-class-device",
  "large-home-entertainment-class-device",
  "large-automotive-class-device",
  "telephony-class-application",
] as const;

export const MARKUP_TAGS = [
  "[sigh]",
  "[laughing]",
  "[uhm]",
  "[sarcasm]",
  "[robotic]",
  "[shouting]",
  "[whispering]",
  "[extremely fast]",
  "[scared]",
  "[curious]",
  "[bored]",
  "[short pause]",
  "[medium pause]",
  "[long pause]",
] as const;

export type Turn = {
  speaker: string;
  text: string;
};

export type SpeakerMapping = {
  alias: string;
  voice: string;
};

export type TtsOptions = {
  texts: string[];
  prompt?: string;
  voice: string;
  language: string;
  encoding: AudioEncoding;
  speakingRate: number;
  pitch: number;
  volumeGainDb: number;
  sampleRateHertz?: number;
  profiles: string[];
  speakers: SpeakerMapping[];
  turns: Turn[];
  out?: string;
};

export type TtsFlagOverrides =
  & Partial<Omit<TtsOptions, "profiles" | "speakers" | "turns" | "texts">>
  & {
    text?: string;
    texts?: string[];
    profiles?: string[];
    speakers?: SpeakerMapping[];
    turns?: Turn[];
  };

export type ResolvedTtsOptions = Omit<TtsOptions, "out"> & {
  modelName: typeof GEMINI_TTS_MODEL;
  out: string;
};

export type FullSynthesizeRequest = {
  input?: {
    text?: string[];
    ssml?: string;
    prompt?: string;
    multiSpeakerMarkup?: {
      turns?: Turn[];
    };
  };
  voice?: {
    languageCode?: string;
    name?: string;
    modelName?: string;
    model_name?: string;
    multiSpeakerVoiceConfig?: {
      speakerVoiceConfigs?: Array<{
        speakerAlias?: string;
        speakerId?: string;
      }>;
    };
  };
  audioConfig?: {
    audioEncoding?: string;
    speakingRate?: number;
    pitch?: number;
    volumeGainDb?: number;
    sampleRateHertz?: number;
    effectsProfileId?: string[];
  };
};

export type JsonInput = FullSynthesizeRequest;

export type Logger = (message: string) => void;

export type TtsOutputResult = {
  out: string;
  bytes: number;
  index: number;
};

export type TtsRunResult = {
  ok: true;
  command: "tts";
  modelName: typeof GEMINI_TTS_MODEL;
  outputs: TtsOutputResult[];
  voice?: string;
  language: string;
  encoding: AudioEncoding;
  profiles: string[];
  speakers: SpeakerMapping[];
  turns: number;
};

export type SynthesizeRequest = {
  input: {
    text?: string;
    prompt?: string;
    multiSpeakerMarkup?: {
      turns: Turn[];
    };
  };
  voice: {
    languageCode: string;
    name?: string;
    modelName: typeof GEMINI_TTS_MODEL;
    multiSpeakerVoiceConfig?: {
      speakerVoiceConfigs: Array<{
        speakerAlias: string;
        speakerId: string;
      }>;
    };
  };
  audioConfig: {
    audioEncoding: AudioEncoding;
    speakingRate: number;
    pitch: number;
    volumeGainDb: number;
    sampleRateHertz?: number;
    effectsProfileId?: string[];
  };
};

const DEFAULT_OPTIONS: TtsOptions = {
  texts: [],
  voice: "Achernar",
  language: "en-US",
  encoding: "LINEAR16",
  speakingRate: 1,
  pitch: 0,
  volumeGainDb: 0,
  profiles: [],
  speakers: [],
  turns: [],
};

export function createTtsJsonTemplate(): FullSynthesizeRequest {
  return {
    input: {
      text: [
        "Paste the first narration segment here.",
        "Paste the next narration segment here.",
      ],
      prompt:
        "Calm, soothing narration ideal for falling asleep videos. Slow gentle pacing, soft warmth, relaxed clarity, and peaceful pauses.",
    },
    voice: {
      languageCode: "en-US",
      name: "Achernar",
      modelName: GEMINI_TTS_MODEL,
    },
    audioConfig: {
      audioEncoding: "LINEAR16",
      speakingRate: 1,
      pitch: 0,
      volumeGainDb: 0,
      sampleRateHertz: 48000,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  return value;
}

function asNumber(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }
  return value;
}

function coerceStringArray(
  value: unknown,
  field: string,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return [value];
  if (
    !Array.isArray(value) || !value.every((item) => typeof item === "string")
  ) {
    throw new Error(`${field} must be a string or string array.`);
  }
  return value;
}

function asTextArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of strings.`);
  }
  if (value.length === 0) {
    throw new Error(`${field} must include at least one text item.`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`${field}[${index}] must be a string.`);
    }
    if (item.trim() === "") {
      throw new Error(`${field}[${index}] must be a non-empty string.`);
    }
    return item;
  });
}

function uniqueListDescription(values: readonly string[]): string {
  return values.join(", ");
}

function normalizeLanguageCode(language: string): string {
  const match = LANGUAGES.find((known) =>
    known.toLowerCase() === language.toLowerCase()
  );
  return match ?? language;
}

function normalizeVoiceName(voice: string): string {
  const match = VOICES.find((known) =>
    known.toLowerCase() === voice.toLowerCase()
  );
  return match ?? voice;
}

function normalizeEncoding(encoding: string): AudioEncoding {
  const upper = encoding.toUpperCase();
  const match = ENCODINGS.find((known) => known === upper);
  if (!match) {
    throw new Error(
      `Invalid encoding "${encoding}". Use one of: ${
        uniqueListDescription(ENCODINGS)
      }.`,
    );
  }
  return match;
}

function normalizeTurns(value: unknown, field: string): Turn[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`${field}[${index}] must be an object.`);
    }
    const speaker = asString(item.speaker, `${field}[${index}].speaker`);
    const text = asString(item.text, `${field}[${index}].text`);
    if (!speaker || !text) {
      throw new Error(`${field}[${index}] must include speaker and text.`);
    }
    return { speaker, text };
  });
}

function mergeArray<T>(
  base: T[] | undefined,
  override: T[] | undefined,
): T[] | undefined {
  return override === undefined ? base : override;
}

export function parseSpeakerMapping(value: string): SpeakerMapping {
  const splitAt = value.indexOf("=");
  if (splitAt <= 0 || splitAt === value.length - 1) {
    throw new Error(`Invalid speaker mapping "${value}". Use alias=voice.`);
  }
  return {
    alias: value.slice(0, splitAt),
    voice: value.slice(splitAt + 1),
  };
}

export function parseTurn(value: string): Turn {
  const splitAt = value.indexOf(":");
  if (splitAt <= 0 || splitAt === value.length - 1) {
    throw new Error(`Invalid turn "${value}". Use alias:text.`);
  }
  return {
    speaker: value.slice(0, splitAt),
    text: value.slice(splitAt + 1),
  };
}

export function parseTurnsJson(json: string): Turn[] {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid turns JSON: ${message}`);
  }

  const turns = normalizeTurns(value, "turns");
  if (!turns) throw new Error("turns must be an array.");
  return turns;
}

export function parseTtsJsonInput(json: string): TtsFlagOverrides {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON input: ${message}`);
  }
  if (!isRecord(value)) throw new Error("JSON input must be an object.");
  if ("out" in value && value.out !== undefined) {
    throw new Error("Output path must be passed with -o, --out, not JSON out.");
  }
  if (!isFullSynthesizeRequest(value)) {
    throw new Error(
      "JSON input must be a full request object. Generate one with gemgen tts --json-template.",
    );
  }
  return normalizeFullJson(value);
}

/** @deprecated Use parseTtsJsonInput. Compact JSON is no longer supported. */
export function parseCompactOrFullJson(json: string): TtsFlagOverrides {
  return parseTtsJsonInput(json);
}

export function isFullSynthesizeRequest(
  value: unknown,
): value is FullSynthesizeRequest {
  return isRecord(value) &&
    (isRecord(value.input) || isRecord(value.voice) ||
      isRecord(value.audioConfig));
}

function normalizeFullJson(value: Record<string, unknown>): TtsFlagOverrides {
  const input = isRecord(value.input) ? value.input : {};
  const voice = isRecord(value.voice) ? value.voice : {};
  const audioConfig = isRecord(value.audioConfig) ? value.audioConfig : {};
  const multiSpeakerMarkup = isRecord(input.multiSpeakerMarkup)
    ? input.multiSpeakerMarkup
    : {};
  const voiceConfig = isRecord(voice.multiSpeakerVoiceConfig)
    ? voice.multiSpeakerVoiceConfig
    : {};

  const speakerVoiceConfigs = Array.isArray(voiceConfig.speakerVoiceConfigs)
    ? voiceConfig.speakerVoiceConfigs.map((item, index) => {
      if (!isRecord(item)) {
        throw new Error(
          `voice.multiSpeakerVoiceConfig.speakerVoiceConfigs[${index}] must be an object.`,
        );
      }
      const alias = asString(
        item.speakerAlias,
        `voice.multiSpeakerVoiceConfig.speakerVoiceConfigs[${index}].speakerAlias`,
      );
      const speakerId = asString(
        item.speakerId,
        `voice.multiSpeakerVoiceConfig.speakerVoiceConfigs[${index}].speakerId`,
      );
      if (!alias || !speakerId) {
        throw new Error(
          `voice.multiSpeakerVoiceConfig.speakerVoiceConfigs[${index}] must include speakerAlias and speakerId.`,
        );
      }
      return { alias, voice: speakerId };
    })
    : undefined;

  if (input.ssml !== undefined) {
    throw new Error("input.ssml is not supported; use input.text as an array.");
  }

  const texts = asTextArray(input.text, "input.text");
  const encoding = asString(
    audioConfig.audioEncoding,
    "audioConfig.audioEncoding",
  );

  return {
    texts,
    prompt: asString(input.prompt, "input.prompt"),
    voice: asString(voice.name, "voice.name"),
    language: asString(voice.languageCode, "voice.languageCode"),
    encoding: encoding ? normalizeEncoding(encoding) : undefined,
    speakingRate: asNumber(
      audioConfig.speakingRate,
      "audioConfig.speakingRate",
    ),
    pitch: asNumber(audioConfig.pitch, "audioConfig.pitch"),
    volumeGainDb: asNumber(
      audioConfig.volumeGainDb,
      "audioConfig.volumeGainDb",
    ),
    sampleRateHertz: asNumber(
      audioConfig.sampleRateHertz,
      "audioConfig.sampleRateHertz",
    ),
    profiles: coerceStringArray(
      audioConfig.effectsProfileId,
      "audioConfig.effectsProfileId",
    ),
    speakers: speakerVoiceConfigs,
    turns: normalizeTurns(
      multiSpeakerMarkup.turns,
      "input.multiSpeakerMarkup.turns",
    ),
  };
}

export function mergeTtsOptions(
  jsonOptions: TtsFlagOverrides = {},
  flagOptions: TtsFlagOverrides = {},
): TtsOptions {
  const definedJsonOptions = withoutUndefined(jsonOptions);
  const definedFlagOptions = withoutUndefined(flagOptions);
  const jsonTexts = jsonOptions.text !== undefined
    ? [jsonOptions.text]
    : jsonOptions.texts;
  const flagTexts = flagOptions.text !== undefined
    ? [flagOptions.text]
    : flagOptions.texts;
  const hasFlagText = flagOptions.text !== undefined ||
    flagOptions.texts !== undefined;
  const hasFlagTurns = flagOptions.turns !== undefined;
  const merged: TtsOptions = {
    ...DEFAULT_OPTIONS,
    ...definedJsonOptions,
    ...definedFlagOptions,
    texts: hasFlagText
      ? flagTexts ?? DEFAULT_OPTIONS.texts
      : hasFlagTurns
      ? DEFAULT_OPTIONS.texts
      : jsonTexts ?? DEFAULT_OPTIONS.texts,
    voice: normalizeVoiceName(
      flagOptions.voice ?? jsonOptions.voice ?? DEFAULT_OPTIONS.voice,
    ),
    language: normalizeLanguageCode(
      flagOptions.language ?? jsonOptions.language ?? DEFAULT_OPTIONS.language,
    ),
    encoding: flagOptions.encoding ?? jsonOptions.encoding ??
      DEFAULT_OPTIONS.encoding,
    profiles: mergeArray(jsonOptions.profiles, flagOptions.profiles) ??
      DEFAULT_OPTIONS.profiles,
    speakers: hasFlagText
      ? flagOptions.speakers ?? DEFAULT_OPTIONS.speakers
      : mergeArray(jsonOptions.speakers, flagOptions.speakers) ??
        DEFAULT_OPTIONS.speakers,
    turns: hasFlagText
      ? DEFAULT_OPTIONS.turns
      : hasFlagTurns
      ? flagOptions.turns ?? DEFAULT_OPTIONS.turns
      : jsonOptions.turns ?? DEFAULT_OPTIONS.turns,
  };

  validateTtsOptions(merged);
  return merged;
}

function withoutUndefined<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) result[key as keyof T] = item as T[keyof T];
  }
  return result;
}

export function resolveTtsOptions(
  jsonOptions: TtsFlagOverrides = {},
  flagOptions: TtsFlagOverrides = {},
): ResolvedTtsOptions {
  const options = mergeTtsOptions(jsonOptions, flagOptions);
  return {
    ...options,
    out: options.out as string,
    modelName: GEMINI_TTS_MODEL,
  };
}

export function validateTtsOptions(options: TtsOptions): void {
  if (!options.out || options.out.trim() === "") {
    throw new Error("Missing required output path. Pass -o, --out <path>.");
  }

  if (options.texts.length === 0 && options.turns.length === 0) {
    throw new Error(
      "Missing text. Pass -t, --text, --turn, --turns-file, or JSON input.",
    );
  }

  if (options.texts.length > 0 && options.turns.length > 0) {
    throw new Error("Use either text or structured turns, not both.");
  }

  if (options.speakers.length > 0 && options.turns.length === 0) {
    throw new Error("Use --speaker only with structured turns.");
  }

  for (const [index, text] of options.texts.entries()) {
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error(`Text item ${index} must be a non-empty string.`);
    }
  }

  if (!VOICES.some((voice) => voice === options.voice)) {
    throw new Error(
      `Invalid voice "${options.voice}". Use one of: ${
        uniqueListDescription(VOICES)
      }.`,
    );
  }

  if (!LANGUAGES.some((language) => language === options.language)) {
    throw new Error(
      `Invalid language "${options.language}". Use a supported BCP-47 language code.`,
    );
  }

  normalizeEncoding(options.encoding);
  validateRange("speaking-rate", options.speakingRate, 0.25, 2);
  validateRange("pitch", options.pitch, -20, 20);
  validateRange("volume-gain-db", options.volumeGainDb, -96, 16);

  if (
    options.sampleRateHertz !== undefined &&
    (!Number.isInteger(options.sampleRateHertz) || options.sampleRateHertz <= 0)
  ) {
    throw new Error("sample-rate must be a positive integer.");
  }

  for (const profile of options.profiles) {
    if (!AUDIO_PROFILES.includes(profile as typeof AUDIO_PROFILES[number])) {
      throw new Error(
        `Invalid audio profile "${profile}". Use one of: ${
          uniqueListDescription(AUDIO_PROFILES)
        }.`,
      );
    }
  }

  for (const speaker of options.speakers) {
    validateSpeakerAlias(speaker.alias);
    const voice = normalizeVoiceName(speaker.voice);
    if (!VOICES.includes(voice as typeof VOICES[number])) {
      throw new Error(
        `Invalid speaker voice "${speaker.voice}" for alias "${speaker.alias}".`,
      );
    }
    speaker.voice = voice;
  }

  const seenAliases = new Set<string>();
  for (const speaker of options.speakers) {
    if (seenAliases.has(speaker.alias)) {
      throw new Error(`Duplicate speaker alias "${speaker.alias}".`);
    }
    seenAliases.add(speaker.alias);
  }

  for (const turn of options.turns) {
    validateSpeakerAlias(turn.speaker);
    if (turn.text.trim() === "") {
      throw new Error(`Turn for "${turn.speaker}" has empty text.`);
    }
    if (!seenAliases.has(turn.speaker)) {
      throw new Error(
        `Turn speaker "${turn.speaker}" has no --speaker alias=voice mapping.`,
      );
    }
  }
}

function validateRange(
  name: string,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be in the range ${min}..${max}.`);
  }
}

function validateSpeakerAlias(alias: string): void {
  if (!/^[A-Za-z0-9]+$/.test(alias)) {
    throw new Error(
      `Speaker alias "${alias}" must be alphanumeric with no whitespace.`,
    );
  }
}

export function buildSynthesizeRequest(
  options: ResolvedTtsOptions,
  text?: string,
): SynthesizeRequest {
  const input: SynthesizeRequest["input"] = options.turns.length > 0
    ? { multiSpeakerMarkup: { turns: options.turns } }
    : { text: text ?? options.texts[0] };

  if (options.prompt) input.prompt = options.prompt;

  const voice: SynthesizeRequest["voice"] = {
    languageCode: options.language,
    modelName: GEMINI_TTS_MODEL,
  };

  if (options.speakers.length > 0) {
    voice.multiSpeakerVoiceConfig = {
      speakerVoiceConfigs: options.speakers.map((speaker) => ({
        speakerAlias: speaker.alias,
        speakerId: speaker.voice,
      })),
    };
  } else {
    voice.name = options.voice;
  }

  const audioConfig: SynthesizeRequest["audioConfig"] = {
    audioEncoding: options.encoding,
    speakingRate: options.speakingRate,
    pitch: options.pitch,
    volumeGainDb: options.volumeGainDb,
  };

  if (options.sampleRateHertz !== undefined) {
    audioConfig.sampleRateHertz = options.sampleRateHertz;
  }

  if (options.profiles.length > 0) {
    audioConfig.effectsProfileId = options.profiles;
  }

  return { input, voice, audioConfig };
}

export function buildSynthesizeRequests(
  options: ResolvedTtsOptions,
): SynthesizeRequest[] {
  if (options.turns.length > 0) return [buildSynthesizeRequest(options)];
  return options.texts.map((text) => buildSynthesizeRequest(options, text));
}

export function decodeAudioContent(audioContent: string): Uint8Array {
  const normalized = audioContent.replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
