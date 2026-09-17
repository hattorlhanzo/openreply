import { NextRequest, NextResponse } from "next/server";
import { API_ERRORS } from "@/lib/i18n/common";
import {
  MAX_IMAGE_BYTES,
  mediaPath,
  saveImage,
  sniffImageMime,
} from "@/lib/media/storage";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { areDmPhotosEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Загрузка фотографии для кампании. */
export async function POST(request: NextRequest) {
  if (!areDmPhotosEnabled()) {
    return NextResponse.json(
      { success: false, error: API_ERRORS.dmPhotosDisabled },
      { status: 403 }
    );
  }

  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: API_ERRORS.unauthorized },
      { status: 401 }
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: API_ERRORS.ownersAndAdminsOnlyCampaigns },
      { status: 403 }
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    file = null;
  }

  if (!file) {
    return NextResponse.json(
      { success: false, error: "Файл не получен" },
      { status: 400 }
    );
  }

  // Размер проверяется дважды: заявленный — чтобы не читать в память заведомо
  // большой файл, фактический — потому что заявленному верить нельзя.
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { success: false, error: "Файл больше 8 МБ" },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { success: false, error: "Файл больше 8 МБ" },
      { status: 400 }
    );
  }

  const mime = sniffImageMime(bytes);
  if (!mime) {
    return NextResponse.json(
      { success: false, error: "Instagram принимает только JPEG и PNG" },
      { status: 400 }
    );
  }

  const name = await saveImage(bytes, mime);
  return NextResponse.json({
    success: true,
    data: { name, url: mediaPath(name) },
  });
}
