import { NextRequest, NextResponse } from "next/server";
import { erpAccount, erpDenied, erpError, erpKeyMatches } from "@/lib/erp-auth";
import { getConversations, MetaApiError } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

// Переписки аккаунта, свежие первыми, с последним сообщением.
export async function GET(request: NextRequest) {
  if (!erpKeyMatches(request)) return erpDenied();
  const account = await erpAccount(request.nextUrl.searchParams.get("instagramId"));
  if (!account) return erpError("Instagram account not connected", 404);

  try {
    const raw = await getConversations(decryptToken(account.accessToken), account.instagramId);
    const conversations = raw.map((c) => {
      const participants = c.participants?.data ?? [];
      const contact =
        participants.find((p) => p.id !== account.instagramId) ?? participants[0] ?? null;
      const last = c.messages?.data?.[0] ?? null;
      return {
        id: c.id,
        contact: { id: contact?.id ?? "", username: contact?.username ?? null },
        updatedTime: c.updated_time ?? null,
        lastMessage: last
          ? {
              text: last.message ?? "",
              fromMe: last.from?.id === account.instagramId,
              createdTime: last.created_time ?? null,
            }
          : null,
      };
    });
    return NextResponse.json({
      success: true,
      data: { conversations, account: { instagramId: account.instagramId, username: account.username } },
    });
  } catch (err) {
    console.error("[ERP conversations] Error:", err);
    return erpError(err instanceof MetaApiError ? err.message : "Failed to load conversations", 502);
  }
}
