<p align="center">
  <img src="./static/icons/icon-512.png" width="180" alt="Fritz logo">
</p>

# Fritz

**A local-first German learning PWA I originally made for my sister.**

My sister needs German for school, so I brought her vocabulary, grammar, listening,
conversation, and reading into one app. Fritz uses a spaced-repetition algorithm and
recent mistakes to decide what she should practise today.

The app is open source because the same setup may be useful to other learners. Fritz is
not a hosted, multi-user service: its intended deployment is one private instance with
one server account. Installing that instance as a PWA is optional but recommended.

_Czech or English → German · daily plans of 5, 10, or 20 minutes · core study works
offline after setup_

[Features](#features) · [How it is meant to run](#how-fritz-is-meant-to-run) ·
[Quick start](#quick-start-with-docker) · [Install the PWA](#install-fritz-as-a-pwa) ·
[AI setup](#enable-live-ai-optional)

> [!IMPORTANT]
> Fritz is an early beta designed for one private learner per deployment. Study data is
> stored in the browser, not in a cloud account. Make regular encrypted backups from
> **Settings**.

## Features

### Learning modes

- **Daily lesson:** builds a 5-, 10-, or 20-minute plan from due words, weaker skills,
  current course content, recent mistakes, and an optional school-test tag. Each
  completed activity is saved and the plan resumes after a reload.
- **Long-term vocabulary:** FSRS plans when each vocabulary card should return.
- **Test sprint:** 5–180 minutes of focused practice, optionally filtered by tag,
  without moving FSRS dates or changing long-term skill estimates. Attempts still
  appear in history and can award reduced XP.
- **Course:** 120 chapters and 960 path nodes from beginner A1.1 to advanced C1.2.
- **Grammar:** 125 short lessons with explanations, search, filters, saved progress,
  and star scores.
- **Listening:** German playback and dictation, including normal and slower playback in
  course dictations, plus an editable transcript when browser speech input is used.
- **Conversation:** 96 guided situations with a goal, word bank, hints, and feedback.
- **Reading:** 25 guided reading selections, 227 episodes, glossaries, exercises, and
  saved progress.

<details>
<summary><strong>What the counts and “saved” claims mean</strong></summary>

The current built-in catalogs are checked by the repository's content tests and by
`pnpm content:counts:check`:

- the 960 course items are path nodes, not 960 individual questions; a node can contain
  several prompts;
- the 25-entry reading catalog contains curated selections and graded adaptations; an
  entry is not necessarily a complete book;
- daily-plan completion is saved after each finished activity. Text in a currently open,
  unsubmitted answer is not a draft and can be lost on reload;
- Czech and English are the two supported learner languages for the built-in UI and
  content. German remains the target language.

</details>

### Exercise styles

| Style           | What it practises                             |
| --------------- | --------------------------------------------- |
| Typing          | Recalling the German word, including articles |
| Multiple choice | Recognising the correct answer                |
| Flashcards      | Revealing and rating an answer                |
| Word order      | Building German phrases and sentences         |
| Fill-in         | Completing words, plurals, or verb forms      |
| My own sentence | Using a word in a new sentence                |
| Matching        | Connecting German with Czech or English       |
| Speaking        | Saying an answer and checking the transcript  |

Exercise styles can be enabled individually. At least one generally available style
(typing, flashcards, fill-in, or speaking) must remain enabled. Fritz then chooses among
the suitable enabled styles using the word's data, context, recent answers, FSRS state,
and the last exercise.

<details>
<summary><strong>Why Fritz may use a fallback exercise</strong></summary>

Some styles need more information than a single word provides: multiple choice and
matching need enough alternatives, word order needs a usable sentence, and **My own
sentence** needs the Fritz AI endpoint (demo or live). Speaking always offers editable
text input when browser speech recognition is missing or fails. If a preferred style is
not valid for the current card, Fritz selects another enabled style.

</details>

### More included tools

- personal vocabulary with articles, plurals, verb forms, examples, notes, memory
  aids, levels, and tags;
- manual and batch import with preview, plus a searchable vocabulary library;
- a school-test plan with a date, readiness score, risky words, a daily target, and a
  tag-filtered sprint;
- AI-assisted vocabulary creation, extraction, sentence checks, explanations, hints,
  context exercises, and reading help, using either server-side demo responses or an
  optional live provider;
- XP, levels, streaks, missions, badges, mastery, and reports; game-progress feedback
  and celebrations can be hidden without disabling scheduling, history, or mastery;
- plain or encrypted backups, restore preview, and an in-memory rollback that remains
  available until the page reloads or another destructive change replaces it;
- keyboard navigation, visible focus, screen-reader messages, safe areas, and reduced
  motion.

## How Fritz is meant to run

Fritz is a single-user, self-hosted app: run one private server, create its one account,
then use it in a browser or as a PWA. There is no public sign-up, cloud sync, subscription,
or classroom account.

| Data                                        | Where it lives                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Username, password hash, and session hashes | Development `data/auth.json`, or `/data/auth.json` in the persistent Docker volume      |
| Vocabulary, progress, settings, and history | IndexedDB in the current browser profile and origin                                     |
| AI provider keys                            | Server environment only                                                                 |
| Session                                     | An `HttpOnly`, `SameSite=Strict` cookie in the current browser                          |
| Backups                                     | A plain JSON export or an AES-256-GCM encrypted JSON envelope downloaded by the learner |

Each browser profile and origin has its own IndexedDB. Move progress with an encrypted
backup from **Settings**; signing in on another device does not sync it.

<details>
<summary><strong>Login and offline access</strong></summary>

Online, the account gates the app and API. Passwords use scrypt hashes; session tokens
are hashed, and the cookie is `Secure` on HTTPS. Offline, the cached shell cannot
revalidate the session. Login is therefore not device encryption—protect the browser
profile and device itself.

</details>

## Quick start with Docker

For a fresh checkout:

```bash
cp .env.docker.example .env
docker compose up --build -d
docker compose exec app node scripts/account-create.mjs
```

> On an existing deployment, merge new variables into `.env`; do not overwrite its
> secrets. The account script requires a 12+ character password and refuses to replace
> an existing account.

Open <http://localhost:3000>, sign in, and complete onboarding.

<details>
<summary><strong>Health and logs</strong></summary>

```bash
docker compose ps
curl -fsS http://localhost:3000/healthz
docker compose logs -f app
```

</details>

Stop without deleting the account volume: `docker compose down`.

> [!CAUTION]
> `docker compose down -v` removes the server account volume. Browser study data remains,
> but you will need to create the account again.

## Install Fritz as a PWA

The manifest, icons, standalone mode, and service worker are already included; no mobile
build is needed.

### 1. Give the app a stable HTTPS address

A PWA needs a
[secure context](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable):
use `localhost` on the same computer or HTTPS for a real deployment. Set its exact public
address:

```dotenv
FRITZ_PORT=3000
ORIGIN=https://fritz.example.com
```

```bash
docker compose up --build -d
```

Proxy to port 3000, preserve `Set-Cookie`, and do not cache `/api/*`. A static host alone
cannot provide login or AI.

### 2. Prime offline mode

Sign in at the final URL while online, let the page load, then launch the installed app
online once before testing airplane mode.

### 3. Add it to the device

- **[iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios):** Safari →
  **Share → Add to Home Screen → Open as Web App → Add**.
- **[iPad](https://support.apple.com/guide/ipad/open-as-web-app-ipad8f1f7a29/ipados):**
  Safari → **Share → More → Add to Home Screen → Open as Web App → Add**.
- **[Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en):**
  Chrome → **More → Install and create shortcut → Install**.
- **[Desktop Chrome](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=en):**
  install icon, or **More → Cast, save, and share → Install page as app**.

<details>
<summary><strong>Exactly what “works offline” means</strong></summary>

- **Offline:** bundled content, IndexedDB progress, local planning, non-AI text exercises,
  FSRS, and backups.
- **Online:** login, all demo/live AI routes, and therefore the daily conversation step.
- **Device-dependent:** speech recognition and speech synthesis. No reviewed recordings
  are bundled yet.

</details>

## Enable live AI (optional)

No key is required: the default mode returns deterministic demo responses from the Fritz
server without contacting an external AI provider. Demo AI is not offline.

Live AI requires `AI_SPONSORED_MODE=private` and a server-side key. The flag does not
prove that a deployment is private. Keys never enter the browser, backups, or client
bundle.

### Google Gemini

Create a key in [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key), then
set:

```dotenv
AI_SPONSORED_MODE=private
GEMINI_API_KEY=your-server-side-key
AI_MODEL=gemini-3.6-flash
```

```bash
docker compose up -d
```

Gemini needs `private` mode and a non-empty key; `AI_MODEL` is optional. With no usable
provider, Fritz uses demo mode. An invalid non-empty Gemini key fails without a demo
fallback. The default model is
[`gemini-3.6-flash`](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash).
Never prefix a key with `PUBLIC_` or commit it. Provider usage may be billed.

### Trusted OpenAI-compatible provider

For a trusted OpenAI-compatible endpoint:

```dotenv
AI_SPONSORED_MODE=private
INKLING_API_KEY=your-server-side-key
INKLING_BASE_URL=https://ai.example.com/v1
INKLING_MODEL=provider/model-name
INKLING_ALLOWED_HOSTS=ai.example.com
TRUST_CUSTOM_AI_PROVIDER=false
```

- URL: HTTPS with exactly `/v1` or `/v1/`; no credentials, query, or fragment.
- Trust: allowlist the host. Set `TRUST_CUSTOM_AI_PROVIDER=true` only when accepting that
  the endpoint receives the key and learning content.
- Selection: Gemini wins when both providers are configured; there is no fallback.

<details>
<summary><strong>What a live AI request can contain</strong></summary>

Live prompts may include pasted source text, selected vocabulary, a learner sentence,
current conversation turns, mistake tags, or story context. Fritz does not upload the
whole database or a backup. The provider's own retention and billing terms still apply.

</details>

To disable external AI, set `AI_SPONSORED_MODE=off` and recreate the container.

## Local development without Docker

Requires Node.js 22.13+ and pnpm 11.20:

```bash
npm install --global pnpm@11.20.0
pnpm install --frozen-lockfile
cp .env.example .env
pnpm account:create
pnpm dev
```

> Keep an existing `.env`; merge missing values instead of overwriting it.

The dev server binds to `127.0.0.1`. Set `FRITZ_DEV_LAN=true` to expose it on the LAN.

Production build:

```bash
pnpm build
ORIGIN=https://fritz.example.com FRITZ_AUTH_DATA_DIR=./data pnpm start
```

Checks: `pnpm quality`.

## How the learning algorithm works

Fritz uses FSRS, a spaced-repetition algorithm that estimates when a vocabulary card
should appear again. The daily planner combines its dates with mistakes, weaker skills,
the current course chapter, and an upcoming school test.

During normal study, a completed **long-term vocabulary** review is the operation that
asks FSRS to advance an existing card's schedule. Course answers, test-sprint reviews,
XP, missions, and reading progress do not directly reschedule that card. When a course
word already exists in personal vocabulary, Fritz preserves its editable learning fields
and schedule while adding course links and system tags.

<details>
<summary><strong>Schedule exceptions and indirect effects</strong></summary>

- Creating a card initializes its schedule. Restoring a backup can replace it, and
  disputing the latest long-term review can restore the schedule from before that review.
- AI code does not write a due date directly. In the **My own sentence** exercise,
  however, the AI result determines the answer rating; in long-term mode that rating is
  then passed to FSRS and can therefore affect the next date.
- A test sprint keeps its own temporary repetition delays. Those disappear with the
  sprint and never become the card's long-term FSRS due date.

</details>

The goal is to show what the learner genuinely needs to practise, not merely reward
activity inside the app.

## Privacy and known limits

- Fritz is a single-account beta, with no cloud sync or classroom mode.
- Study data in IndexedDB is not encrypted by Fritz at the application level; an
  unlocked browser profile can access it.
- Live AI sends the feature-specific prompt data described above to the configured
  provider. Demo AI sends no learning content to an external AI provider.
- Fritz application code does not receive or persist raw microphone audio. Browser
  speech recognition may still send audio to the browser vendor's service.
- The free-form conversation coach transcript is kept only in the open session; saved
  coach history contains the scenario, score, turn count, bounded mistake tags, and XP,
  not the messages themselves.
- Submitted vocabulary-answer text—whether typed or produced by speech recognition—is
  stored as that review's `submittedText` and is therefore included in backups.
- Speech-to-text checks the transcript; it does not score pronunciation.
- Clearing browser storage removes local data unless it was backed up.
- Plain backup exports are readable JSON. Use the encrypted export for sensitive data;
  its passphrase cannot be recovered.
- Reviewed recordings are not bundled yet, so browser or device speech synthesis is the
  normal fallback.

## Technology and licence

Fritz is built with SvelteKit, Svelte, TypeScript, Tailwind CSS, IndexedDB, `ts-fsrs`,
and Node.js. It can run in Docker and is released under the [MIT License](./LICENSE), so
you may use, modify, and self-host your own copy.
