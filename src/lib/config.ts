import "server-only";

import { getProvider, providerConfigured } from "@/lib/providers";

/**
 * Configuration state for the dashboard status strip — booleans only.
 * Secret values themselves are never sent to a page.
 */
export function configStatus(): { googleConfigured: boolean; apiKeySet: boolean; encryptionKeySet: boolean } {
  const google = getProvider("google");
  return {
    googleConfigured: google ? providerConfigured(google) : false,
    apiKeySet: (process.env.CONNECT_API_KEY ?? "").trim().length > 0,
    encryptionKeySet: (process.env.CONNECT_ENCRYPTION_KEY ?? "").trim().length > 0,
  };
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
}
