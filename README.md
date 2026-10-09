# Fritz

I made Fritz to help my sister learn German for school.

- Vocabulary, grammar, listening, conversations and reading in one place.
- Czech and English instructions; an A1–C1 course.
- 5, 10 or 20-minute lessons based on reviews, recent mistakes and course progress.
- Your own words, test practice, short stories and language mysteries.
- Optional streaks and XP.

https://github.com/user-attachments/assets/e5fc58f9-d85f-4872-918a-2d65959fea77

## Get started

**Mac**

- Requires macOS 14 or later.
- Download Fritz 0.2.0 for [Apple Silicon](https://github.com/Aletheie/Fritz/releases/download/v0.2.0/Fritz-macOS-arm64.zip)
  or [Intel](https://github.com/Aletheie/Fritz/releases/download/v0.2.0/Fritz-macOS-x64.zip).
- Unzip the download and move Fritz.app to Applications.
- The packaged app includes its runtime and needs no login setup.
- Builds aren't notarized. On first launch, macOS may require
  **System Settings → Privacy & Security → Open Anyway**.
- See [release notes](https://github.com/Aletheie/Fritz/releases/tag/v0.2.0)
  or [build from source](#development).

**Web**

Each instance has one learner profile. Install Git and Docker Compose, then run:

```sh
git clone https://github.com/Aletheie/Fritz.git
cd Fritz
cp -n .env.docker.example .env
docker compose up --build -d
docker compose exec app node scripts/access-link.mjs
```

The default address is `http://localhost:3000`.

1. Open the private link within ten minutes.
2. Create a passkey.
3. Save the recovery code.

For a phone or another computer, configure HTTPS **before creating your passkey**:

1. Set `ORIGIN` in `.env` to a permanent HTTPS address.
2. Put an HTTPS reverse proxy in front of `127.0.0.1:3000`.
3. Keep `/api/*` uncached.
4. Apply changes with `docker compose up -d`.

You can then install Fritz from your browser's menu.

## Your data and access

- Progress stays on this Mac or in this browser. **Signing in on another device
  doesn't sync it.**
- Use encrypted backups in Settings to save or move your progress.
- Export before clearing browser data or changing the app's address.
- Keep the backup passphrase somewhere safe.
- Core study works offline after an initial online load.
- Login and AI tools need a connection, including demo responses and the daily
  conversation step.

Manage passkeys in **Settings → Personal access**. Existing password accounts
can switch to passkeys there.

If you lose access, use the recovery code on the login screen.
You can also create a recovery link on your server:

```sh
docker compose exec app node scripts/access-link.mjs --recover
```

Use this after changing domains, too. It keeps your profile identity and AI
connection. Don't delete `auth.json` to reset access.

- Back up the server volume before updating. Older releases can't read the new
  profile format.
- After pulling updates, run `docker compose up --build -d`.
- `docker compose down` keeps your profile. Adding `-v` deletes its volume.

## Optional AI

The course works without an API key. AI tools use demo responses by default.

For live AI feedback:

1. Open **Settings → AI**.
2. Choose Gemini, Claude or an OpenAI-compatible provider.
3. Enter your API key and model.

- The connection works across your signed-in devices.
- The key stays encrypted in the installation. Learning backups don't include it.
- Selected learning content goes to your provider. API usage is billed separately.
- Disconnect in Settings to remove the connection for all devices.

For local models:

- Enable Ollama or LM Studio with `AI_ALLOW_LOCAL_PROVIDERS=true`.
- The Mac app enables local models by default.
- In Docker, loopback means the container.
- See [`.env.docker.example`](./.env.docker.example) for other server options.

## Development

Fritz uses SvelteKit, TypeScript, Tailwind, IndexedDB and `ts-fsrs`.
Use Node.js 22.23.2 ([`.nvmrc`](./.nvmrc)) and pnpm 11.20.0:

```sh
git clone https://github.com/Aletheie/Fritz.git
cd Fritz
npm install --global pnpm@11.20.0
pnpm install --frozen-lockfile
cp -n .env.example .env
pnpm dev
```

- In another terminal, run `pnpm access:link` from the project folder.
- Open the link, create a passkey and save the recovery code.
- Keep `ORIGIN` in `.env` aligned with the local server. The default is
  `http://localhost:5173`.

Useful commands:

- Production build: `pnpm build`.
- Full checks: `pnpm quality`. First install Chromium with
  `pnpm exec playwright install chromium`.
- Benchmarks: see the [performance guide](./tests/performance/README.md).

To package the Mac app, use a Mac with Xcode command-line tools installed:

```sh
pnpm build
pnpm release:macos --keep-app
```

- Find the ZIP and unpacked Fritz.app in `artifacts/release/`.
- The build targets your Mac's architecture by default.
- Add `--arch x64` for Intel or `--arch arm64` for Apple Silicon.
- Move the app to Applications before using it.

Content and translations are still being reviewed.
Report broken exercises or awkward German in an [issue](https://github.com/Aletheie/Fritz/issues).

[MIT license](./LICENSE). Reading selections and fonts retain their own credits
and licences.
