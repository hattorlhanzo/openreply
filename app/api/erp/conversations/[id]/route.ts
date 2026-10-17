import { NextRequest, NextResponse } from "next/server";
import { erpAccount, erpDenied, erpError, erpKeyMatches } from "@/lib/erp-auth";
import { getConversationMessages, MetaApiError } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

type RouteProps = { params: Promise<{ id: string }> };

// История одной переписки (Meta отдаёт 20 последних), по порядку сверху вниз.
// Токен — того аккаунта, что назвал ERP: чужую переписку Meta с ним не отдаст.
export async function GET(request: NextRequest, { params }: RouteProps) {
  if (!erpKeyMatches(request)) return erpDenied();
  const account = await erpAccount(request.nextUrl.searchParams.get("instagramId"));
  if (!account) return erpError("Instagram account not connected", 404);
  const { id } = await params;

  try {
    const raw = await getConversationMessages(decryptToken(account.accessToken), id);
    const messages = raw
      .map((m) => ({
        id: m.id,
        text: m.message ?? "",
        fromMe: m.from?.id === account.instagramId,
        fromId: m.from?.id ?? null,
        createdTime: m.created_time ?? null,
      }))
      .reverse();
    return NextResponse.json({ success: true, data: { messages } });
  } catch (err) {
    console.error("[ERP conversation] Error:", err);
    return erpError(err instanceof MetaApiError ? err.message : "Failed to load messages", 502);
  }
}
