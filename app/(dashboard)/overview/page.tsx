"use client";

/**
 * Аккаунт (обзор Instagram)
 *
 * Aggregate reach/engagement across your recent posts, plus a per-post table.
 * Views / reach / saved / shares come from Instagram media insights (requires
 * the insights permission); likes and comments are always available.
 */

import { useEffect, useState } from "react";
import AccountSelect from "@/components/account-select";
import StatCard from "@/components/stat-card";
import FollowerChart from "@/components/follower-chart";
import type { OverviewResponse } from "@/app/api/instagram/overview/route";
import {
  formatCompactRu,
  formatDayRu,
  formatNumberRu,
  pluralRu,
} from "@/lib/i18n/common";
import {
  IconActivity,
  IconAlert,
  IconInbox,
  IconInstagram,
  IconLink,
  IconMessage,
  IconRefresh,
  IconTarget,
  IconTrendUp,
  IconUsers,
} from "@/components/ui/icons";

function formatNumber(n: number | null): string {
  if (n === null) return "—";
  return formatCompactRu(n);
}

const formatDate = formatDayRu;

const COUNT_OPTIONS = [
  { value: "25", label: "Последние 25" },
  { value: "50", label: "Последние 50" },
  { value: "100", label: "Последние 100" },
  { value: "all", label: "За всё время" },
];

const MEDIA_TYPE_LABEL: Record<string, string> = {
  IMAGE: "Фото",
  VIDEO: "Видео",
  CAROUSEL_ALBUM: "Карусель",
  REELS: "Reels",
  FEED: "Публикация",
  STORY: "Сторис",
};

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [count, setCount] = useState("50");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") {
      params.set("instagramAccountId", selectedAccountId);
    }
    params.set("count", count);

    fetch(`/api/instagram/overview?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setError(null);
        } else {
          setError(res.error ?? "Не удалось загрузить данные аккаунта");
        }
      })
      .catch(() => setError("Не удалось загрузить данные аккаунта"))
      .finally(() => setLoading(false));
  }, [selectedAccountId, count]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  function handleCountChange(next: string) {
    setLoading(true);
    setCount(next);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="skeleton h-14 w-14 !rounded-full" />
            <div>
              <div className="skeleton h-5 w-40" />
              <div className="skeleton mt-2 h-4 w-56" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-8 w-8 !rounded-[9px]" />
              </div>
              <div className="skeleton mt-3 h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="card h-72" />
      </div>
    );
  }

  if (error) {
    const needsConnect = error.includes("connect") || error.includes("подключ");
    return (
      <div className="space-y-6">
        <div className="page-head">
          <div>
            <h1 className="page-title">Аккаунт</h1>
            <p className="page-sub">Статистика подключённого Instagram-аккаунта</p>
          </div>
        </div>
        <div className="card">
          <div className="empty py-14">
            <span className="empty-icon icon-tile-error">
              <IconAlert size={22} />
            </span>
            <p className="empty-title">Данные аккаунта недоступны</p>
            <p className="max-w-sm text-[13px]">{error}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {needsConnect ? (
                <a href="/api/instagram/connect" className="btn btn-primary">
                  <IconInstagram size={16} />
                  Подключить Instagram
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => window.location.reload()}
                >
                  <IconRefresh size={16} />
                  Обновить
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, posts, accounts, insightsAvailable, followers, followerHistory } =
    data;
  const initial = data.account.username.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Шапка профиля */}
      <div className="card">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="avatar !h-14 !w-14 !text-[20px]">{initial}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[18px] font-bold tracking-tight text-foreground">
                  @{data.account.username}
                </h1>
                <span className="badge badge-success">Подключено</span>
              </div>
              <p className="mt-0.5 text-[13px] text-muted">
                {followers !== null && (
                  // Kept out of the tile row below: that row sums the selected posts,
                  // whereas this is a current account-level total.
                  <>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatNumberRu(followers)}
                    </span>{" "}
                    {pluralRu(followers, ["подписчик", "подписчика", "подписчиков"])}
                    {" · "}
                  </>
                )}
                {data.requestedCount === "all" ? "за всё время" : "недавние"} —{" "}
                <span className="tabular-nums">{totals.posts}</span>{" "}
                {pluralRu(totals.posts, ["публикация", "публикации", "публикаций"])}
                {data.truncated ? ` (не больше ${totals.posts})` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-muted">Период</span>
              <select
                value={count}
                onChange={(e) => handleCountChange(e.target.value)}
                className="select !h-9 min-w-44 text-[13px]"
              >
                {COUNT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {accounts.length > 1 && (
              <AccountSelect
                accounts={accounts.map((a) => ({
                  id: a.id,
                  username: a.username,
                  instagramId: a.id,
                }))}
                value={selectedAccountId}
                onChange={handleAccountChange}
                compact
              />
            )}
          </div>
        </div>
      </div>

      {!insightsAvailable && (
        <div className="card">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="icon-tile icon-tile-warning">
              <IconAlert size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-foreground">
                Для просмотров, охвата, сохранений и репостов нужно разрешение на
                статистику.
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                Переподключите аккаунт, чтобы выдать его, — пока показываем лайки и
                комментарии.
              </p>
            </div>
            <a href="/api/instagram/connect" className="btn btn-secondary btn-sm shrink-0">
              <IconInstagram size={15} />
              Переподключить Instagram
            </a>
          </div>
        </div>
      )}

      {/* Суммарные показатели */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        <StatCard
          label="Просмотры"
          value={formatNumber(totals.views)}
          icon={<IconActivity size={16} />}
          tone="accent"
        />
        <StatCard
          label="Охват"
          value={formatNumber(totals.reach)}
          icon={<IconUsers size={16} />}
          tone="accent"
        />
        <StatCard
          label="Лайки"
          value={formatNumber(totals.likes)}
          icon={<IconTrendUp size={16} />}
          tone="success"
        />
        <StatCard
          label="Комментарии"
          value={formatNumber(totals.comments)}
          icon={<IconMessage size={16} />}
          tone="success"
        />
        <StatCard
          label="Сохранения"
          value={formatNumber(totals.saved)}
          icon={<IconTarget size={16} />}
          tone="muted"
        />
        <StatCard
          label="Репосты"
          value={formatNumber(totals.shares)}
          icon={<IconLink size={16} />}
          tone="muted"
        />
      </div>

      {/* Динамика подписчиков — уровень аккаунта, не зависит от периода публикаций */}
      <FollowerChart data={followerHistory} followers={followers} />

      {/* Таблица публикаций */}
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Публикации</h2>
          <span className="badge badge-plain badge-muted tabular-nums">
            {totals.posts}
          </span>
        </div>
        {posts.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <IconInbox size={20} />
            </span>
            <p className="empty-title">Публикаций не найдено</p>
          </div>
        ) : (
          // Eight metric columns can't compress into a phone; let the table keep
          // its natural width and scroll inside the card instead.
          <div className="overflow-x-auto">
            <table className="tbl min-w-[760px]">
              <thead>
                <tr>
                  <th>Публикация</th>
                  <th className="!text-right">Просмотры</th>
                  <th className="!text-right">Охват</th>
                  <th className="!text-right">Лайки</th>
                  <th className="!text-right">Комментарии</th>
                  <th className="!text-right">Сохранения</th>
                  <th className="!text-right">Репосты</th>
                  <th className="!text-right">Дата</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => {
                  const typeLabel = MEDIA_TYPE_LABEL[p.mediaType] ?? "Публикация";
                  const title = p.caption || typeLabel;
                  return (
                    <tr key={p.id}>
                      <td className="max-w-xs">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="chip chip-outline shrink-0 !h-6 !px-2 !text-[11px]">
                            {typeLabel}
                          </span>
                          {p.permalink ? (
                            <a
                              href={p.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-foreground hover:text-accent-hi"
                            >
                              {title}
                            </a>
                          ) : (
                            <span className="block truncate text-foreground">{title}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right tabular-nums text-muted-2">
                        {formatNumber(p.views)}
                      </td>
                      <td className="text-right tabular-nums text-muted-2">
                        {formatNumber(p.reach)}
                      </td>
                      <td className="text-right tabular-nums text-muted-2">
                        {formatNumber(p.likes)}
                      </td>
                      <td className="text-right tabular-nums text-muted-2">
                        {formatNumber(p.comments)}
                      </td>
                      <td className="text-right tabular-nums text-muted-2">
                        {formatNumber(p.saved)}
                      </td>
                      <td className="text-right tabular-nums text-muted-2">
                        {formatNumber(p.shares)}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums text-muted">
                        {formatDate(p.timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
