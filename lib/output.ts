import type { AudioEncoding } from "./tts.ts";

export type SequencedOutputPath = {
  stem: string;
  path: string;
  extension: string;
  sequence: number;
  width: number;
};

export const AUDIO_EXTENSION_BY_ENCODING: Record<AudioEncoding, string> = {
  LINEAR16: "wav",
  ALAW: "alaw",
  MULAW: "mulaw",
  MP3: "mp3",
  OGG_OPUS: "ogg",
  PCM: "pcm",
};

const KNOWN_AUDIO_EXTENSIONS = new Set(
  Object.values(AUDIO_EXTENSION_BY_ENCODING).concat(["opus"]),
);

export function extensionForEncoding(encoding: AudioEncoding): string {
  return AUDIO_EXTENSION_BY_ENCODING[encoding];
}

export async function resolveSequencedOutputPath(
  requestedStem: string,
  encoding: AudioEncoding,
): Promise<SequencedOutputPath> {
  if (requestedStem.trim() === "") {
    throw new Error("Output path must include a file stem.");
  }

  const stem = stripKnownAudioExtension(requestedStem);
  const { directory, basename } = splitPath(stem);
  if (!basename) throw new Error("Output path must include a file stem.");

  if (directory) await Deno.mkdir(directory, { recursive: true });

  const extension = extensionForEncoding(encoding);
  const pattern = new RegExp(
    `^${escapeRegExp(basename)}(\\d+)\\.${escapeRegExp(extension)}$`,
    "i",
  );
  let maxSequence = 0;
  let width = 4;

  for await (const entry of Deno.readDir(directory || ".")) {
    if (!entry.isFile) continue;
    const match = pattern.exec(entry.name);
    if (!match) continue;
    const sequence = Number(match[1]);
    if (!Number.isSafeInteger(sequence)) continue;
    maxSequence = Math.max(maxSequence, sequence);
    width = Math.max(width, match[1].length);
  }

  const sequence = maxSequence + 1;
  width = Math.max(width, String(sequence).length);
  const numberedName = `${basename}${
    String(sequence).padStart(width, "0")
  }.${extension}`;

  return {
    stem,
    path: joinPath(directory, numberedName),
    extension,
    sequence,
    width,
  };
}

export async function writeSequencedOutput(
  requestedStem: string,
  encoding: AudioEncoding,
  bytes: Uint8Array,
): Promise<SequencedOutputPath> {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const output = await resolveSequencedOutputPath(requestedStem, encoding);
    try {
      await Deno.writeFile(output.path, bytes, { createNew: true });
      return output;
    } catch (error) {
      if (error instanceof Deno.errors.AlreadyExists) continue;
      throw error;
    }
  }

  throw new Error("Could not reserve a unique output path.");
}

function stripKnownAudioExtension(path: string): string {
  const { directory, basename } = splitPath(path);
  const dotIndex = basename.lastIndexOf(".");
  if (dotIndex <= 0) return path;
  const extension = basename.slice(dotIndex + 1).toLowerCase();
  if (!KNOWN_AUDIO_EXTENSIONS.has(extension)) return path;
  return joinPath(directory, basename.slice(0, dotIndex));
}

function splitPath(path: string): { directory: string; basename: string } {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index < 0) return { directory: "", basename: normalized };
  if (index === 0) return { directory: "/", basename: normalized.slice(1) };
  return {
    directory: normalized.slice(0, index),
    basename: normalized.slice(index + 1),
  };
}

function joinPath(directory: string, basename: string): string {
  if (!directory) return basename;
  if (directory.endsWith("/")) return `${directory}${basename}`;
  return `${directory}/${basename}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
