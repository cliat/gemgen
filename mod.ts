/**
 * Public library surface for gemgen.
 *
 * @module
 */

export {
  AUDIO_EXTENSION_BY_ENCODING,
  extensionForEncoding,
  resolveSequencedOutputPath,
  writeSequencedOutput,
} from "./lib/output.ts";
export type { SequencedOutputPath } from "./lib/output.ts";

export {
  AUDIO_PROFILES,
  buildSynthesizeRequest,
  buildSynthesizeRequests,
  createTtsJsonTemplate,
  decodeAudioContent,
  ENCODINGS,
  GEMINI_TTS_MODEL,
  isFullSynthesizeRequest,
  LANGUAGES,
  MARKUP_TAGS,
  MAX_PROMPT_BYTES,
  MAX_TEXT_BYTES,
  MAX_TOTAL_TEXT_PROMPT_BYTES,
  mergeTtsOptions,
  parseSpeakerMapping,
  parseTtsJsonInput,
  parseTurn,
  parseTurnsJson,
  resolveTtsOptions,
  utf8ByteLength,
  validateTtsOptions,
  VOICES,
} from "./lib/tts.ts";
export type {
  AudioEncoding,
  FullSynthesizeRequest,
  JsonInput,
  Logger,
  ResolvedTtsOptions,
  SpeakerMapping,
  SynthesizeRequest,
  TtsFlagOverrides,
  TtsOptions,
  TtsOutputResult,
  TtsRunResult,
  Turn,
} from "./lib/tts.ts";
export {
  randomInterCallDelayMs,
  synthesizeWithBrowser,
} from "./lib/browser.ts";
