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
- **Everyday life** (4 units): weather and seasons, the market, daily routine, phone calls and texts.
- **Gramatika 2** (6 units): genitive (do/z/bez, amounts), instrumental (s, by car), dative (komu, páči sa mi),
  the future and aspect, plurals, comparatives.
- **Bežný život · Everyday life 2** (5 units): cooking and recipe commands, restaurants (and the Slovak way of
  tipping), meals at home, traffic and driving, errands (post office, bank, queues).
- **Kultúra** (4 units): food traditions, folk culture, places and nature, Slovakia today.
- **História** (4 units): Great Moravia, the Kingdom of Hungary, Czechoslovakia, the Velvet Revolution and independence.
- **Pictures**: concrete words carry an emoji (`"pic"` in course.json), shown on intro cards, in the phrasebook and in a
  "What's this?" picture exercise. Emoji cost zero download size and look sharp on iPhone.
- **Story mode, "Cesta domov"**: ten chapters through Slovakia (airport, meeting the parents, Babka's Sunday lunch,
  Bratislava castle, the Tatras, a hospital, a family wedding). Each unlocks when its units are learned. Chapters are
  interactive scenes where she picks the right Slovak reply. Each ends with a postcard note from Jakub.
- **Learner profiles and progress**: per-learner progress, time and accuracy tracking, and a shareable progress report
  (`report.html`). The data travels inside the link's `#fragment`, so no server is involved.
- **Cesta hrdinov SNP**: progress is walked along the 765 km SNP Heroes' Trail from the Dukla Pass to Devín
  (`app/js/trail.js`): a map with a walking figure, 29 stops with short facts, and new stops announced after
  each session. The trail is the road to **B1**: Devín = ~2,000 well-known words and phrases, with A1 (~600) and
  A2 (~1,200) flags on the way. An item counts half when learned and fully once in long-term memory (FSRS
  stability ≥ 21 days). The walker never goes backwards.
- **Accounts and sync** (Supabase, free tier): email + password sign-in, a profile with avatar, and automatic sync.
  Progress merges across devices without losing anything, and the phone keeps working offline. See "Accounts" below.
- **Spaced repetition** (FSRS-5): every item comes back just before she'd forget it.
- **Recall over recognition**: multiple choice only at first exposure; after that mostly production: **Say it** (say the
  Slovak out loud, reveal, self-grade Missed / Almost / Got it), typing, sentence building, fill-the-gap.
- **Feedback you act on**: after a miss the correct answer is shown (typed mistakes highlight the wrong words), and the
  item returns a few cards later as a recall attempt ("Once more, from memory"), up to twice.
- **Listening without a transcript** (`app/data/practice.json`): 12 two-voice dialogues, each unlocked by its lessons.
  Listen first, answer comprehension questions, then see the transcript. Story scenes have a "listen first" switch (👂).
- **Speaking freely**: 18 open questions answered out loud (record, then compare with a sample answer); one appears
  near the end of a session at most once a day, always skippable.
- **"Change it" drills**: 50 known sentences carry `"variants"` (new word or person). She produces the changed
  sentence, which forces new endings.
- **Visible learning**: a review log feeds a "Remembered a week later" score (reviews ≥ 7 days after the previous one),
  and a can-do list unlocks when a skill's units are learned *and* retained. A daily calendar reminder (.ics) replaces
  push notifications.
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

## Accounts (Supabase)

- `.env` holds `SUPABASE_URL` and `SUPABASE_KEY` (the *publishable* key). `node tools/write-config.mjs` writes them
  into `app/js/config.js`. These values are public by design; the `profiles` table's row-level security means each
  user can only read and write their own row.
- Supabase settings: **Confirm email** is off (sign-up works inside the app). For password resets, set
  Authentication → URL Configuration → **Site URL** to `https://jakubdovcik.github.io/po-slovensky/`.
- `.github/workflows/keepalive.yml` pings the database every 3 days so the free project never pauses.
- Never put the secret / service_role key in the app.

## Private lesson packs

Personal content (e.g. sentences about the learner) must not go in the public repo or site. Put it in
`private/` (git-ignored) as `{"stage": {...}, "units": [...]}` and run:

```
node tools/make-pack.mjs private/about-me.json
```

This writes a link to `private/about-me-link.txt`. The pack travels inside the link's `#fragment` (never sent to
any server). When she opens it, the app saves the units into her own state, which syncs only to her account.
Pack items use the device's Slovak voice, since Azure audio would have to be published on the public site.

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
