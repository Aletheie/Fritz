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
- **Long-term vocabulary:** FSRS plans when each word should return.
- **Test sprint:** 5–180 minutes of focused practice by tag without moving FSRS dates
  or changing long-term skill estimates. Attempts still appear in history and can award
  reduced XP.
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
- the 25 reading entries are curated selections and graded adaptations, not necessarily
  25 complete books;
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
- XP, levels, streaks, missions, badges, mastery, reports, and optional gamification;
- plain or encrypted backups, restore preview, and a short-lived in-memory rollback;
- keyboard navigation, visible focus, screen-reader messages, safe areas, and reduced
  motion.

## How Fritz is meant to run

Fritz uses a personal self-hosting model:

1. clone or fork this repository;
2. run one private Fritz server, preferably with Docker;
3. create the server's single account from the command line;
4. open the final HTTPS address and install it on a phone or computer;
5. keep learning data on that device and move it with encrypted backups when needed.

There is no public registration, cloud database, subscription, or classroom account
system. The login protects access to the private instance; it does **not** synchronise
learning progress between devices.

| Data                                        | Where it lives                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Username, password hash, and session hashes | The server's `data/auth.json`, or the persistent Docker volume                          |
| Vocabulary, progress, settings, and history | IndexedDB in the current browser profile and origin                                     |
| AI provider keys                            | Server environment only                                                                 |
| Session                                     | An `HttpOnly`, `SameSite=Strict` cookie in the current browser                          |
| Backups                                     | A plain JSON export or an AES-256-GCM encrypted JSON envelope downloaded by the learner |

Tabs in the same browser share the local database. A different browser, device, or
domain gets a separate database. To move to another device, export an encrypted backup
from **Settings**, sign in on the new device, and restore the file there.

<details>
<summary><strong>What the login protects—and what it does not</strong></summary>

While online, the server account gates the application and API. Passwords are stored as
scrypt hashes and session tokens are stored as hashes; the session cookie is also marked
`Secure` when Fritz is served over HTTPS.

The login is not device encryption. After an authorised online load, the service worker
can serve the cached app shell offline, when the server cannot revalidate the session.
Anyone who can use that already-authorised browser profile may therefore be able to open
the offline app and read its unencrypted IndexedDB data. Use an OS login and device
encryption, and do not treat a shared browser profile as private storage.

</details>

## Quick start with Docker

Docker Compose is the recommended way to run a personal instance. It keeps the account
file in a persistent volume while the application container remains replaceable.

```bash
cp .env.docker.example .env
docker compose up --build -d
docker compose exec app node scripts/account-create.mjs
```

The account command asks for a username and a password of at least 12 characters. It
creates exactly one account and refuses to overwrite an existing one. Enter the password
interactively so it does not end up in shell history.

Open <http://localhost:3000>, sign in, and complete onboarding. Useful checks:

```bash
docker compose ps
curl -fsS http://localhost:3000/healthz
docker compose logs -f app
```

To stop the server without deleting its account volume:

```bash
docker compose down
```

> [!CAUTION]
> Do not add `-v` to `docker compose down` unless you deliberately want to remove the
> persistent account volume. Learning data is separate in the browser, but the server
> login would be removed.

## Account and local data

- **One instance has one account.** There is no sign-up screen and no second user.
- **The account is an access gate, not a sync account.** Signing in with the same
  credentials on two devices does not copy progress between them.
- **The server does not store study progress.** It stores only authentication data;
  learning data remains in each browser's IndexedDB.
- **Browser storage is not a backup.** Clearing site data, deleting the browser profile,
  or changing the deployment domain starts with an empty database.
- **Use an encrypted export to move or protect data.** The passphrase cannot be
  recovered, so keep it somewhere safe.

This setup is intentional: I run a private copy for my sister, while the MIT-licensed
source lets anyone create and control their own copy.

## Install Fritz as a PWA

Fritz is already a Progressive Web App: the repository includes its web app manifest,
icons, standalone display mode, and offline service worker. There is no separate mobile
build or app-store package to create.

### 1. Give the app a stable HTTPS address

`localhost` is suitable for development and installation on the same computer. For a
phone or a real deployment, put the Node server behind an HTTPS reverse proxy and set
`ORIGIN` to the exact public address in `.env`:

```dotenv
FRITZ_PORT=3000
ORIGIN=https://fritz.example.com
```

Then start or recreate the container:

```bash
docker compose up --build -d
```

The reverse proxy must forward requests to port 3000, preserve `Set-Cookie`, and avoid
caching `/api/*`. Fritz needs the SvelteKit Node server for authentication and AI, so a
static-file host alone is not enough.

### 2. Prime offline mode

Open the final HTTPS URL, sign in while online, and let the first page finish loading.
Launch the installed app online once before testing it in airplane mode. This gives the
service worker an authorised app shell to cache; it does not cache the login API or make
the server account an offline encryption key.

### 3. Add it to the device

- **[iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios):** open Fritz in
  Safari, choose **Share → Add to Home Screen**, enable **Open as Web App** when shown,
  then tap **Add**.
- **[iPad](https://support.apple.com/guide/ipad/open-as-web-app-ipad8f1f7a29/ipados):**
  open Fritz in Safari, choose **Share → More → Add to Home Screen**, enable **Open as
  Web App** when shown, then tap **Add**.
- **[Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en):**
  open Fritz in Chrome, choose **More → Install and create shortcut → Install**, then
  follow the prompt.
- **[Desktop Chrome](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=en):**
  use the install icon in the address bar, or choose **More → Cast, save, and share →
  Install page as app**.

Once installed, Fritz opens in its own window from the home screen or app launcher.
Lessons, bundled content, and saved progress work offline after the first authorised
load. The initial login, live AI, browser speech recognition, and uncached network
resources still need a connection.

<details>
<summary><strong>Exactly what “works offline” means</strong></summary>

The installed app can load its cached shell, read bundled course/grammar/reading content,
and use study data already stored in that browser's IndexedDB. Local planning, exercises,
FSRS scheduling, progress, and backups do not need the Fritz server once the shell is
available.

The login and all `/api/*` routes are deliberately excluded from the service-worker
cache. Both demo and live AI call the Fritz server, so neither is an offline feature.
Speech recognition may call a browser-vendor service. Speech playback normally uses the
device's German voice; no reviewed recordings are bundled in the current audio manifest,
so the download control has nothing to download until recordings are added.

</details>

## Enable live AI (optional)

Fritz works without a provider key. With the default `AI_SPONSORED_MODE=off`, its AI
routes return deterministic demo responses generated by the Fritz Node server and send
nothing to an external AI provider. “Demo” means self-contained, not offline: the
browser still has to reach the Fritz server's `/api/ai/*` routes.

Live AI must be explicitly enabled with `AI_SPONSORED_MODE=private`. That value is the
deployment owner's assertion that the instance is private; Fritz cannot determine from
the flag whether a public URL is actually shared. Provider keys are read by the server
and are never accepted, stored, or displayed by the browser. They are not included in
IndexedDB, cookies, backups, the client bundle, or release archives.

### Google Gemini

Create or view a key in
[Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key), then add it to the
deployment's `.env` file:

```dotenv
AI_SPONSORED_MODE=private
GEMINI_API_KEY=your-server-side-key
AI_MODEL=gemini-3.6-flash
```

`gemini-3.6-flash` is the repository's pinned default; check Google's
[official model catalog](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash)
and override `AI_MODEL` if your account or region requires another compatible model.

Apply the new environment and check **Settings → AI trainer and workshop**:

```bash
docker compose up -d
```

Both settings are required: a key by itself does not activate live AI. With `private`
mode and no non-empty provider key, Fritz uses demo mode. A non-empty but invalid,
revoked, or unauthorised key is treated as configured: the live request fails instead of
silently falling back to demo. Never prefix the key with `PUBLIC_`, commit it, bake it
into an image, or paste it into client-side code. Usage is attributed to the provider
account and may be billed under that provider's terms.

### Trusted OpenAI-compatible provider

An advanced private deployment can use a trusted OpenAI-compatible `/v1` endpoint:

```dotenv
AI_SPONSORED_MODE=private
INKLING_API_KEY=your-server-side-key
INKLING_BASE_URL=https://ai.example.com/v1
INKLING_MODEL=provider/model-name
INKLING_ALLOWED_HOSTS=ai.example.com
TRUST_CUSTOM_AI_PROVIDER=false
```

The endpoint must use HTTPS and end in `/v1`. Keep
`TRUST_CUSTOM_AI_PROVIDER=false` and explicitly allow its hostname when possible. Setting
it to `true` means the deployment owner accepts responsibility for sending learning
content and the provider key to that custom endpoint. If both Gemini and this provider
are configured, Gemini is selected first; Fritz does not send one request to multiple
providers as a fallback. A broken Gemini configuration therefore does not fail over to
the custom provider.

<details>
<summary><strong>What a live AI request can contain</strong></summary>

The payload is built for the selected feature. Depending on that feature, it can include
selected vocabulary and its learning fields, a submitted learner sentence, recent turns
from the current conversation, or selected story text and context. Fritz does not upload
the whole IndexedDB database or a backup file as part of an AI request. The configured
provider still receives the feature prompt and its content, so review that provider's
retention, training, regional, and billing terms before enabling live AI.

</details>

To disable all external AI calls again, set `AI_SPONSORED_MODE=off`, clear the provider
keys and URLs, and recreate the container.

## Local development without Docker

Requires Node.js 22.13 or newer and pnpm 11.20.

```bash
npm install --global pnpm@11.20.0
pnpm install --frozen-lockfile
cp .env.example .env
pnpm account:create
pnpm dev
```

The development server listens on `127.0.0.1` by default. Set `FRITZ_DEV_LAN=true` only
when you intentionally want it reachable on the local network.

Production build:

```bash
pnpm build
ORIGIN=https://fritz.example.com FRITZ_AUTH_DATA_DIR=./data pnpm start
```

Run the complete project checks with:

```bash
pnpm quality
```

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
- Study data in IndexedDB is not encrypted at rest; an unlocked browser profile can
  access it.
- Live AI sends the feature-specific prompt data described above to the configured
  provider. Demo AI sends no learning content to an external AI provider.
- Fritz does not capture or store raw microphone audio. Browser speech recognition may
  still send audio to the browser vendor's service.
- The free-form conversation coach transcript is kept only in the open session; saved
  coach history contains the scenario, score, turn count, bounded mistake tags, and XP,
  not the messages themselves.
- A speech-recognition transcript that the learner submits as a vocabulary answer is
  stored as that review's `submittedText` and is therefore included in backups.
- Speech-to-text checks the transcript; it does not score pronunciation.
- Clearing browser storage removes local data unless it was backed up.
- Plain backup exports are readable JSON. Use the encrypted export for sensitive data;
  its passphrase cannot be recovered.
- Reviewed recordings are not bundled yet, so device speech is the normal fallback.

## Technology and licence

Fritz is built with SvelteKit, Svelte, TypeScript, Tailwind CSS, IndexedDB, `ts-fsrs`,
and Node.js. It can run in Docker and is released under the [MIT License](./LICENSE), so
you may use, modify, and self-host your own copy.
