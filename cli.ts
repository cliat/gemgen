/**
 * CLI entrypoint for gemgen.
 *
 * @module
 */

import denoConfig from "./deno.json" with { type: "json" };
import { synthesizeWithBrowser } from "./lib/browser.ts";
import {
  createTtsJsonTemplate,
  parseSpeakerMapping,
  parseTtsJsonInput,
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
  --start-at <number>               Start at 1-based JSON input.text item. Default: 1.
  -i, --input <path>                Full JSON input file. input.text is an array.
  --json-template                   Print a full JSON template/example and exit.
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
  jsonTemplate?: boolean;
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
    if (ttsArgs.jsonTemplate) {
      console.log(
        JSON.stringify(createTtsJsonTemplate(), null, 2),
      );
      return;
    }

    const options = resolveTtsOptions(ttsArgs.jsonOptions, ttsArgs.flagOptions);
    const result = await synthesizeWithBrowser(options, (message) => {
      console.error(message);
    });

    if (ttsArgs.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.outputs.length > 1) {
      for (const output of result.outputs) {
        console.log(`Wrote ${output.out} (${output.bytes} bytes)`);
      }
    } else {
      const output = result.outputs[0];
      console.log(`Wrote ${output.out} (${output.bytes} bytes)`);
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
  let inputPath: string | undefined;
  let json = inheritedJson;
  const profiles: string[] = [];
  const speakers = [];
  const turns = [];
  let turnsFile: string | undefined;
  let jsonTemplate = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [name, inlineValue] = splitInlineValue(arg);
    const readString = () => {
      if (inlineValue !== undefined) return inlineValue;
      return readValue(args, ++index, name);
    };
    const readNumeric = () => {
      const value = readString();
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw new Error(`${name} requires a finite number.`);
      }
      return number;
    };

    switch (name) {
      case "--json":
        json = true;
        break;
      case "-t":
      case "--text":
        flagOptions.text = readString();
        break;
      case "-p":
      case "--prompt":
        flagOptions.prompt = readString();
        break;
      case "-v":
      case "--voice":
        flagOptions.voice = readString();
        break;
      case "-l":
      case "--language":
        flagOptions.language = readString();
        break;
      case "-e":
      case "--encoding":
        flagOptions.encoding = readString() as TtsFlagOverrides["encoding"];
        break;
      case "-r":
      case "--speaking-rate":
        flagOptions.speakingRate = readNumeric();
        break;
      case "-P":
      case "--pitch":
        flagOptions.pitch = readNumeric();
        break;
      case "-g":
      case "--volume-gain-db":
        flagOptions.volumeGainDb = readNumeric();
        break;
      case "-s":
      case "--sample-rate":
        flagOptions.sampleRateHertz = readNumeric();
        break;
      case "--profile":
        profiles.push(readString());
        break;
      case "--speaker":
        speakers.push(parseSpeakerMapping(readString()));
        break;
      case "--turn":
        turns.push(parseTurn(readString()));
        break;
      case "--turns-file":
        turnsFile = readString();
        break;
      case "--start-at":
        flagOptions.startAt = readNumeric();
        break;
      case "-i":
      case "--input":
        inputPath = readString();
        break;
      case "--json-template": {
        if (inlineValue !== undefined) {
          throw new Error("--json-template does not take a value.");
        }
        const nextArg = args[index + 1];
        if (nextArg !== undefined && !nextArg.startsWith("-")) {
          throw new Error("--json-template does not take a value.");
        }
        jsonTemplate = true;
        break;
      }
      case "-o":
      case "--out":
        flagOptions.out = readString();
        break;
      default:
        throw new Error(`Unknown tts option "${arg}".`);
    }
  }

  if (profiles.length > 0) flagOptions.profiles = profiles;
  if (speakers.length > 0) flagOptions.speakers = speakers;
  if (turns.length > 0) flagOptions.turns = turns;

  const jsonOptions = inputPath
    ? parseTtsJsonInput(await Deno.readTextFile(inputPath))
    : undefined;

  if (turnsFile) {
    flagOptions.turns = parseTurnsJson(await Deno.readTextFile(turnsFile));
  }

  return { jsonOptions, flagOptions, json, jsonTemplate };
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
): string {
  const value = args[index];
  if (value === undefined) throw new Error(`${name} requires a value.`);
  return value;
}

if (import.meta.main) {
  await runCli();
  Deno.exit(Deno.exitCode);
}
