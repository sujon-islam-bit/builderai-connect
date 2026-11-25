import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Reads and writes for the tiny `Setting` key-value table. Used today
 * for the first-run owner setup (`owner_email`, `owner_password_hash`);
 * see src/lib/auth.ts for how those are resolved against env.
 */

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function getSettings(keys: string[]): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  return new Map(rows.map((row) => [row.key, row.value]));
}

/**
 * Creates a setting row. Uses `create` (not upsert) on purpose: the
 * owner setup relies on the primary-key conflict to refuse a second
 * setup if two requests race — see src/app/api/auth/setup/route.ts.
 */
export async function createSetting(key: string, value: string): Promise<void> {
  await prisma.setting.create({ data: { key, value } });
}
