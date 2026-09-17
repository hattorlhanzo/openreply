import { NextResponse } from "next/server";
import { mimeForMediaName, readImage } from "@/lib/media/storage";

/**
 * Публичная раздача фотографий кампаний.
 *
 * Без авторизации намеренно: картинку скачивает Meta, когда отправляет
 * вложение в Direct. Защита — неугадываемое имя файла.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const mime = mimeForMediaName(file);
  const bytes = mime ? await readImage(file) : null;
  if (!mime || !bytes) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      // Имя файла случайное и на содержимое завязано один к одному, поэтому
      // кэшировать можно навсегда.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
