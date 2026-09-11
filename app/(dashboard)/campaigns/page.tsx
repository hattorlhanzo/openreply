"use client";

/**
 * Campaigns List Page
 *
 * Shows all campaigns as cards with toggle and delete.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { readCache, writeCache } from "@/lib/client-cache";
import { pluralRu } from "@/lib/i18n/common";
import {
  IconCheck,
  IconLink,
  IconPlus,
  IconSearch,
  IconZap,
} from "@/components/ui/icons";

const STATUS_FILTER_LABEL = {
  all: "Все",
  active: "Активные",
  paused: "На паузе",
} as const;

interface Campaign {
  id: string;
  name: string;
  goal: string | null;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  isActive: boolean;
  wholeWordMatch: boolean;
  instagramAccountId: string;
  instagramAccount: {
    username: string;
    instagramId: string;
  };
  reportShareSlug: string | null;
  reportShareEnabled: boolean;
  reportUrl: string | null;
  createdAt: string;
  _count: { dmLogs: number };
  trackedLinks: Array<{
    id: string;
    slug: string;
    label: string | null;
    destinationUrl: string;
    trackedUrl: string;
    _count: { clicks: number };
  }>;
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    ctr: number;
    topKeywords: { keyword: string; count: number }[];
  };
}

export default function CampaignsPage() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [loading, setLoading] = useState(true);
  // postId -> current thumbnail URL, fetched live (Instagram URLs expire, so
  // they are never stored on the campaign).
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  // postId -> video URL for reels, so a campaign thumbnail can play on click.
  const [videos, setVideos] = useState<Record<string, string>>({});
  // The reel currently playing in the lightbox (null when closed).
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    postUrl: string | null;
  } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">(
    "all"
  );

  const fetchAutomations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAccountId !== "all") {
        params.set("instagramAccountId", selectedAccountId);
      }
      const res = await fetch(
        `/api/automations${params.size ? `?${params}` : ""}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.success) setAutomations(data.data);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setAccounts(payload.data.instagramAccounts ?? []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAutomations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAutomations]);

  // Fetch fresh post thumbnails (and reel video URLs) for the accounts in view
  // and map them by postId. Cache-first so they show instantly on a return
  // visit. Instagram URLs expire, so they are never stored on the campaign.
  useEffect(() => {
    if (automations.length === 0) return;
    let cancelled = false;
    const accountIds = Array.from(
      new Set(automations.map((a) => a.instagramAccountId))
    ).sort();
    const cacheKey = `ig-media:${accountIds.join(",")}`;

    const cached = readCache<{
      thumbs: Record<string, string>;
      videos: Record<string, string>;
    }>(cacheKey, 15 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (cached.data) {
      setThumbnails(cached.data.thumbs);
      setVideos(cached.data.videos);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    Promise.all(
      accountIds.map((accountId) =>
        fetch(`/api/instagram/posts?instagramAccountId=${accountId}&limit=50`)
          .then((res) => res.json())
          .then((payload) =>
            payload.success
              ? (payload.data as {
                  id: string;
                  media_type?: string;
                  media_url?: string;
                  thumbnail_url?: string;
                }[])
              : []
          )
          .catch(() => [])
      )
    ).then((lists) => {
      if (cancelled) return;
      const thumbs: Record<string, string> = {};
      const vids: Record<string, string> = {};
      for (const list of lists) {
        for (const media of list) {
          const url = media.thumbnail_url ?? media.media_url;
          if (url) thumbs[media.id] = url;
          if (media.media_type === "VIDEO" && media.media_url) {
            vids[media.id] = media.media_url;
          }
        }
      }
      setThumbnails(thumbs);
      setVideos(vids);
      writeCache(cacheKey, { thumbs, videos: vids });
    });

    return () => {
      cancelled = true;
    };
  }, [automations]);

  // Close the reel lightbox on Escape.
  useEffect(() => {
    if (!playingVideo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayingVideo(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playingVideo]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await fetch(`/api/automations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: !isActive } : a))
      );
    } catch (err) {
      console.error("Failed to toggle:", err);
    }
  }

  async function copyReelUrl(auto: Campaign) {
    setMenuOpenId(null);
    if (!auto.postUrl) return;
    try {
      await navigator.clipboard.writeText(auto.postUrl);
      setCopiedId(auto.id);
      window.setTimeout(
        () => setCopiedId((cur) => (cur === auto.id ? null : cur)),
        1500
      );
    } catch (err) {
      console.error("Failed to copy reel URL:", err);
    }
  }

  async function deleteAutomation(id: string) {
    if (!confirm("Удалить кампанию? Это действие нельзя отменить.")) return;
    try {
      await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  async function duplicateAutomation(auto: Campaign) {
    setMenuOpenId(null);
    const specific = !auto.matchAnyPost && !auto.pendingNextReel;
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${auto.name} (копия)`,
          instagramAccountId: auto.instagramAccountId,
          postId: specific ? auto.postId : null,
          postUrl: specific ? auto.postUrl : null,
          matchAnyPost: auto.matchAnyPost,
          pendingNextReel: auto.pendingNextReel,
          matchAnyWord: auto.matchAnyWord,
          keywords: auto.keywords,
          dmMessage: auto.dmMessage,
          openingDmEnabled: auto.openingDmEnabled,
          openingDmMessage: auto.openingDmMessage,
          openingDmButtonLabel: auto.openingDmButtonLabel,
          publicReplyEnabled: auto.publicReplyEnabled,
          publicReplyMessages: auto.publicReplyMessages,
          trackedDestinationUrl: auto.trackedLinks[0]?.destinationUrl ?? "",
          secondaryDestinationUrl: auto.trackedLinks[1]?.destinationUrl ?? "",
          secondaryButtonLabel: auto.trackedLinks[1]?.label ?? "Открыть ссылку",
          requireFollow: auto.requireFollow,
          followPromptMessage: auto.followPromptMessage,
          followPromptButtonLabel: auto.followPromptButtonLabel,
          wholeWordMatch: auto.wholeWordMatch,
          isActive: false,
        }),
      });
      const data = await res.json();
      if (data.success) void fetchAutomations();
      else console.error("Duplicate failed:", data.error);
    } catch (err) {
      console.error("Failed to duplicate:", err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-head">
          <div>
            <h1 className="page-title">Кампании</h1>
            <p className="page-sub">Загрузка…</p>
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card h-[132px]" />
          ))}
        </div>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const filtered = automations.filter((a) => {
    if (statusFilter === "active" && !a.isActive) return false;
    if (statusFilter === "paused" && a.isActive) return false;
    if (!query) return true;
    return (
      a.name.toLowerCase().includes(query) ||
      a.keywords.some((k) => k.toLowerCase().includes(query)) ||
      a.dmMessage.toLowerCase().includes(query)
    );
  });

  const activeCount = automations.filter((a) => a.isActive).length;
  const subtitle =
    automations.length === 0
      ? "Комментарий под публикацией → сообщение в Direct"
      : `${automations.length} ${pluralRu(automations.length, ["кампания", "кампании", "кампаний"])} · ${activeCount} ${pluralRu(activeCount, ["активная", "активные", "активных"])}` +
        (filtered.length !== automations.length
          ? ` · показано ${filtered.length}`
          : "");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-head flex-col sm:flex-row sm:!items-center">
        <div>
          <h1 className="page-title">Кампании</h1>
          <p className="page-sub">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accounts.length > 1 && (
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={handleAccountChange}
            />
          )}
          <Link href="/campaigns/import" className="btn btn-secondary">
            Импорт
          </Link>
          <Link href="/campaigns/new" className="btn btn-primary">
            <IconPlus size={16} />
            Новая кампания
          </Link>
        </div>
      </div>

      {/* Search + status filter */}
      {automations.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, ключевому слову или сообщению…"
              className="input !pl-9"
            />
          </div>
          <div className="seg shrink-0">
            {(["all", "active", "paused"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
                className="seg-item"
              >
                {STATUS_FILTER_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {automations.length === 0 && (
        <div className="card">
          <div className="empty !py-14">
            <span className="empty-icon">
              <IconZap size={22} />
            </span>
            <p className="empty-title">Кампаний пока нет</p>
            <p className="max-w-sm text-[13px] leading-relaxed">
              Создайте первую кампанию «комментарий → Direct», и публикация или
              Reels превратятся в измеримый поток диалогов.
            </p>
            <Link href="/campaigns/new" className="btn btn-primary mt-3">
              <IconPlus size={16} />
              Создать кампанию
            </Link>
          </div>
        </div>
      )}

      {/* No matches for the current filter */}
      {automations.length > 0 && filtered.length === 0 && (
        <div className="card">
          <div className="empty">
            <span className="empty-icon">
              <IconSearch size={20} />
            </span>
            <p className="empty-title">Ничего не найдено</p>
            <p className="text-[13px]">По вашему запросу кампаний не найдено.</p>
          </div>
        </div>
      )}

      {/* Campaign cards */}
      <div className="space-y-3">
        {filtered.map((auto) => {
          const videoUrl = auto.postId ? videos[auto.postId] : undefined;
          const thumb = auto.postId ? thumbnails[auto.postId] : undefined;
          const stats = [
            {
              value: auto._count.dmLogs,
              label: pluralRu(auto._count.dmLogs, ["запуск", "запуска", "запусков"]),
            },
            { value: auto.analytics.sent, label: "отправлено" },
            {
              value: auto.analytics.clicks,
              label: pluralRu(auto.analytics.clicks, ["переход", "перехода", "переходов"]),
            },
            { value: `${auto.analytics.ctr}%`, label: "CTR" },
            { value: auto.analytics.skipped, label: "пропущено" },
            {
              value: auto.analytics.failed,
              label: "с ошибкой",
              tone: auto.analytics.failed > 0 ? "text-error" : "",
            },
          ];
          return (
          <div
            key={auto.id}
            onClick={() => router.push(`/campaigns/${auto.id}`)}
            className="card card-hover cursor-pointer p-5 transition-colors"
          >
            {/* Wraps rather than compressing: on a phone the action buttons drop
                to their own line instead of squeezing the campaign summary. */}
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              {thumb ? (
                videoUrl ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlayingVideo({ url: videoUrl, postUrl: auto.postUrl });
                    }}
                    aria-label="Воспроизвести Reels"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt="Reels кампании"
                      className="h-11 w-11 rounded-[10px] border border-border object-cover hover:border-border-hover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </button>
                ) : (
                  <a
                    href={auto.postUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt="Публикация кампании"
                      className="h-11 w-11 rounded-[10px] border border-border object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </a>
                )
              ) : (
                <span
                  className={`icon-tile !h-11 !w-11 ${auto.isActive ? "icon-tile-success" : "icon-tile-muted"}`}
                >
                  <IconZap size={20} />
                </span>
              )}

              <div className="min-w-[12rem] flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[15px] font-semibold text-foreground">
                    {auto.name}
                  </h3>
                  <span
                    className={`badge ${auto.isActive ? "badge-success" : "badge-muted"}`}
                  >
                    {auto.isActive ? "Активна" : "На паузе"}
                  </span>
                  <span className="chip chip-outline">@{auto.instagramAccount.username}</span>
                  {auto.pendingNextReel && (
                    <span className="badge badge-warning badge-plain">
                      Ждёт следующий Reels
                    </span>
                  )}
                  {auto.requireFollow && (
                    <span className="badge badge-accent badge-plain">
                      Проверка подписки
                    </span>
                  )}
                  {auto.trackedLinks.length >= 2 && (
                    <span className="badge badge-accent badge-plain">2 ссылки</span>
                  )}
                </div>

                {/* Keywords */}
                {auto.keywords.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {auto.keywords.map((kw) => (
                      <span key={kw} className="chip">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* DM preview */}
                <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
                  &ldquo;{auto.dmMessage}&rdquo;
                </p>

                {/* Tracked link sent */}
                {auto.trackedLinks[0]?.trackedUrl && (
                  <p className="mt-1.5 flex items-center gap-1.5 truncate font-mono text-[12px] text-muted">
                    <IconLink size={13} className="shrink-0 text-muted" />
                    <span className="truncate">{auto.trackedLinks[0].trackedUrl}</span>
                  </p>
                )}

                {/* Stats */}
                <div className="mt-3 flex flex-wrap">
                  {stats.map((s, i) => (
                    <div
                      key={s.label}
                      className={`pr-4 ${i > 0 ? "border-l border-border-subtle pl-4" : ""}`}
                    >
                      <p
                        className={`text-[15px] font-semibold leading-tight tabular-nums ${s.tone || "text-foreground"}`}
                      >
                        {s.value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">{s.label}</p>
                    </div>
                  ))}
                </div>

                {auto.analytics.topKeywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {auto.analytics.topKeywords.map((keyword) => (
                      <span key={keyword.keyword} className="chip chip-outline">
                        {keyword.keyword}
                        <span className="tabular-nums text-foreground">{keyword.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div
                className="ml-auto flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Copy reel URL */}
                {auto.postUrl && (
                  <button
                    type="button"
                    onClick={() => void copyReelUrl(auto)}
                    className="btn btn-ghost btn-sm"
                  >
                    {copiedId === auto.id ? (
                      <>
                        <IconCheck size={15} className="text-success" />
                        Скопировано
                      </>
                    ) : (
                      <>
                        <IconLink size={15} />
                        Ссылка
                      </>
                    )}
                  </button>
                )}
                {/* Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={auto.isActive}
                  aria-label={auto.isActive ? "Поставить на паузу" : "Включить"}
                  onClick={() => toggleActive(auto.id, auto.isActive)}
                  className={`relative mx-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
                    auto.isActive ? "bg-accent" : "bg-border-hover"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      auto.isActive ? "left-6" : "left-1"
                    }`}
                  />
                </button>

                {/* Kebab menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setMenuOpenId((cur) => (cur === auto.id ? null : auto.id))
                    }
                    aria-label="Ещё действия"
                    className="btn btn-ghost btn-icon text-lg leading-none"
                  >
                    ⋯
                  </button>
                  {menuOpenId === auto.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div
                        className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-[10px] border border-border bg-surface p-1"
                        style={{ boxShadow: "var(--shadow-pop)" }}
                      >
                        <button
                          type="button"
                          onClick={() => void duplicateAutomation(auto)}
                          className="block w-full rounded-[7px] px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover"
                        >
                          Дублировать
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpenId(null);
                            void deleteAutomation(auto.id);
                          }}
                          className="block w-full rounded-[7px] px-3 py-2 text-left text-[13px] text-error hover:bg-surface-hover"
                        >
                          Удалить
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {/* Reel lightbox */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "var(--backdrop)" }}
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="relative flex max-w-full flex-col items-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {playingVideo.postUrl && (
                <a
                  href={playingVideo.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                >
                  Открыть в Instagram
                </a>
              )}
              <button
                type="button"
                onClick={() => setPlayingVideo(null)}
                className="btn btn-secondary btn-sm"
              >
                Закрыть
              </button>
            </div>
            <video
              src={playingVideo.url}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[80vh] max-w-full rounded-[14px] border border-border"
            />
          </div>
        </div>
      )}
    </div>
  );
}
