# Po slovensky

A gentle Slovak course for an English speaker, built as a home-screen web app for iPhone.
There's no build step and no dependencies: plain HTML/CSS/JS in `app/`.

## How it teaches

- **Sounds first** (7 units): Slovak is spelled the way it sounds, so she learns to read any word aloud.
- **Ear training**: quick "which did you hear?" drills on contrasts like *pas / pás*, *byt / byť*, *koza / koža*, using multiple voices.
- **Survival phrases** (9 units, ~140 items): greetings, family, food, love, numbers, time, getting around.
- **Grammar basics** (8 units): byť, gender agreement, present tense, accusative, past tense, v/na + locative,
  negation and questions, modal verbs. Each unit opens with a short lesson, then fill-the-gap practice in real sentences.
- **In the clinic** (6 units, psychiatry): hospital vocabulary, opening an interview, mood and emotions, sleep and
  appetite, risk assessment, treatment and medication instructions. Mixed into daily lessons by default
  (every third new item, after the Sounds stage). This can be turned off in Settings.
- **Celebrations** (3 units): holidays and name days, the wedding, toasts and drinking etiquette.
- **Story mode, "Cesta domov"**: ten chapters through Slovakia (airport, meeting the parents, Babka's Sunday lunch,
  Bratislava castle, the Tatras, a hospital, a family wedding). Each unlocks when its units are learned. Chapters are
  interactive scenes where she picks the right Slovak reply. Each ends with a postcard note from Jakub.
- **Learner profiles and progress**: per-learner progress, time and accuracy tracking, and a shareable progress report
  (`report.html`). The data travels inside the link's `#fragment`, so no server is involved.
- **Spaced repetition** (FSRS-5): every item comes back just before she'd forget it.
- **Recall over recognition**: exercises move from multiple choice → sentence building → typing as each memory gets stronger.
- **Not annoying**: no hearts, no streak guilt, a capped daily session, typing that tolerates missing accents, and a "can't type right now" escape hatch.

## Adding or editing content

Everything is in [`app/data/course.json`](app/data/course.json). Each item:

```json
{ "id": "w_mama", "sk": "mama", "en": "mom", "g": "f", "note": "optional tip" }
```

`g` is the gender (`m`, `f`, `n`, `pl`). `alt` lists other accepted answers. Grammar items add
`"blank"` (the part of the sentence to fill in) and `"choices"` (including the right one). After editing, re-run the
audio script; it only generates files for new strings.

## Personalising the story

Edit [`app/data/story.json`](app/data/story.json):

- `config.partner`: your name, used throughout the story.
- `config.hometown`: your hometown (chapter 2 takes place there).
- Each chapter's `postcard`: your note to her. Replace these with your own words.
- Character names (e.g. `"Teta Zuzka"`) and lines can be changed freely. Re-run the audio script after changing
  Slovak lines.

In the text, `{partner}`, `{name}` (the learner) and `{hometown}` are filled in automatically.

## Adding units

Write the new units in a JSON file (`{"stages": [...], "units": [...]}`), then:

```
node tools/add-units.mjs my-new-units.json
node tools/generate-audio.mjs
```

## Audio (Azure, free tier)

1. In the Azure portal, create a **Speech** resource, picking the **Free F0** pricing tier and a region such as West Europe.
2. Copy **Key 1** and the region into a `.env` file in this folder:

   ```
   AZURE_SPEECH_KEY=your-key
   AZURE_SPEECH_REGION=westeurope
   ```

3. Run `node tools/generate-audio.mjs`. That's about 600 files and ~4,000 characters, well under the
   500,000 free characters per month. It takes about 30 minutes because it's throttled for the free tier.

Without audio files the app falls back to the iPhone's built-in Slovak voice.

## Running locally

```
python3 -m http.server 8765 --directory app
```

## Deploying

Any static host works (GitHub Pages, Netlify, Cloudflare Pages). On her iPhone, open the URL in
Safari, then tap **Share → Add to Home Screen**. When you update files, bump `SHELL` in `app/sw.js`
so installed copies pick up the change.
