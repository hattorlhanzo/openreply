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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="panel rounded p-4 h-24 sm:p-5">
            <div className="h-4 w-16 bg-zinc-200 rounded" />
            <div className="mt-3 h-6 w-20 bg-zinc-200/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel rounded p-8 text-center">
        <p className="text-sm text-error">{error}</p>
        {(error.includes("connect") || error.includes("подключ")) && (
          <a
            href="/api/instagram/connect"
            className="mt-4 inline-block text-sm text-accent hover:underline"
          >
            Подключить Instagram
          </a>
        )}
      </div>
    );
  }

  if (!data) return null;

  const { totals, posts, accounts, insightsAvailable, followers, followerHistory } =
    data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Аккаунт</h1>
          <p className="text-sm text-muted mt-1">
            {data.requestedCount === "all" ? "За всё время" : "Недавние"} —{" "}
            {totals.posts}{" "}
            {pluralRu(totals.posts, ["публикация", "публикации", "публикаций"])} @
            {data.account.username}
            {data.truncated ? ` (не больше ${totals.posts})` : ""}
          </p>
          {followers !== null && (
            // Kept out of the tile row below: that row sums the selected posts,
            // whereas this is a current account-level total.
            <p className="mt-1 text-sm text-muted">
              {formatNumberRu(followers)}{" "}
              {pluralRu(followers, ["подписчик", "подписчика", "подписчиков"])}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Период
            </span>
            <select
              value={count}
              onChange={(e) => handleCountChange(e.target.value)}
              className="border-0 bg-transparent py-2 pr-1 text-sm text-foreground outline-none"
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
            />
          )}
        </div>
      </div>

      {!insightsAvailable && (
        <div className="panel rounded p-4 border border-border">
          <p className="text-sm text-foreground">
            Для просмотров, охвата, сохранений и репостов нужно разрешение на
            статистику.
          </p>
          <p className="text-sm text-muted mt-1">
            Переподключите аккаунт, чтобы выдать его, — пока показываем лайки и
            комментарии.
          </p>
          <a
            href="/api/instagram/connect"
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            Переподключить Instagram
          </a>
        </div>
      )}

      {/* Aggregate totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard label="Просмотры" value={formatNumber(totals.views)} />
        <StatCard label="Охват" value={formatNumber(totals.reach)} />
        <StatCard label="Лайки" value={formatNumber(totals.likes)} />
        <StatCard label="Комментарии" value={formatNumber(totals.comments)} />
        <StatCard label="Сохранения" value={formatNumber(totals.saved)} />
        <StatCard label="Репосты" value={formatNumber(totals.shares)} />
      </div>

      {/* Follower trend — account-level, independent of the post range */}
      <FollowerChart data={followerHistory} followers={followers} />

      {/* Per-post table */}
      <div className="panel rounded p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Публикации</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">Публикаций не найдено</p>
        ) : (
          // Eight metric columns can't compress into a phone; let the table keep
          // its natural width and scroll inside the panel instead.
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-border">
                  <th className="py-2 pr-4 font-medium">Публикация</th>
                  <th className="py-2 px-3 font-medium text-right">Просмотры</th>
                  <th className="py-2 px-3 font-medium text-right">Охват</th>
                  <th className="py-2 px-3 font-medium text-right">Лайки</th>
                  <th className="py-2 px-3 font-medium text-right">Комментарии</th>
                  <th className="py-2 px-3 font-medium text-right">Сохранения</th>
                  <th className="py-2 px-3 font-medium text-right">Репосты</th>
                  <th className="py-2 pl-3 font-medium text-right">Дата</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 pr-4 max-w-xs">
                      {p.permalink ? (
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-accent truncate block"
                        >
                          {p.caption || (MEDIA_TYPE_LABEL[p.mediaType] ?? "Публикация")}
                        </a>
                      ) : (
                        <span className="text-foreground truncate block">
                          {p.caption || (MEDIA_TYPE_LABEL[p.mediaType] ?? "Публикация")}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.views)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.reach)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.likes)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.comments)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.saved)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.shares)}
                    </td>
                    <td className="py-3 pl-3 text-right text-zinc-500">
                      {formatDate(p.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
