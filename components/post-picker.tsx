"use client";

/* eslint-disable @next/next/no-img-element */

/**
 * Post Picker
 *
 * Grid of Instagram post thumbnails, selectable.
 * Fetches from /api/instagram/posts.
 */

import { useEffect, useState } from "react";
import { readCache, writeCache } from "@/lib/client-cache";
import { IconCheck, IconInstagram, IconSearch } from "@/components/ui/icons";

const PAGE_SIZE = 60;

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
}

interface PostPickerProps {
  selectedPostId: string | null;
  instagramAccountId?: string | null;
  /** postId -> name of the campaign already using it. Flagged in the grid. */
  usedPostIds?: Record<string, string>;
  onSelect: (
    postId: string,
    postUrl?: string,
    thumbUrl?: string,
    caption?: string
  ) => void;
}

export default function PostPicker({
  selectedPostId,
  instagramAccountId,
  usedPostIds,
  onSelect,
}: PostPickerProps) {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // The post currently hovered — its video (if it's a reel) plays a preview.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // The grid loads the whole library (all=true). On accounts with hundreds of
  // posts, rendering every tile at once is enough to make mobile Safari drop
  // the page, so they are revealed in batches.
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (instagramAccountId) {
      params.set("instagramAccountId", instagramAccountId);
    }
    // Load the full library so older posts/reels are selectable, not just the
    // most recent page.
    params.set("all", "true");

    // Show the cached library instantly (stale-while-revalidate), then refresh.
    const cacheKey = `ig-posts:${instagramAccountId ?? "default"}`;
    const cached = readCache<InstagramPost[]>(cacheKey, 15 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (cached.data) {
      setPosts(cached.data);
      setLoading(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch(`/api/instagram/posts${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setPosts(data.data);
          writeCache(cacheKey, data.data);
        } else if (!cached.data) {
          setError(data.error ?? "Не удалось загрузить публикации");
        }
      })
      .catch(() => {
        if (!cancelled && !cached.data) setError("Не удалось загрузить публикации");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [instagramAccountId]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="skeleton aspect-square !rounded-[10px]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty !py-8">
        <span className="empty-icon">
          <IconInstagram size={20} />
        </span>
        <p className="empty-title">{error}</p>
        <p className="text-[12px]">Сначала подключите Instagram-аккаунт</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="empty !py-8">
        <span className="empty-icon">
          <IconInstagram size={20} />
        </span>
        <p className="empty-title">Публикации не найдены</p>
      </div>
    );
  }

  const matching = query.trim()
    ? posts.filter((p) =>
        (p.caption ?? "").toLowerCase().includes(query.trim().toLowerCase())
      )
    : posts;

  const visible = matching.slice(0, shown);
  const remaining = matching.length - visible.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Back to one batch on every new search. Without this, a grid
              // expanded under an earlier query stays expanded once it is
              // cleared, which is the case this whole change exists to avoid.
              setShown(PAGE_SIZE);
            }}
            placeholder="Поиск публикаций по подписи…"
            className="input !h-9 !pl-9 !text-[13px]"
          />
        </div>
        <span className="badge badge-plain badge-muted tabular-nums">{posts.length}</span>
      </div>
      {visible.length === 0 ? (
        <div className="empty !py-6">
          <p className="text-[13px]">
            По запросу &laquo;{query}&raquo; ничего не найдено
          </p>
        </div>
      ) : (
        <>
          {usedPostIds && Object.keys(usedPostIds).length > 0 && (
            <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px] border-2 border-warning" />
              Уже используется в другой кампании
            </p>
          )}
          {/* auto-rows-min + content-start keep each row at its natural height.
              Without them the rows share out max-h-64 instead of scrolling, and
              the square thumbnails flatten into strips. */}
          <div className="grid max-h-64 auto-rows-min grid-cols-3 content-start gap-2 overflow-y-auto p-1 sm:grid-cols-4">
            {visible.map((post) => {
              const isSelected = selectedPostId === post.id;
              const usedByName = usedPostIds?.[post.id];
              const isUsed = Boolean(usedByName) && !isSelected;
              const thumb = post.thumbnail_url ?? post.media_url;
              const isVideo = post.media_type === "VIDEO";
              const showVideo =
                isVideo && hoveredId === post.id && Boolean(post.media_url);
              return (
          <button
            key={post.id}
            type="button"
            onClick={() => onSelect(post.id, post.permalink, thumb, post.caption)}
            onMouseEnter={() => setHoveredId(post.id)}
            onMouseLeave={() =>
              setHoveredId((cur) => (cur === post.id ? null : cur))
            }
            aria-pressed={isSelected}
            title={isUsed ? `Уже используется в кампании «${usedByName}»` : undefined}
            className={`
              relative aspect-square overflow-hidden rounded-[10px] border-2 bg-surface-2 transition-colors
              ${
                isSelected
                  ? "border-accent"
                  : isUsed
                    ? "border-warning/60 hover:border-warning"
                    : "border-transparent hover:border-border-hover"
              }
            `}
          >
            {thumb ? (
              <img
                src={thumb}
                alt={post.caption?.slice(0, 50) ?? "Публикация Instagram"}
                loading="lazy"
                decoding="async"
                className={`h-full w-full object-cover ${isUsed ? "opacity-60" : ""}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-[11px] text-muted">Нет изображения</span>
              </div>
            )}
            {showVideo && (
              <video
                src={post.media_url}
                poster={thumb}
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                className={`absolute inset-0 h-full w-full object-cover ${
                  isUsed ? "opacity-60" : ""
                }`}
              />
            )}
            {isVideo && !isSelected && (
              <span className="absolute left-1.5 top-1.5 rounded-[5px] bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Reels
              </span>
            )}
            {isSelected && (
              <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                <IconCheck size={12} strokeWidth={2.5} />
              </span>
            )}
          </button>
              );
            })}
          </div>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="btn btn-secondary btn-sm w-full"
            >
              Показать ещё {Math.min(PAGE_SIZE, remaining)}
            </button>
          )}
        </>
      )}
    </div>
  );
}
