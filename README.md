# Fritz

I made Fritz to help my sister learn German for school. It keeps vocabulary,
grammar, listening, conversations and reading in one place, with Czech and English
instructions.

Pick a 5, 10 or 20-minute lesson built around your reviews, recent mistakes and
place in the A1–C1 course. Add your own words, practise for a test, or work through
a short story or language mystery. Streaks and XP are optional.

## Get started

**Mac:** build Fritz.app from source using the [development setup](#development)
below. Packaged downloads aren't published yet; they will appear under
[Releases](https://github.com/Aletheie/Fritz/releases). Requires macOS 14 or later;
the packaged app includes its runtime and needs no login setup. Builds aren't
notarized, so macOS may require **System Settings → Privacy & Security → Open Anyway**
on first launch.

**Web:** each instance has one learner profile. With Git and Docker Compose:

```sh
git clone https://github.com/Aletheie/Fritz.git
cd Fritz
cp -n .env.docker.example .env
docker compose up --build -d
docker compose exec app node scripts/access-link.mjs
```

Open the private link within ten minutes, create a passkey and save the recovery
code. The default address is `http://localhost:3000`.

For access from a phone or another computer, set `ORIGIN` in `.env` to a permanent
HTTPS address **before creating your passkey**. Put an HTTPS reverse proxy in front
of `127.0.0.1:3000`, keep `/api/*` uncached and apply changes with
`docker compose up -d`. You can then install Fritz from your browser's menu.

## Your data and access

Progress lives on this Mac or in this browser. **Signing in on another device
doesn't sync it.** Use encrypted backups in Settings to keep a copy or move your
progress. Export before clearing browser data or changing the app's address;
keep the backup passphrase somewhere safe.

Core study works offline after an initial online load. Login and AI tools,
including demo responses and the daily conversation step, need a connection.

Manage passkeys in **Settings → Personal access**. If you lose access, use the
recovery code on the login screen, or create a recovery link on your server:

```sh
docker compose exec app node scripts/access-link.mjs --recover
```

Use this after changing domains, too. It keeps your profile identity and AI
connection; don't delete `auth.json` to reset access. Existing password accounts
can switch to passkeys in Settings.

Back up the server volume before updating: older releases can't read the new
profile format. After pulling updates, run `docker compose up --build -d`.
`docker compose down` keeps your profile; adding `-v` deletes its volume.

## Optional AI

The course works without an API key. For live AI feedback, open **Settings → AI**
and connect Gemini, Claude or an OpenAI-compatible provider with your API key and
model. Without one, AI tools use demo responses.

The connection works across your signed-in devices. Its key stays encrypted in
the installation and isn't included in learning backups. Selected learning content
is sent to your chosen provider, whose API usage is billed separately. Disconnect
in Settings to remove the connection for all devices.

Ollama and LM Studio work with `AI_ALLOW_LOCAL_PROVIDERS=true`; the Mac app enables
local models by default. In Docker, loopback means the container. Other server
options are described in [`.env.docker.example`](./.env.docker.example).

## Development

Fritz uses SvelteKit, TypeScript, Tailwind, IndexedDB and `ts-fsrs`.
Use Node.js 22.23.2 ([`.nvmrc`](./.nvmrc)) and pnpm 11.20.0:

```sh
npm install --global pnpm@11.20.0
pnpm install --frozen-lockfile
cp -n .env.example .env
pnpm dev
```

In another terminal, run `pnpm access:link`. Keep `ORIGIN` in `.env` aligned with
the local server, using `http://localhost:5173` by default.

Run `pnpm build` for a production build, or `pnpm quality` for the full checks
(install Chromium first with `pnpm exec playwright install chromium`).
See the [performance guide](./tests/performance/README.md) for benchmarks.

To package the Mac app, use a Mac with Xcode command-line tools installed:

```sh
pnpm build
pnpm release:macos --keep-app
```

The ZIP and unpacked Fritz.app are written to `artifacts/release/`. The build
targets your Mac's architecture by default; use `--arch x64` for Intel or
`--arch arm64` for Apple Silicon. Move the app to Applications before using it.

Content and translations are still being reviewed. Found a broken exercise or
an awkward German sentence? [Open an issue](https://github.com/Aletheie/Fritz/issues).

[MIT license](./LICENSE). Reading selections and fonts retain their own credits
and licences.
