import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  MAX_IMAGE_BYTES,
  isMediaName,
  mediaPath,
  mediaUrl,
  mimeForMediaName,
  readImage,
  saveImage,
  sniffImageMime,
} from "@/lib/media/storage";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("определение типа картинки", () => {
  it("узнаёт JPEG и PNG по магическим байтам", () => {
    expect(sniffImageMime(JPEG)).toBe("image/jpeg");
    expect(sniffImageMime(PNG)).toBe("image/png");
  });

  // Расширение и Content-Type присылает клиент, поэтому тип определяется
  // только по содержимому: иначе .jpg мог бы оказаться чем угодно.
  it("отклоняет всё остальное, включая GIF и HTML", () => {
    expect(sniffImageMime(new TextEncoder().encode("GIF89a..."))).toBeNull();
    expect(sniffImageMime(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageMime(new Uint8Array())).toBeNull();
  });

  it("держит предел вложения Meta в 8 МБ", () => {
    expect(MAX_IMAGE_BYTES).toBe(8 * 1024 * 1024);
  });
});

describe("имя файла", () => {
  it("принимает только 32 hex-символа с расширением jpg или png", () => {
    expect(isMediaName("0123456789abcdef0123456789abcdef.jpg")).toBe(true);
    expect(isMediaName("0123456789abcdef0123456789abcdef.png")).toBe(true);
    expect(isMediaName("0123456789abcdef0123456789abcdef.gif")).toBe(false);
    expect(isMediaName("short.jpg")).toBe(false);
  });

  // Имя приходит в адресе и подставляется в путь на диске: слэш или точки
  // означали бы чтение чужого файла.
  it("не пропускает обход каталога", () => {
    expect(isMediaName("../../etc/passwd")).toBe(false);
    expect(isMediaName("0123456789abcdef0123456789abcdef.jpg/../x")).toBe(false);
    expect(isMediaName("/etc/passwd")).toBe(false);
  });

  it("сопоставляет расширение и тип содержимого", () => {
    expect(mimeForMediaName("0123456789abcdef0123456789abcdef.jpg")).toBe("image/jpeg");
    expect(mimeForMediaName("0123456789abcdef0123456789abcdef.png")).toBe("image/png");
    expect(mimeForMediaName("file.txt")).toBeNull();
  });
});

describe("адреса", () => {
  it("браузеру отдаёт относительный путь", () => {
    expect(mediaPath("0123456789abcdef0123456789abcdef.jpg")).toBe(
      "/media/0123456789abcdef0123456789abcdef.jpg"
    );
  });

  // Meta скачивает картинку сама, поэтому адрес обязан быть абсолютным;
  // лишний слэш в конце домена не должен удваиваться в пути.
  it("для Meta собирает абсолютный адрес", () => {
    const name = "0123456789abcdef0123456789abcdef.png";
    expect(mediaUrl(name, "https://instagram.moy-control.ru")).toBe(
      `https://instagram.moy-control.ru/media/${name}`
    );
    expect(mediaUrl(name, "https://instagram.moy-control.ru/")).toBe(
      `https://instagram.moy-control.ru/media/${name}`
    );
  });
});

describe("сохранение и чтение", () => {
  let dir: string;
  const previous = process.env.MEDIA_DIR;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "openreply-media-"));
    process.env.MEDIA_DIR = dir;
  });

  afterEach(async () => {
    process.env.MEDIA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  });

  it("кладёт файл под случайным именем и читает его обратно", async () => {
    const name = await saveImage(JPEG, "image/jpeg");
    expect(isMediaName(name)).toBe(true);
    expect(name.endsWith(".jpg")).toBe(true);

    const bytes = await readImage(name);
    expect(bytes).not.toBeNull();
    expect(new Uint8Array(bytes as Buffer)).toEqual(JPEG);
  });

  it("выдаёт разные имена одинаковым файлам", async () => {
    const first = await saveImage(PNG, "image/png");
    const second = await saveImage(PNG, "image/png");
    expect(first).not.toBe(second);
  });

  it("на кривое имя и на пропавший файл отвечает null, а не ошибкой", async () => {
    expect(await readImage("../../etc/passwd")).toBeNull();
    expect(await readImage("0123456789abcdef0123456789abcdef.jpg")).toBeNull();
  });
});
