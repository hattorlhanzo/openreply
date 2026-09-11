import { NextRequest, NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/bot-auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { getAllUserMedia, getUserMedia } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { API_ERRORS } from "@/lib/i18n/common";

export async function GET(request: NextRequest) {
  // Session cookie for the dashboard, BOT_API_KEY for the Telegram bot.
  const workspaceId = await resolveWorkspaceId(request);
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: API_ERRORS.unauthorized },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );

  if (!account) {
    return NextResponse.json(
      {
        success: false,
        error: API_ERRORS.connectInstagramFirst,
      },
      { status: 400 }
    );
  }

  try {
    const accessToken = decryptToken(account.accessToken);

    // `all=true` paginates the full library (for the campaign post picker);
    // otherwise return a single recent page.
    const loadAll = request.nextUrl.searchParams.get("all") === "true";
    let posts;
    if (loadAll) {
      posts = await getAllUserMedia(accessToken, 300);
    } else {
      const limitParam = request.nextUrl.searchParams.get("limit");
      const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 25;
      const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 50)
        : 25;
      posts = await getUserMedia(accessToken, limit);
    }

    return NextResponse.json({ success: true, data: posts });
  } catch (err) {
    console.error("[Instagram Posts] Error:", err);
    return NextResponse.json(
      { success: false, error: API_ERRORS.failedToFetchPosts },
      { status: 500 }
    );
  }
}
