import { NextRequest, NextResponse } from "next/server";
import { erpAccount, erpDenied, erpError, erpKeyMatches } from "@/lib/erp-auth";
import { MetaApiError, sendDirectMessage } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";

export const dynamic = "force-dynamic";

// Ответ в директ от имени аккаунта. Частая ошибка — закрытое окно 24 часов после
// последнего сообщения клиента; текст Meta отдаём как есть, ERP его показывает.
export async function POST(request: NextRequest) {
  if (!erpKeyMatches(request)) return erpDenied();
  let body: { instagramId?: string; recipientId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return erpError("Invalid JSON", 400);
  }
  const text = body.text?.trim();
  if (!body.recipientId || !text) return erpError("recipientId and text required", 400);
  const account = await erpAccount(body.instagramId ?? null);
  if (!account) return erpError("Instagram account not connected", 404);

  try {
    const result = await sendDirectMessage(
      decryptToken(account.accessToken),
      account.instagramId,
      body.recipientId,
      text
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[ERP send] Error:", err);
    return erpError(err instanceof MetaApiError ? err.message : "Failed to send message", 502);
  }
}
