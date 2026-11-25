import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/connections/[id] — the dashboard's Delete button.
 * (The dashboard has no sign-in yet in this slice — access control is a
 * loud pending item before any public deploy; see README.)
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.connection.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Unknown connection." }, { status: 404 });
  await prisma.connection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
