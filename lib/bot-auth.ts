/**
 * Machine authentication for the Telegram bot.
 *
 * The dashboard authenticates with an Auth.js session cookie, which a bot
 * cannot obtain — magic links need a mailbox and a browser. These helpers let a
 * request authenticate instead with `Authorization: Bearer $BOT_API_KEY`, and
 * fall back to the normal session path when that header is absent.
 *
 * The key grants owner-level access to the workspace, so it belongs in .env
 * next to ENCRYPTION_KEY and must never reach the browser.
 */

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  getCurrentWorkspaceContext,
  type WorkspaceContext,
} from "@/lib/workspace-access";
import { getCurrentWorkspaceId } from "@/lib/auth";

function presentedKeyMatches(request: NextRequest): boolean {
  const expected = process.env.BOT_API_KEY;
  // An unset key must never authenticate anything, or an empty header would.
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const presented = header.slice("Bearer ".length);
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The workspace the bot acts on. There is exactly one in a self-hosted install;
 * the oldest is chosen so the answer stays stable if more are ever created.
 */
async function botWorkspaceId(): Promise<string | null> {
  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return workspace?.id ?? null;
}

/** Workspace id from the bot key if present, otherwise from the user session. */
export async function resolveWorkspaceId(
  request: NextRequest
): Promise<string | null> {
  if (presentedKeyMatches(request)) return botWorkspaceId();
  return getCurrentWorkspaceId();
}

/**
 * Full context for routes that also check the caller's role. The bot is treated
 * as OWNER: the key already grants complete control of the workspace, so a
 * lesser role would only be decorative.
 */
export async function resolveWorkspaceContext(
  request: NextRequest
): Promise<WorkspaceContext | null> {
  if (presentedKeyMatches(request)) {
    const workspaceId = await botWorkspaceId();
    if (!workspaceId) return null;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) return null;

    return { userId: "bot", workspaceId, workspace, role: "OWNER" };
  }

  return getCurrentWorkspaceContext();
}
