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
  createTtsJsonTemplate,
  decodeAudioContent,
  ENCODINGS,
  GEMINI_TTS_MODEL,
  isFullSynthesizeRequest,
  LANGUAGES,
  MARKUP_TAGS,
  mergeTtsOptions,
  parseCompactOrFullJson,
  parseSpeakerMapping,
  parseTurn,
  parseTurnsJson,
  resolveTtsOptions,
  validateTtsOptions,
  VOICES,
} from "./lib/tts.ts";
export type {
  AudioEncoding,
  CompactJsonInput,
  FullSynthesizeRequest,
  JsonInput,
  Logger,
  ResolvedTtsOptions,
  SpeakerMapping,
  TtsFlagOverrides,
  TtsJsonTemplateKind,
  TtsOptions,
  TtsRunResult,
  Turn,
} from "./lib/tts.ts";
export { synthesizeWithBrowser } from "./lib/browser.ts";
