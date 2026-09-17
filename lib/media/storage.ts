/**
 * Хранилище фотографий кампаний.
 *
 * Файл лежит на диске в MEDIA_DIR под случайным именем, а в кампании хранится
 * только это имя. Абсолютный адрес собирается на отправке, поэтому смена
 * домена не ломает уже созданные кампании.
 *
 * Meta скачивает картинку сама по публичному адресу, значит каталог обязан
 * раздаваться без пароля, а имя — быть неугадываемым.
 */

import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

/** Предел Meta на одно вложение. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Сколько фотографий разрешено в одной кампании. */
export const MAX_IMAGES_PER_CAMPAIGN = 3;

export type ImageMime = "image/jpeg" | "image/png";

const EXTENSION_BY_MIME: Record<ImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

const MIME_BY_EXTENSION: Record<string, ImageMime> = {
  jpg: "image/jpeg",
  png: "image/png",
};

/**
 * Имя файла: 32 hex-символа и расширение. Регулярка заодно закрывает обход
 * каталога — в имени физически не может быть слэша или точек.
 */
export const MEDIA_NAME_PATTERN = /^[a-f0-9]{32}\.(jpg|png)$/;

export function isMediaName(value: string): boolean {
  return MEDIA_NAME_PATTERN.test(value);
}

export function getMediaDir(): string {
  return process.env.MEDIA_DIR ?? path.join(process.cwd(), ".media");
}

/**
 * Тип определяется по магическим байтам, а не по расширению и не по
 * Content-Type запроса: и то и другое присылает клиент.
 */
export function sniffImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  return null;
}

export function mimeForMediaName(name: string): ImageMime | null {
  const extension = name.split(".").pop() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

export async function saveImage(bytes: Uint8Array, mime: ImageMime): Promise<string> {
  const name = `${randomBytes(16).toString("hex")}.${EXTENSION_BY_MIME[mime]}`;
  const dir = getMediaDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return name;
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (!isMediaName(name)) return null;
  try {
    return await readFile(path.join(getMediaDir(), name));
  } catch {
    return null;
  }
}

/** Путь для браузера. Относительный, чтобы работал на любом домене. */
export function mediaPath(name: string): string {
  return `/media/${name}`;
}

/**
 * Абсолютный адрес для Meta: она скачивает картинку со своей стороны, поэтому
 * относительный путь ей бесполезен.
 */
export function mediaUrl(name: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${mediaPath(name)}`;
}
