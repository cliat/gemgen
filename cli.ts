/**
 * CLI entrypoint for gemgen.
 *
 * @module
 */

import denoConfig from "./deno.json" with { type: "json" };
import { synthesizeWithBrowser } from "./lib/browser.ts";
import {
  parseCompactOrFullJson,
  parseSpeakerMapping,
  parseTurn,
  parseTurnsJson,
  resolveTtsOptions,
  type TtsFlagOverrides,
} from "./lib/tts.ts";

export const VERSION = denoConfig.version;

const TOP_HELP = `gemgen ${VERSION}

Gemini-TTS generation through the Google Cloud Text-to-Speech browser demo.

Usage:
  gemgen tts [options]
  gemgen --json tts [options]

Commands:
  tts    Generate speech audio.

Global options:
  --json       Emit stable JSON to stdout.
  -h, --help   Show help.
  --version    Show version.
`;

const TTS_HELP = `gemgen tts

Usage:
  gemgen tts --text "Hello" --out speech

Options:
  -t, --text <text>                 Text to synthesize.
  -p, --prompt <text>               Style instructions.
  -v, --voice <name>                Gemini voice. Default: Achernar.
  -l, --language <code>             BCP-47 language code. Default: en-US.
  -e, --encoding <value>            LINEAR16, ALAW, MULAW, MP3, OGG_OPUS, PCM. Default: LINEAR16.
  -r, --speaking-rate <number>      Speaking rate, 0.25..2.0. Default: 1.
  -P, --pitch <number>              Pitch, -20..20. Default: 0.
  -g, --volume-gain-db <number>     Volume gain dB, -96..16. Default: 0.
  -s, --sample-rate <hz>            Optional sample rate hertz.
  --profile <id>                    Repeatable audio device profile.
  --speaker <alias=voice>           Repeatable multi-speaker voice mapping.
  --turn <alias:text>               Repeatable structured dialogue turn.
  --turns-file <path>               JSON array of { "speaker": "...", "text": "..." }.
  -i, --input-file <path>           Compact or full JSON input.
  --input-json <json>               Compact or full JSON input.
  -o, --out <path>                  Required output stem. Writes <path>0001.<ext>, then next sequence.
  --json                            Emit stable JSON to stdout.
  -h, --help                        Show help.
`;

type ParsedArgs = {
  command?: string;
  json: boolean;
  help: boolean;
  version: boolean;
  commandArgs: string[];
};

type ParsedTtsArgs = {
  jsonOptions?: TtsFlagOverrides;
  flagOptions: TtsFlagOverrides;
  json: boolean;
};

export async function runCli(args: string[] = Deno.args): Promise<void> {
  const parsed = parseTopLevel(args);

  try {
    if (parsed.version) {
      console.log(VERSION);
      return;
    }

    if (!parsed.command || parsed.help) {
      console.log(TOP_HELP);
      return;
    }

    if (parsed.command !== "tts") {
      throw new Error(`Unknown command "${parsed.command}".`);
    }

    if (
      parsed.commandArgs.includes("-h") || parsed.commandArgs.includes("--help")
    ) {
      console.log(TTS_HELP);
      return;
    }

    const ttsArgs = await parseTtsArgs(parsed.commandArgs, parsed.json);
    const options = resolveTtsOptions(ttsArgs.jsonOptions, ttsArgs.flagOptions);
    const result = await synthesizeWithBrowser(options, (message) => {
      console.error(message);
    });

    if (ttsArgs.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Wrote ${result.out} (${result.bytes} bytes)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (parsed.json || args.includes("--json")) {
      console.error(JSON.stringify({ ok: false, error: { message } }, null, 2));
    } else {
      console.error(`Error: ${message}`);
    }
    Deno.exitCode = 1;
  }
}

function parseTopLevel(args: string[]): ParsedArgs {
  const commandArgs: string[] = [];
  let command: string | undefined;
  let json = false;
  let help = false;
  let version = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!command) {
      if (arg === "--json") {
        json = true;
        continue;
      }
      if (arg === "-h" || arg === "--help") {
        help = true;
        continue;
      }
      if (arg === "--version") {
        version = true;
        continue;
      }
      command = arg;
      continue;
    }
    commandArgs.push(arg);
  }

  return { command, json, help, version, commandArgs };
}

async function parseTtsArgs(
  args: string[],
  inheritedJson: boolean,
): Promise<ParsedTtsArgs> {
  const flagOptions: TtsFlagOverrides = {};
  let inputFile: string | undefined;
  let inputJson: string | undefined;
  let json = inheritedJson;
  const profiles: string[] = [];
  const speakers = [];
  const turns = [];
  let turnsFile: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [name, inlineValue] = splitInlineValue(arg);

    switch (name) {
      case "--json":
        json = true;
        break;
      case "-t":
      case "--text":
        flagOptions.text = readValue(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-p":
      case "--prompt":
        flagOptions.prompt = readValue(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-v":
      case "--voice":
        flagOptions.voice = readValue(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-l":
      case "--language":
        flagOptions.language = readValue(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-e":
      case "--encoding":
        flagOptions.encoding = readValue(
          args,
          ++index,
          name,
          inlineValue,
        ) as TtsFlagOverrides["encoding"];
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-r":
      case "--speaking-rate":
        flagOptions.speakingRate = readNumber(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-P":
      case "--pitch":
        flagOptions.pitch = readNumber(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-g":
      case "--volume-gain-db":
        flagOptions.volumeGainDb = readNumber(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-s":
      case "--sample-rate":
        flagOptions.sampleRateHertz = readNumber(
          args,
          ++index,
          name,
          inlineValue,
        );
        if (inlineValue !== undefined) index -= 1;
        break;
      case "--profile":
        profiles.push(readValue(args, ++index, name, inlineValue));
        if (inlineValue !== undefined) index -= 1;
        break;
      case "--speaker":
        speakers.push(
          parseSpeakerMapping(readValue(args, ++index, name, inlineValue)),
        );
        if (inlineValue !== undefined) index -= 1;
        break;
      case "--turn":
        turns.push(parseTurn(readValue(args, ++index, name, inlineValue)));
        if (inlineValue !== undefined) index -= 1;
        break;
      case "--turns-file":
        turnsFile = readValue(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-i":
      case "--input-file":
        inputFile = readValue(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "--input-json":
        inputJson = readValue(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      case "-o":
      case "--out":
        flagOptions.out = readValue(args, ++index, name, inlineValue);
        if (inlineValue !== undefined) index -= 1;
        break;
      default:
        throw new Error(`Unknown tts option "${arg}".`);
    }
  }

  if (profiles.length > 0) flagOptions.profiles = profiles;
  if (speakers.length > 0) flagOptions.speakers = speakers;
  if (turns.length > 0) flagOptions.turns = turns;

  if (inputFile && inputJson) {
    throw new Error("Use only one of --input-file or --input-json.");
  }
  const jsonOptions = inputFile
    ? parseCompactOrFullJson(await Deno.readTextFile(inputFile))
    : inputJson
    ? parseCompactOrFullJson(inputJson)
    : undefined;

  if (turnsFile) {
    flagOptions.turns = parseTurnsJson(await Deno.readTextFile(turnsFile));
  }

  return { jsonOptions, flagOptions, json };
}

function splitInlineValue(arg: string): [string, string | undefined] {
  if (!arg.startsWith("--")) return [arg, undefined];
  const index = arg.indexOf("=");
  if (index < 0) return [arg, undefined];
  return [arg.slice(0, index), arg.slice(index + 1)];
}

function readValue(
  args: string[],
  index: number,
  name: string,
  inlineValue?: string,
): string {
  if (inlineValue !== undefined) return inlineValue;
  const value = args[index];
  if (value === undefined) throw new Error(`${name} requires a value.`);
  return value;
}

function readNumber(
  args: string[],
  index: number,
  name: string,
  inlineValue?: string,
): number {
  const value = readValue(args, index, name, inlineValue);
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${name} requires a finite number.`);
  }
  return number;
}

if (import.meta.main) {
  await runCli();
  Deno.exit(Deno.exitCode);
}
