# gemgen Commands

Run locally:

```bash
deno run -A cli.ts tts --text "Hello" --out speech
deno run -A cli.ts --json tts -t "Hello" -p "Read warmly." -v Achernar -l en-US -e LINEAR16 -o output
```

Run from JSR:

```bash
deno x -A jsr:@cliat/gemgen/cli tts --text "Hello" --out speech
deno x -A jsr:@cliat/gemgen/cli --json tts -t "Hello" -o output
```

Install from JSR:

```bash
deno install -g -A -n gemgen jsr:@cliat/gemgen/cli
gemgen tts --text "Hello" --out speech
```

Install browser if needed:

```bash
deno run -A npm:playwright@1.52.0 install chromium
```

Single speaker:

```bash
gemgen tts -t "Welcome to the briefing." -p "Warm narration." -v Achernar -l en-US -o briefing
gemgen tts -t "The reef glowed under moonlight." -p "Calm documentary voice." -v Charon -e MP3 -o reef
gemgen tts -t "[whispering] Someone is outside." -p "Whispered warning." -v Kore -o warning
```

Multi-speaker:

```bash
gemgen tts --speaker Sam=Kore --speaker Bob=Charon --turn "Sam:Are you ready?" --turn "Bob:[laughing] Absolutely." -p "Friendly, amused conversation." -o dialogue
gemgen tts --speaker Host=Achernar --speaker Guest=Puck --turns-file turns.json -p "Two-speaker interview." -o interview
```

JSON input:

```bash
gemgen tts --input-json '{"text":"Hello [short pause] again.","prompt":"Gentle assistant.","voice":"Aoede","encoding":"MP3","out":"hello"}'
gemgen tts -i request.json -o speech
```

Audio profiles:

```bash
gemgen tts -t "Your call is important to us." --profile telephony-class-application -e MULAW -o ivr
gemgen tts -t "Navigation starts now." --profile large-automotive-class-device --profile handset-class-device -o nav
```

Validation:

```bash
deno task check
deno task test
deno publish --dry-run --allow-dirty
deno run -A cli.ts --help
deno run -A cli.ts tts --help
```

Rules:

- Use `--json` when parsing output.
- `--out path/to/file` writes the next `path/to/fileNNNN.<ext>` and creates the
  parent directory.
- CAPTCHA instructions appear on stderr; solve them in the visible browser.
- `voice.modelName` is always `gemini-3.1-flash-tts-preview`.
- `temperature` is Vertex-only and is not exposed in this v1 public page flow.
