# gemgen

Gemini-TTS CLI for the Google Cloud Text-to-Speech public browser demo. v1 has
one command, `gemgen tts`, and always forces `voice.modelName` to
`gemini-3.1-flash-tts-preview`.

```bash
deno run -A cli.ts tts --text "Hello" --out speech
```

Run or install from JSR after publishing:

```bash
deno x -A jsr:@cliat/gemgen/cli tts --text "Hello" --out speech
deno install -g -A -n gemgen jsr:@cliat/gemgen/cli
```

The command launches headed Chromium every run, opens
`https://cloud.google.com/text-to-speech`, uses the embedded demo context, waits
for any CAPTCHA in the visible browser, decodes `audioContent`, writes the next
sequenced file for `--out`, and closes the browser. Run once before first use if
Chromium is missing:

```bash
deno run -A npm:playwright@1.52.0 install chromium
```

## Commands

```bash
gemgen tts --text "Hello" --out speech
gemgen --json tts -t "Hello" -p "Read warmly." -v Achernar -l en-US -e LINEAR16 -o output
deno x -A jsr:@cliat/gemgen/cli --json tts -t "Hello" -o output
gemgen tts --json-template > request.json
gemgen tts -i request.json -o speech
deno run -A cli.ts tts --help
```

`--json` prints one stable success object to stdout. Progress, CAPTCHA
instructions, and errors go to stderr. `outputs[]` lists every file written.

## Options And JSON

Granular flags override JSON fields. JSON input overrides defaults. `--out` is
CLI-only and is never read from JSON. `input.text` is an array in JSON; each
string is submitted as a separate service call with the same settings. `--text`
accepts one string and overrides JSON text. gemgen waits 5-10 seconds before
each next service call.

| Flag                            | JSON field                                            | Default    | Notes                                                                                                |
| ------------------------------- | ----------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `-t, --text <text>`             | `input.text[]`                                        | none       | CLI accepts one string. JSON accepts a non-empty string array. Cannot combine with structured turns. |
| `-p, --prompt <text>`           | `input.prompt`                                        | omitted    | Style instructions.                                                                                  |
| `-v, --voice <name>`            | `voice.name`                                          | `Achernar` | Single-speaker Gemini voice.                                                                         |
| `-l, --language <code>`         | `voice.languageCode`                                  | `en-US`    | BCP-47 language code.                                                                                |
| n/a                             | `voice.modelName`                                     | forced     | Always sent as `gemini-3.1-flash-tts-preview`. JSON values are ignored.                              |
| `-e, --encoding <value>`        | `audioConfig.audioEncoding`                           | `LINEAR16` | `LINEAR16`, `ALAW`, `MULAW`, `MP3`, `OGG_OPUS`, `PCM`.                                               |
| `-r, --speaking-rate <number>`  | `audioConfig.speakingRate`                            | `1`        | Range `0.25..2.0`.                                                                                   |
| `-P, --pitch <number>`          | `audioConfig.pitch`                                   | `0`        | Range `-20..20`.                                                                                     |
| `-g, --volume-gain-db <number>` | `audioConfig.volumeGainDb`                            | `0`        | Range `-96..16`.                                                                                     |
| `-s, --sample-rate <hz>`        | `audioConfig.sampleRateHertz`                         | omitted    | Positive integer hertz.                                                                              |
| `--profile <id>`                | `audioConfig.effectsProfileId[]`                      | `[]`       | Repeatable; applied in order.                                                                        |
| `--speaker <alias=voice>`       | `voice.multiSpeakerVoiceConfig.speakerVoiceConfigs[]` | `[]`       | Repeatable; alias must be alphanumeric. JSON uses `{ "speakerAlias": "...", "speakerId": "..." }`.   |
| `--turn <alias:text>`           | `input.multiSpeakerMarkup.turns[]`                    | `[]`       | Repeatable structured dialogue turn. JSON uses `{ "speaker": "...", "text": "..." }`.                |
| `--turns-file <path>`           | n/a                                                   | omitted    | JSON array of `{ "speaker": "...", "text": "..." }`; replaces repeated `--turn` values.              |
| `-i, --input-file <path>`       | full request object                                   | omitted    | Reads JSON shaped like `--json-template`.                                                            |
| `--input-json <json>`           | full request object                                   | omitted    | Inline full JSON.                                                                                    |
| `--json-template`               | n/a                                                   | n/a        | Prints a full JSON template/example and exits.                                                       |
| `-o, --out <path>`              | n/a                                                   | required   | Output stem. Creates parent dirs and writes the next numbered file.                                  |
| `--json`                        | n/a                                                   | false      | Stable JSON success output.                                                                          |

`--profile` maps to `audioConfig.effectsProfileId`. `--speaker Sam=Kore` maps
alias `Sam` to Gemini voice `Kore`. `--turn Sam:Hello` appends
`{ "speaker": "Sam", "text": "Hello" }`. `--turns-file turns.json` reads the
same array shape used by `input.multiSpeakerMarkup.turns`.

`--out path/to/file` scans for `path/to/fileNNNN.<ext>`, creates the parent
directory if needed, and writes the next number. If `path/to/file0004.wav`
exists, `-e LINEAR16 --out path/to/file` writes `path/to/file0005.wav`. Known
audio extensions on `--out` are stripped, so `--out speech.wav` still uses the
stem `speech`.

## JSON Template

```bash
gemgen tts --json-template > request.json
gemgen tts -i request.json -o speech
```

Template JSON has no output path. Defaults target falling-asleep videos:
uncompressed `LINEAR16`, 48 kHz, neutral audio with no device profile, and a
calm soothing narration prompt.

```json
{
  "input": {
    "text": [
      "Paste the first narration segment here.",
      "Paste the next narration segment here."
    ],
    "prompt": "Calm, soothing narration. Slow gentle pacing, soft warmth, relaxed clarity, and peaceful pauses."
  },
  "voice": {
    "languageCode": "en-US",
    "name": "Achernar",
    "modelName": "gemini-3.1-flash-tts-preview"
  },
  "audioConfig": {
    "audioEncoding": "LINEAR16",
    "speakingRate": 1,
    "pitch": 0,
    "volumeGainDb": 0,
    "sampleRateHertz": 48000
  }
}
```

`--json` output:

```json
{
  "ok": true,
  "command": "tts",
  "modelName": "gemini-3.1-flash-tts-preview",
  "outputs": [
    { "out": "speech0001.wav", "bytes": 12345, "index": 1 }
  ]
}
```

## Examples

```bash
gemgen tts -t "Welcome aboard." -p "Warm narration with a gentle smile." -v Achernar -o warm
gemgen tts -t "The glacier moved a few inches each day." -p "Calm documentary voice." -v Charon -e MP3 -o doc
gemgen tts -t "[whispering] The door is open." -p "Whispered warning." -v Kore -o warning
gemgen tts -t "[extremely fast] Terms apply. See store for details." -p "Fast disclaimer." -r 1.8 -o disclaimer
gemgen tts --speaker Sam=Kore --speaker Bob=Charon --turn "Sam:Did you hear that?" --turn "Bob:[laughing] I did." -p "Amused conversation between two friends." -o chat
gemgen tts --speaker Host=Achernar --speaker Guest=Puck --turn "Host:Welcome back." --turn "Guest:Good to be here." -p "Two-speaker dialogue, relaxed interview." -o interview
gemgen tts --json-template > request.json
gemgen tts -i request.json -o batch
gemgen tts --input-json '{"input":{"text":["Hello [short pause] again."],"prompt":"Gentle assistant."},"voice":{"name":"Aoede","languageCode":"en-US"},"audioConfig":{"audioEncoding":"MP3"}}' -o hello
gemgen tts -t "Support is available now." --profile telephony-class-application -e MULAW -o phone
```

`temperature` is Vertex-only in the Gemini-TTS docs and is not exposed in this
public page/form v1 flow.

## Values

Voices: `Achernar`, `Achird`, `Algenib`, `Algieba`, `Alnilam`, `Aoede`,
`Autonoe`, `Callirrhoe`, `Charon`, `Despina`, `Enceladus`, `Erinome`, `Fenrir`,
`Gacrux`, `Iapetus`, `Kore`, `Laomedeia`, `Leda`, `Orus`, `Pulcherrima`, `Puck`,
`Rasalgethi`, `Sadachbia`, `Sadaltager`, `Schedar`, `Sulafat`, `Umbriel`,
`Vindemiatrix`, `Zephyr`, `Zubenelgenubi`.

Languages: `ar-EG`, `bn-BD`, `nl-NL`, `en-IN`, `en-US`, `fr-FR`, `de-DE`,
`hi-IN`, `id-ID`, `it-IT`, `ja-JP`, `ko-KR`, `mr-IN`, `pl-PL`, `pt-BR`, `ro-RO`,
`ru-RU`, `es-ES`, `ta-IN`, `te-IN`, `th-TH`, `tr-TR`, `uk-UA`, `vi-VN`, `af-ZA`,
`sq-AL`, `am-ET`, `ar-001`, `hy-AM`, `az-AZ`, `eu-ES`, `be-BY`, `bg-BG`,
`my-MM`, `ca-ES`, `ceb-PH`, `cmn-CN`, `cmn-tw`, `hr-HR`, `cs-CZ`, `da-DK`,
`en-AU`, `en-GB`, `et-EE`, `fil-PH`, `fi-FI`, `fr-CA`, `gl-ES`, `ka-GE`,
`el-GR`, `gu-IN`, `ht-HT`, `he-IL`, `hu-HU`, `is-IS`, `jv-JV`, `kn-IN`,
`kok-IN`, `lo-LA`, `la-VA`, `lv-LV`, `lt-LT`, `lb-LU`, `mk-MK`, `mai-IN`,
`mg-MG`, `ms-MY`, `ml-IN`, `mn-MN`, `ne-NP`, `nb-NO`, `nn-NO`, `or-IN`, `ps-AF`,
`fa-IR`, `pt-PT`, `pa-IN`, `sr-RS`, `sd-IN`, `si-LK`, `sk-SK`, `sl-SI`,
`es-419`, `es-MX`, `sw-KE`, `sv-SE`, `ur-PK`.

Encodings: `LINEAR16`, `ALAW`, `MULAW`, `MP3`, `OGG_OPUS`, `PCM`. Output
extensions: `LINEAR16` -> `.wav`, `ALAW` -> `.alaw`, `MULAW` -> `.mulaw`, `MP3`
-> `.mp3`, `OGG_OPUS` -> `.ogg`, `PCM` -> `.pcm`.

Audio profiles: `wearable-class-device`, `handset-class-device`,
`headphone-class-device`, `small-bluetooth-speaker-class-device`,
`medium-bluetooth-speaker-class-device`,
`large-home-entertainment-class-device`, `large-automotive-class-device`,
`telephony-class-application`.

Markup tags: `[sigh]`, `[laughing]`, `[uhm]`, `[sarcasm]`, `[robotic]`,
`[shouting]`, `[whispering]`, `[extremely fast]`, `[scared]`, `[curious]`,
`[bored]`, `[short pause]`, `[medium pause]`, `[long pause]`.

## Develop

```bash
deno task check
deno task test
deno publish --dry-run --allow-dirty
deno publish
deno run -A cli.ts --help
deno run -A cli.ts tts --help
```

Sources for option lists: Google Cloud Gemini-TTS docs and audio profile docs,
checked May 1, 2026.
