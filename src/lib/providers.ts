/**
 * Provider registry — the recipe book for every app BuilderAI can connect.
 *
 * Recipes come from Nango's open-source provider catalog
 * (hidden_files/nango-providers-catalog-2026-11-26.yaml): each provider's
 * authorization URL, token URL, authorization params and API base URL are
 * public facts from that catalog. The engine (connect flow + proxy) is
 * generic over this registry — a new provider is a new entry here, not
 * new code.
 */

export type ProviderService = {
  id: string;
  displayName: string;
  /** One plain line under the name saying what this service does (shohoj-design rule). */
  plainLine: string;
  /** OAuth scopes this service needs. One provider connection requests the union. */
  scopes: string[];
  /**
   * Optional per-service API base URL. Some providers host each service
   * on its own domain (Google: Sheets is sheets.googleapis.com, not a
   * path under www.googleapis.com). When set, proxied calls may also
   * start with this base; when unset, the provider's apiBaseUrl applies.
   */
  apiBaseUrl?: string;
};

type ProviderBase = {
  id: string;
  displayName: string;
  /** One plain line under the name saying what this provider is. */
  plainLine: string;
  /** Default API base URL — proxied calls must stay under this base or a service's own base (see ProviderService.apiBaseUrl). */
  apiBaseUrl: string;
  services: ProviderService[];
};

export type OAuth2ProviderConfig = ProviderBase & {
  authMode: "OAUTH2";
  authorizationUrl: string;
  tokenUrl: string;
  authorizationParams: Record<string, string>;
  /** Env var names holding this provider's OAuth client id / secret. */
  clientIdEnv: string;
  clientSecretEnv: string;
};

export type ApiKeyProviderConfig = ProviderBase & {
  authMode: "API_KEY";
  /**
   * Upstream URL template from the catalog's proxy base_url: "{apiKey}"
   * is replaced with the connection's stored key, then the request path
   * ("/sendMessage", …) is appended. The key lives in the URL itself, so
   * API_KEY providers need no Authorization header — and the built URL
   * must never be shown anywhere.
   */
  apiKeyUrlTemplate: string;
};

export type ProviderConfig = OAuth2ProviderConfig | ApiKeyProviderConfig;

const GOOGLE_SCOPES = {
  identity: ["openid", "email"],
  gmail: ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.modify"],
  sheets: ["https://www.googleapis.com/auth/spreadsheets"],
  drive: ["https://www.googleapis.com/auth/drive"],
  calendar: ["https://www.googleapis.com/auth/calendar"],
  docs: ["https://www.googleapis.com/auth/documents"],
};

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "google",
    displayName: "Google",
    plainLine: "One Google sign-in connects Gmail, Sheets, Drive, Calendar and Docs together.",
    authMode: "OAUTH2",
    // From the catalog's `google` entry.
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    authorizationParams: { response_type: "code", access_type: "offline", prompt: "consent" },
    apiBaseUrl: "https://www.googleapis.com",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    services: [
      {
        id: "gmail",
        displayName: "Gmail",
        plainLine: "Read and send email from the connected Google account.",
        // The same scope set BuilderAI's built-in Gmail credential uses.
        scopes: [...GOOGLE_SCOPES.identity, ...GOOGLE_SCOPES.gmail],
        // Catalog `google-mail` proxy.base_url — Gmail lives on its own host.
        apiBaseUrl: "https://gmail.googleapis.com",
      },
      {
        id: "sheets",
        displayName: "Google Sheets",
        plainLine: "Read rows from a spreadsheet and add new rows to it.",
        scopes: [...GOOGLE_SCOPES.sheets],
        // Catalog `google-sheet` proxy.base_url — Sheets lives on its own
        // host (www.googleapis.com/sheets/v4/... is a Google 404).
        apiBaseUrl: "https://sheets.googleapis.com",
      },
      {
        id: "drive",
        displayName: "Google Drive",
        plainLine: "List, read and upload files in the connected Drive.",
        scopes: [...GOOGLE_SCOPES.drive],
        // The catalog's `google-drive` entry gives no proxy.base_url:
        // Drive v3 paths live under the provider default base.
        apiBaseUrl: "https://www.googleapis.com",
      },
      {
        id: "calendar",
        displayName: "Google Calendar",
        plainLine: "See calendar events and create new ones.",
        scopes: [...GOOGLE_SCOPES.calendar],
        // Catalog `google-calendar` proxy.base_url — calendar/v3 paths
        // live under the provider default base.
        apiBaseUrl: "https://www.googleapis.com",
      },
      {
        id: "docs",
        displayName: "Google Docs",
        plainLine: "Read and write documents (files live in Drive, so Drive comes with it).",
        scopes: [...GOOGLE_SCOPES.docs, ...GOOGLE_SCOPES.drive],
        // Catalog `google-docs` proxy.base_url — Docs lives on its own host.
        apiBaseUrl: "https://docs.googleapis.com",
      },
    ],
  },
  {
    id: "telegram",
    displayName: "Telegram",
    plainLine: "Connect a Telegram bot you own — no sign-in keys to register, just the bot token from @BotFather.",
    authMode: "API_KEY",
    // From the catalog's `telegram` entry: proxy base_url is
    // https://api.telegram.org/bot${apiKey} and a token is verified
    // with GET /getMe.
    apiBaseUrl: "https://api.telegram.org",
    apiKeyUrlTemplate: "https://api.telegram.org/bot{apiKey}",
    services: [
      {
        id: "telegram-bot",
        displayName: "Telegram",
        plainLine: "Send messages from a Telegram bot you own.",
        // API_KEY providers ask for no OAuth scopes — the bot token is the key.
        scopes: [],
      },
    ],
  },
];

export function getProvider(id: string): ProviderConfig | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/**
 * Every base URL a proxied call for this provider may start with: the
 * provider's default base plus any per-service overrides, de-duplicated.
 */
export function providerApiBaseUrls(provider: ProviderConfig): string[] {
  const bases = new Set<string>([provider.apiBaseUrl]);
  for (const service of provider.services) {
    if (service.apiBaseUrl) bases.add(service.apiBaseUrl);
  }
  return [...bases];
}

/** The union of every service's scopes — one connection covers the whole family. */
export function providerScopes(provider: OAuth2ProviderConfig): string[] {
  const all = new Set<string>();
  for (const service of provider.services) for (const scope of service.scopes) all.add(scope);
  return [...all];
}

export function providerClientId(provider: OAuth2ProviderConfig): string {
  return process.env[provider.clientIdEnv]?.trim() ?? "";
}

export function providerClientSecret(provider: OAuth2ProviderConfig): string {
  return process.env[provider.clientSecretEnv]?.trim() ?? "";
}

/**
 * True when this provider can accept connections right now. OAuth2
 * providers need their client id + secret in env; API_KEY providers
 * need nothing registered — the user brings the key when connecting.
 */
export function providerConfigured(provider: ProviderConfig): boolean {
  if (provider.authMode === "API_KEY") return true;
  return providerClientId(provider).length > 0 && providerClientSecret(provider).length > 0;
}
