<p align="center">
  <img src="./static/icons/icon-512.png" width="96" height="96" alt="Fritz">
</p>

<h1 align="center">Fritz</h1>

<p align="center">
  <strong>A little German, every day.</strong><br>
  For Czech and English speakers. Open source. Yours to host.
</p>

<p align="center">
  <a href="#run-your-own">Run your own</a> &nbsp;·&nbsp;
  <a href="#working-on-fritz">Development</a> &nbsp;·&nbsp;
  <a href="https://github.com/Aletheie/Fritz/issues">Issues</a>
</p>

My sister needs German for school. I made Fritz to keep her vocabulary, grammar,
listening, conversations and reading in one place. It's here in case it helps you, too.

## A plan for today

Pick **5, 10 or 20 minutes**. Fritz builds a lesson around words due for review, recent
mistakes and your place in the course. Finished activities are saved as you go.

- Follow **120 chapters from A1.1 to C1.2**, from recognising words to typing them
  from memory. Revisit earlier vocabulary and put it to use in practical missions.
- Work through short grammar lessons, listening exercises, guided conversations and
  reading selections with glossaries.
- Build everyday A1 vocabulary inside the course, including names, family, food,
  numbers and weekdays. Ask for missing details in ten interactive conversations
  before choosing a solution.
- End each level band with a new spoken message, a writing task for a specific
  recipient, and a fresh reading check. Revise and save your writing as it grows
  from simple replies to structured summaries.
- Drafts save as you write. Find unfinished and completed texts in **Progress → My writing**.
- Try **Language cases (beta)** from the home screen: three short cases at A2/B1.
  Investigate **The empty frame**, where new documents arrive as you follow the trail
  from a suspicious guest to a missing photograph. Support theories with text evidence,
  keep confirmed findings in your notebook, and review the final timeline. Vocabulary help, saved progress and
  replay work without an AI key; progress is included in backups.
- Add your own words, with articles, plurals, examples and tags. Spaced repetition
  handles when to review them.
- Got a test coming up? Tag the words and run a focused **test sprint**. Cramming leaves
  your long-term review schedule alone.

Streaks, XP and celebrations are there if you like them. You can hide them in Settings.

Learning content and English support are still being reviewed, especially reading
guidance and error messages. CEFR labels guide practice; finishing the course is not
a proficiency certificate.

## Run your own

Download the **Mac app** from [GitHub Releases](https://github.com/Aletheie/Fritz/releases).
Choose Apple Silicon (M1 or later) or Intel for **macOS 14 or later**, unzip it and move
**Fritz.app** to Applications.
It includes its own runtime: no Node.js, Docker or server account setup is needed.
The app stores your progress on this Mac and stops its local server when you quit.
These community builds are not Apple-notarized; on first launch, use **System Settings →
Privacy & Security → Open Anyway** if macOS blocks it. Only do this for the release you downloaded here.

On **Windows, Linux, Android and iPhone/iPad**, use the web app from your private
server and install it from the browser. Mobile devices need an HTTPS server address;
the Mac app's private local server is only accessible on that Mac.

To host the web app, you'll need Git and Docker Compose. Each private instance has
one learner account. No AI key is needed for the built-in course.

```sh
git clone https://github.com/Aletheie/Fritz.git
cd Fritz
cp -n .env.docker.example .env
docker compose up --build -d
docker compose exec app node scripts/account-create.mjs
```

The last command creates your login; choose a password of at least 12 characters.
Open [localhost:3000](http://localhost:3000), sign in and follow the setup.
If you're using an existing checkout, keep your `.env`.

<details>
<summary>Use it on your phone</summary>

Give the server a stable HTTPS address and set `ORIGIN` in `.env` to that exact URL.
Put an HTTPS reverse proxy in front of port 3000; preserve cookies and leave `/api/*`
uncached. Apply the change with `docker compose up -d`.

The port binds to `127.0.0.1` by default. If your reverse proxy runs on another host,
set `FRITZ_BIND_HOST` to the intended private interface and restrict access to the proxy.

Open the address on your phone, sign in and let it finish loading. Use your browser's
**Add to Home Screen** or **Install app** option, then open the installed app once
while online to prepare it for offline use.

</details>

<details>
<summary>Enable live AI</summary>

Open **Settings → AI** and choose **Google Gemini**, **Anthropic Claude**, or an
**OpenAI-compatible** service. Enter your API key and model, then test the connection.
Compatible services include OpenAI, OpenRouter, Groq, Mistral and DeepSeek; use the
provider's API base URL and exact model ID. An API key is separate from a consumer
ChatGPT/Claude subscription. A connection test sends a small request and may incur
the provider's usage charge.

For Ollama or LM Studio, enable local providers in your private server with
`AI_ALLOW_LOCAL_PROVIDERS=true`, then enter its OpenAI-compatible loopback URL
and installed model. An API key is optional for a local server. In Docker, loopback
refers to the container, not the host. The Mac app enables local models on your Mac.

Your connection is encrypted in an HttpOnly cookie, bound to the signed-in account
and expires after 30 days. Saved keys are never returned to client JavaScript or
included in localStorage or learning backups. Signing out or removing the connection
clears it. If it expires, AI stays in demo mode until you reconnect. Selected
learning content goes to the provider. A provider error is shown for retry; the app
does not silently send it to a different company.

Without a connection, conversation feedback, sentence checks and reading help use
demo responses. To provide a shared Gemini key for your private server instead, set:

```dotenv
AI_SPONSORED_MODE=private
GEMINI_API_KEY=your-server-side-key
```

Run `docker compose up -d` to apply it. Override the model with `AI_MODEL` if needed.
The server key stays on the server. A user's own connection takes priority.

A trusted OpenAI-compatible endpoint also works. Set `INKLING_API_KEY`,
`INKLING_BASE_URL` (an HTTPS URL ending in `/v1`) and `INKLING_MODEL` in `.env`,
then allowlist its hostname with `INKLING_ALLOWED_HOSTS`. Gemini takes priority if both
are configured; provider errors don't fall back to demo responses.

To disable all external AI, set `AI_SPONSORED_MODE=off` and `AI_USER_CONNECTIONS=false`
and run `docker compose up -d`.

</details>

## Where your progress lives

Your vocabulary and progress stay in this browser's IndexedDB. **Signing in on another
device doesn't sync them.** Use encrypted backups in **Settings** to keep a copy or
move to another device. Local browser storage itself isn't encrypted by Fritz.

Core study works offline after setup. Login and AI features, including demo responses
and the daily conversation step, need a connection. Speech depends on your browser;
speech input checks the transcript, not pronunciation.

<details>
<summary>Backups, updates and the server account</summary>

Export a backup before clearing browser storage, changing the app's address or
replacing its account. Keep the encrypted backup's passphrase somewhere safe; Fritz
can't recover it.

The Docker volume holds your server account. Stop with `docker compose down` to keep
it. Adding `-v` deletes the volume; a replacement account also resets browser data
bound to the old account, so export first.

After pulling an update, rebuild with `docker compose up --build -d`.
Check the server at `/healthz`; see logs with `docker compose logs -f app`.

</details>

## Working on Fritz

SvelteKit, Svelte, TypeScript and Tailwind CSS, with IndexedDB for storage and
`ts-fsrs` for spaced repetition.

<details>
<summary>Local development without Docker</summary>

After cloning, use Node.js **22.23.2** from [`.nvmrc`](./.nvmrc) and pnpm **11.20.0**:

```sh
npm install --global pnpm@11.20.0
pnpm install --frozen-lockfile
cp -n .env.example .env
pnpm account:create
pnpm dev
```

The copy preserves an existing `.env`. Skip account creation if you already have one.
Open the local URL printed by Vite.

Run `pnpm quality` for the full checks, or `pnpm build` for a production build.

Run `pnpm test:performance` for the detailed performance suite: three database sizes
up to 10,000 words and 100,000 reviews, plus production Chromium checks on desktop
and a mobile viewport with 4× CPU slowdown. `pnpm test:performance:quick` runs the
small database profile. Measurements, budgets and browser traces are saved under
`artifacts/performance/`; see [the performance test guide](./tests/performance/README.md).

</details>

Found a broken exercise or a German sentence that sounds off?
[Open an issue](https://github.com/Aletheie/Fritz/issues) or send a pull request.

---

Code is [MIT licensed](./LICENSE). Reading selections keep their source credits in
the app; bundled fonts retain their own licences.
