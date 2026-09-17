/**
 * Уборка фотографий, которые ни одна кампания не использует.
 *
 * Файл появляется на диске в момент загрузки, а в кампанию попадает только
 * при сохранении. Черновик, который бросили, оставил бы файл навсегда.
 */

import { readdir, stat, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/client";
import { getMediaDir, isMediaName } from "@/lib/media/storage";

/**
 * Сколько файл живёт, даже если на него никто не ссылается. Защищает
 * незаконченный черновик: человек загрузил фотографии и ушёл пить кофе.
 */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export type CleanupResult = { scanned: number; deleted: number; kept: number };

export async function cleanupOrphanImages(now = Date.now()): Promise<CleanupResult> {
  const dir = getMediaDir();

  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    // Каталога ещё нет — значит и убирать нечего.
    return { scanned: 0, deleted: 0, kept: 0 };
  }

  // Список используемых файлов берём до удаления: если запрос упадёт, ошибка
  // прервёт уборку и ни один файл не пострадает.
  const automations = await prisma.automation.findMany({
    select: { dmImages: true },
  });
  const used = new Set(automations.flatMap((automation) => automation.dmImages));

  let deleted = 0;
  let kept = 0;

  for (const name of names) {
    if (!isMediaName(name)) {
      kept += 1;
      continue;
    }
    if (used.has(name)) {
      kept += 1;
      continue;
    }

    const file = path.join(dir, name);
    try {
      const info = await stat(file);
      if (now - info.mtimeMs < ORPHAN_GRACE_MS) {
        kept += 1;
        continue;
      }
      await unlink(file);
      deleted += 1;
    } catch {
      // Файл мог исчезнуть между чтением каталога и удалением — это не ошибка.
      kept += 1;
    }
  }

  return { scanned: names.length, deleted, kept };
}
