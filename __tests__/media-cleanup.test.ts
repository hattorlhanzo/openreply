import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm, utimes, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { automation: { findMany: vi.fn() } },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

const { ORPHAN_GRACE_MS, cleanupOrphanImages } = await import("@/lib/media/cleanup");

const NAME_USED = "0123456789abcdef0123456789abcdef.jpg";
const NAME_ORPHAN = "fedcba9876543210fedcba9876543210.png";
const NAME_FRESH = "aaaabbbbccccddddeeeeffff00001111.jpg";

describe("уборка неиспользуемых фотографий", () => {
  let dir: string;
  const previous = process.env.MEDIA_DIR;

  async function put(name: string, ageMs: number) {
    const file = path.join(dir, name);
    await writeFile(file, "x");
    const when = new Date(Date.now() - ageMs);
    await utimes(file, when, when);
  }

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "openreply-cleanup-"));
    process.env.MEDIA_DIR = dir;
    mockPrisma.automation.findMany.mockReset();
  });

  afterEach(async () => {
    process.env.MEDIA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  });

  it("удаляет только старый файл, на который никто не ссылается", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([{ dmImages: [NAME_USED] }]);
    await put(NAME_USED, ORPHAN_GRACE_MS * 2);
    await put(NAME_ORPHAN, ORPHAN_GRACE_MS * 2);
    // Свежий файл — это фотография незаконченного черновика.
    await put(NAME_FRESH, 60_000);

    const result = await cleanupOrphanImages();

    expect(result).toEqual({ scanned: 3, deleted: 1, kept: 2 });
    const left = (await readdir(dir)).sort();
    expect(left).toEqual([NAME_FRESH, NAME_USED].sort());
  });

  it("не трогает посторонние файлы в каталоге", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([]);
    await put("readme.txt", ORPHAN_GRACE_MS * 2);

    const result = await cleanupOrphanImages();

    expect(result.deleted).toBe(0);
    expect(await readdir(dir)).toEqual(["readme.txt"]);
  });

  // Если список используемых файлов не прочитался, удалять нельзя: иначе
  // сбой базы стёр бы фотографии живых кампаний.
  it("при ошибке базы не удаляет ничего", async () => {
    mockPrisma.automation.findMany.mockRejectedValue(new Error("db down"));
    await put(NAME_ORPHAN, ORPHAN_GRACE_MS * 2);

    await expect(cleanupOrphanImages()).rejects.toThrow("db down");
    expect(await readdir(dir)).toEqual([NAME_ORPHAN]);
  });

  it("на отсутствующий каталог отвечает нулями", async () => {
    process.env.MEDIA_DIR = path.join(dir, "нет-такого");
    expect(await cleanupOrphanImages()).toEqual({ scanned: 0, deleted: 0, kept: 0 });
  });
});
