# BuilderAI Connect

A **separate** connection service for BuilderAI — Sujon's own small Nango.
It lives in its own codebase, with its own database, so it can be managed
(and later deployed) on its own. BuilderAI does **not** hold app tokens;
this service does, and BuilderAI talks to it over the two calls below.

Recipes (auth URLs, token URLs, API bases) come from Nango's open-source
provider catalog — the engine here is our own code, generic over the
registry in `src/lib/providers.ts`. Two provider families ship today:

- **Google** (OAuth2) — one connection covers Gmail, Google Sheets,
  Google Drive, Google Calendar and Google Docs (one OAuth consent,
  union of scopes).
- **Telegram** (API_KEY) — the user pastes a bot token; no OAuth client
  registration is needed. See "Telegram" below.

## How BuilderAI will use it

**1. Connect a user's account** — link the user to:

```
GET <CONNECT_URL>/connect/google?user=<builderAiUserId>&return_url=<back-to-builderai-url>
```

The service sends the user to Google sign-in and back to its own
`/oauth/callback`, saves the connection (tokens AES-256-GCM encrypted),
then redirects to `return_url?status=connected&provider=google&connection=<id>`.

API_KEY providers work differently — the same link renders a short form
instead of redirecting:

```
GET <CONNECT_URL>/connect/telegram?user=<builderAiUserId>&return_url=<back-to-builderai-url>
```

The user pastes their key into the form; the service verifies it with
the provider, saves the connection (key AES-256-GCM encrypted) and
redirects to the same `return_url?status=connected&provider=telegram&connection=<id>`.
The form carries the same signed-state + nonce-cookie protection as the
OAuth flow.

**2. Call the app through a connection**:

```
POST <CONNECT_URL>/api/proxy
Header: x-connect-key: <CONNECT_API_KEY>
Body:   { "connectionId": "<id>", "method": "GET",
          "path": "/gmail/v1/users/me/messages" , "body": { } }
```

For OAuth2 providers, `path` is either a full URL under one of the
provider's API bases or a `/...` path joined onto the provider's
default base, and the stored access token goes in the Authorization
header — expired access tokens are refreshed automatically. A
provider's services may live on their own hosts, so the registry
carries a per-service `apiBaseUrl` next to the provider default and a
full URL may start with any of them (the match must end at a `/`
boundary, so look-alike hosts never pass). Google's bases, from the
catalog's per-service entries: Gmail `https://gmail.googleapis.com`,
Sheets `https://sheets.googleapis.com`, Drive
`https://www.googleapis.com` (the provider default; Drive v3 paths
live under it), Calendar `https://www.googleapis.com`
(`calendar/v3` paths), Docs `https://docs.googleapis.com`. For API_KEY
providers, `path` is a plain `/...` path only (like `/sendMessage`),
appended to the provider's key URL template (`https://api.telegram.org/bot<token>`);
absolute URLs and `..` escapes are refused with 400. Either way, calls
can never leave the provider's API. The response mirrors the upstream
call: `{ status, data }`. Tokens never appear in any response or page.

## Telegram

A Telegram connection is a **bot the user owns** — Telegram bots are
the only way to send messages through the Telegram API.

**How a user gets a bot token** (about a minute, on their phone):

1. Open Telegram and talk to **@BotFather**.
2. Send `/newbot` and follow the steps (pick a name and a username).
3. BotFather replies with the bot token — the user pastes it into the
   `/connect/telegram` form.

The service verifies the pasted token the catalog's way —
`GET https://api.telegram.org/bot<token>/getMe` — and only saves the
connection when Telegram accepts it. The saved account name is the
bot's `@username`. A refused token re-renders the form with an honest
error and saves nothing.

**Pending:** a real end-to-end Telegram connect still needs a real bot
token — Sujon creates a bot via @BotFather (1 minute on his phone),
then the connect form + a `/sendMessage` proxy call can be proven for
real. Everything else (form, verification, storage, proxy path) is
tested locally with dummy tokens.

## Pages

- `/login` — owner sign-in (see below).
- `/` — dashboard: service status (booleans only) + the provider
  service cards (Google family + Telegram) with live connection counts.
  Owner session required.
- `/connections` — every stored connection, with a working Delete.
  Owner session required.

On phone widths (below `lg`) the header keeps only the brand + a ☰
button; the navigation (Home, Connections, Log out) lives in a slide-in
drawer from the left. Desktop keeps the inline header links.

## Owner login

The dashboard is locked behind a single owner account that lives in
env, not the database:

- `OWNER_EMAIL` + `OWNER_PASSWORD_HASH` — a **bcrypt hash** (bcryptjs),
  never the plain password, which is never stored or logged anywhere.
- On sign-in the server sets a signed session cookie
  (`connect_owner_session`, HMAC-SHA256 over `{ email, expiry }`,
  httpOnly, SameSite=Lax, 7 days). The signing key is `SESSION_SECRET`,
  falling back to `CONNECT_ENCRYPTION_KEY`.
- `src/proxy.ts` gates every UI route: no valid session → redirect to
  `/login`. The machine/user endpoints stay public by design:
  `/connect/*`, `/oauth/callback`, `/api/proxy` (which keeps its own
  `x-connect-key` check). The dashboard pages also re-check the session
  server-side as defense in depth.
- If `OWNER_EMAIL` / `OWNER_PASSWORD_HASH` are unset, `/login` shows an
  honest "Owner login is not configured yet" state and the dashboard
  stays locked — there is no open-access fallback.
- Sessions are stateless: Log out clears the cookie; an already-issued
  cookie stays cryptographically valid until its 7-day expiry.

**Setting a real owner password later:** generate the hash and put the
output in `OWNER_PASSWORD_HASH`:

```
node -e "console.log(require('bcryptjs').hashSync('your-password', 12).replace(/\$/g, '\\$'))"
```

The `.replace(...)` step is **not optional**: Next.js expands `$...`
sequences in `.env` values, which silently corrupts a raw bcrypt hash
(it is full of `$` characters) — with a raw hash the correct password
will never match. This was found and verified the hard way in slice 2:
@next/env parsed a 60-char hash down to 45 chars until it was stored
`\$`-escaped.

## Run it locally

```
pnpm install
pnpm db:deploy   # applies prisma/migrations to DATABASE_URL
pnpm dev         # http://localhost:3100
```

Copy `.env.example` to `.env` and fill it in. This service has its **own**
database (locally: `builderai_connect` on the shared local Postgres).

## ⚠️ Pending before any real use / public deploy

1. **Its own Google OAuth client.** The half-done Google Cloud setup
   (project "BuilderAI") still needs the OAuth Web client created — for
   THIS service, with redirect URI `<this service's URL>/oauth/callback` —
   and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set in its env.
   (BuilderAI's own Gmail credential flow is separate and untouched.)
2. **Production database + own Vercel project** for this service
   (its own DATABASE_URL, CONNECT_API_KEY, CONNECT_ENCRYPTION_KEY).
3. **BuilderAI-side wiring** (later slice): Credentials-page connect
   buttons pointing at `/connect/...`, and the Gmail/Sheets/Drive/
   Calendar/Docs nodes calling `/api/proxy` instead of holding tokens.
4. **A real Telegram bot token** for the end-to-end connect proof
   (Sujon creates a bot via @BotFather — see "Telegram" above).
