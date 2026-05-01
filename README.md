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
gemgen tts --json-template full > full-request.json
deno run -A cli.ts tts --help
```

`--json` prints only the success object to stdout. Progress, CAPTCHA
instructions, and errors go to stderr. `out` is the actual file written, for
example `output0001.wav`.

## Options And JSON

Granular flags override JSON fields. JSON input overrides defaults.
`voice.modelName` is always forced to `gemini-3.1-flash-tts-preview`.

| Flag                            | Compact JSON                              | Full JSON field                                       | Default    | Notes                                                           |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `-t, --text <text>`             | `text`                                    | `input.text`                                          | none       | Text to synthesize. Cannot be combined with structured turns.   |
| `-p, --prompt <text>`           | `prompt`                                  | `input.prompt`                                        | none       | Style instructions.                                             |
| `-v, --voice <name>`            | `voice`                                   | `voice.name`                                          | `Achernar` | Single-speaker voice.                                           |
| `-l, --language <code>`         | `language`, `languageCode`                | `voice.languageCode`                                  | `en-US`    | BCP-47 code.                                                    |
| `-e, --encoding <value>`        | `encoding`, `audioEncoding`               | `audioConfig.audioEncoding`                           | `LINEAR16` | `LINEAR16`, `ALAW`, `MULAW`, `MP3`, `OGG_OPUS`, `PCM`.          |
| `-r, --speaking-rate <number>`  | `speakingRate`                            | `audioConfig.speakingRate`                            | `1`        | Range `0.25..2.0`.                                              |
| `-P, --pitch <number>`          | `pitch`                                   | `audioConfig.pitch`                                   | `0`        | Range `-20..20`.                                                |
| `-g, --volume-gain-db <number>` | `volumeGainDb`                            | `audioConfig.volumeGainDb`                            | `0`        | Range `-96..16`.                                                |
| `-s, --sample-rate <hz>`        | `sampleRate`, `sampleRateHertz`           | `audioConfig.sampleRateHertz`                         | omitted    | Positive integer hertz.                                         |
| `--profile <id>`                | `profile`, `profiles`, `effectsProfileId` | `audioConfig.effectsProfileId[]`                      | `[]`       | Repeatable; applied in order.                                   |
| `--speaker <alias=voice>`       | `speaker`, `speakers`                     | `voice.multiSpeakerVoiceConfig.speakerVoiceConfigs[]` | `[]`       | Repeatable; alias must be alphanumeric.                         |
| `--turn <alias:text>`           | `turns[]`                                 | `input.multiSpeakerMarkup.turns[]`                    | `[]`       | Repeatable structured dialogue turn.                            |
| `--turns-file <path>`           | n/a                                       | n/a                                                   | omitted    | JSON array of `{ "speaker": "...", "text": "..." }`.            |
| `-i, --input-file <path>`       | compact object                            | full request object                                   | omitted    | Reads compact or full JSON.                                     |
| `--input-json <json>`           | compact object                            | full request object                                   | omitted    | Inline compact or full JSON.                                    |
| `--json-template [compact       | full]`                                    | n/a                                                   | n/a        | omitted                                                         |
| `-o, --out <path>`              | `out`                                     | `out`                                                 | required   | Output stem. Creates parent dirs and writes next numbered file. |
| `--json`                        | n/a                                       | n/a                                                   | false      | Stable JSON success output.                                     |

`--profile` maps to `audioConfig.effectsProfileId`. `--speaker Sam=Kore` maps
alias `Sam` to Gemini voice `Kore`. `--turn Sam:Hello` appends
`{ "speaker": "Sam", "text": "Hello" }`. `--turns-file turns.json` replaces
repeated `--turn` values with a JSON array.

`--out path/to/file` scans for `path/to/fileNNNN.<ext>`, creates the parent
directory if needed, and writes the next number. If `path/to/file0004.wav`
exists, `-e LINEAR16 --out path/to/file` writes `path/to/file0005.wav`. Known
audio extensions on `--out` are stripped, so `--out speech.wav` still uses the
stem `speech`.

`--json-template` prints a compact JSON example. `--json-template full` prints
the full request-shaped example. Edit the output and pass it back with
`--input-file`.

## Examples

```bash
gemgen tts -t "Welcome aboard." -p "Read in a warm narration voice." -v Achernar -o warm
gemgen tts -t "The glacier moved a few inches each day." -p "Calm documentary narrator." -v Charon -e MP3 -o doc
gemgen tts -t "[whispering] The door is open." -p "Whisper a warning." -v Kore -o warning
gemgen tts -t "[extremely fast] Terms apply. See store for details." -p "Fast disclaimer." -r 1.8 -o disclaimer
gemgen tts --speaker Sam=Kore --speaker Bob=Charon --turn "Sam:Did you hear that?" --turn "Bob:[laughing] I did." -p "Amused conversation." -o chat
gemgen tts --json-template > request.json
gemgen tts -i request.json
gemgen tts --input-json '{"text":"Hello [short pause] again.","prompt":"Gentle assistant.","audioEncoding":"MP3","out":"hello"}'
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
