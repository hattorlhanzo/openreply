import { NextRequest, NextResponse } from "next/server";
import { cleanupOrphanImages } from "@/lib/media/cleanup";

/** Удаляет фотографии, которые не попали ни в одну кампанию. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const result = await cleanupOrphanImages();
  return NextResponse.json({ success: true, data: result });
}
