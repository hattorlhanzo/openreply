"use client";

/**
 * Сводка
 *
 * Плитки показателей, график за 7 дней и лента последних событий.
 */

import { useEffect, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import { pluralRu } from "@/lib/i18n/common";
import {
  IconAlert,
  IconChevronRight,
  IconInbox,
  IconLink,
  IconPercent,
  IconSend,
  IconSkip,
  IconTarget,
  IconZap,
} from "@/components/ui/icons";

interface DashboardStats {
  userName: string | null;
  contactsCount: number;
  totalAutomations: number;
  activeAutomations: number;
  dmsSentToday: number;
  dmsSentWeek: number;
  dmsSentMonth: number;
  dmsSkippedMonth: number;
  dmsFailedMonth: number;
  totalDMs: number;
  clicksThisMonth: number;
  totalClicks: number;
  ctrThisMonth: number;
  instagramAccounts: AccountOption[];
  selectedInstagramAccountId: string | null;
  topKeywords: { keyword: string; count: number }[];
  dailyDMs: { date: string; count: number }[];
  recentLogs: Array<{
    id: string;
    commenterName: string | null;
    commentText: string;
    status: string;
    createdAt: string;
    automation: { name: string };
    instagramAccount?: { username: string };
  }>;
}

/** Высота области столбиков, px — фиксированная, чтобы проценты работали. */
const CHART_HEIGHT = 132;

function weekdayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { weekday: "short" });
}

function dayTitle(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") {
      params.set("instagramAccountId", selectedAccountId);
    }

    fetch(`/api/dashboard/stats${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStats(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="skeleton h-7 w-64" />
          <div className="skeleton mt-2 h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-8 w-8 !rounded-[9px]" />
              </div>
              <div className="skeleton mt-3 h-7 w-14" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-6">
          <div className="card h-64 lg:col-span-3" />
          <div className="card h-64 lg:col-span-1" />
          <div className="card h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  const daily = stats?.dailyDMs ?? [];
  const maxDM = Math.max(...daily.map((d) => d.count), 1);
  const weekTotal = daily.reduce((sum, d) => sum + d.count, 0);
  const maxKeyword = Math.max(...(stats?.topKeywords.map((k) => k.count) ?? [1]), 1);

  const connectedCount = stats?.instagramAccounts.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Приветствие */}
      <div className="page-head flex-col sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="page-title">
            {stats?.userName ? `Здравствуйте, ${stats.userName}!` : "Здравствуйте!"}
          </h1>
          <p className="page-sub">
            {connectedCount}{" "}
            {pluralRu(connectedCount, [
              "подключённый аккаунт",
              "подключённых аккаунта",
              "подключённых аккаунтов",
            ])}
            {" · "}
            {stats?.contactsCount ?? 0}{" "}
            {pluralRu(stats?.contactsCount ?? 0, ["контакт", "контакта", "контактов"])}
            {" · "}
            <a href="/logs" className="text-accent-hi hover:underline">
              Журнал отправок
            </a>
          </p>
        </div>
        {stats && stats.instagramAccounts.length > 1 && (
          <AccountSelect
            accounts={stats.instagramAccounts}
            value={selectedAccountId}
            onChange={handleAccountChange}
          />
        )}
      </div>

      {/* Плитки показателей */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Активные кампании"
          value={stats?.activeAutomations ?? 0}
          icon={<IconZap size={16} />}
          tone="accent"
          hint={`всего ${stats?.totalAutomations ?? 0}`}
        />
        <StatCard
          label="Отправлено в Direct"
          value={stats?.dmsSentMonth ?? 0}
          icon={<IconSend size={16} />}
          tone="success"
          hint={`сегодня ${stats?.dmsSentToday ?? 0}`}
        />
        <StatCard
          label="Пропущено"
          value={stats?.dmsSkippedMonth ?? 0}
          icon={<IconSkip size={16} />}
          tone="muted"
          hint="за месяц"
        />
        <StatCard
          label="Ошибки"
          value={stats?.dmsFailedMonth ?? 0}
          icon={<IconAlert size={16} />}
          tone="error"
          hint="за месяц"
        />
        <StatCard
          label="Переходы"
          value={stats?.clicksThisMonth ?? 0}
          icon={<IconLink size={16} />}
          tone="accent"
          hint={`всего ${stats?.totalClicks ?? 0}`}
        />
        <StatCard
          label="CTR"
          value={`${stats?.ctrThisMonth ?? 0}%`}
          icon={<IconPercent size={16} />}
          tone="accent"
          hint="переходы / отправки"
        />
      </div>

      {/* График + ключевые слова + события */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-6">
        {/* График за 7 дней */}
        <div className="card lg:col-span-3">
          <div className="card-head">
            <div className="min-w-0">
              <h2 className="card-title">Сообщения в Direct — 7 дней</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                {weekTotal}{" "}
                {pluralRu(weekTotal, ["отправка", "отправки", "отправок"])} за неделю
              </p>
            </div>
            <span className="icon-tile icon-tile-success !h-8 !w-8 !rounded-[9px]">
              <IconSend size={16} />
            </span>
          </div>
          <div className="card-body">
            <div
              className="flex items-end gap-2 sm:gap-3"
              style={{ height: CHART_HEIGHT + 20 }}
            >
              {daily.map((day) => {
                const h = Math.max(Math.round((day.count / maxDM) * CHART_HEIGHT), 4);
                return (
                  <div
                    key={day.date}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${dayTitle(day.date)}: ${day.count}`}
                  >
                    <span className="text-[12px] font-semibold tabular-nums text-foreground">
                      {day.count}
                    </span>
                    <div
                      className={`w-full max-w-[44px] rounded-t-[6px] ${
                        day.count > 0 ? "bg-accent" : "bg-surface-hover"
                      }`}
                      style={{ height: h }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2 border-t border-border-subtle pt-2 sm:gap-3">
              {daily.map((day) => (
                <span
                  key={day.date}
                  className="w-full min-w-0 flex-1 truncate text-center text-[11px] capitalize text-muted"
                >
                  {weekdayLabel(day.date)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Ключевые слова */}
        <div className="card lg:col-span-1">
          <div className="card-head">
            <h2 className="card-title whitespace-nowrap">Ключевые слова</h2>
          </div>
          <div className="card-body">
            {stats?.topKeywords.length === 0 ? (
              <div className="empty !px-0 !py-6">
                <span className="empty-icon">
                  <IconTarget size={20} />
                </span>
                <p className="empty-title">Совпадений нет</p>
                <p className="text-[12px]">Совпадений по ключевым словам пока нет</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {stats?.topKeywords.map((keyword) => (
                  <li key={keyword.keyword} className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="chip min-w-0 max-w-full">
                        <span className="truncate">{keyword.keyword}</span>
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums text-foreground">
                        {keyword.count}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-surface-2">
                      <div
                        className="h-1 rounded-full bg-accent"
                        style={{ width: `${Math.max((keyword.count / maxKeyword) * 100, 6)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Последние события */}
        <div className="card lg:col-span-2">
          <div className="card-head">
            <h2 className="card-title">Последние события</h2>
            <a
              href="/logs"
              className="inline-flex items-center gap-0.5 text-[13px] font-medium text-accent-hi hover:underline"
            >
              Все записи
              <IconChevronRight size={14} />
            </a>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {stats?.recentLogs.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">
                  <IconInbox size={20} />
                </span>
                <p className="empty-title">Событий пока нет</p>
                <p className="text-[12px]">
                  Здесь появятся комментарии, на которые ответили кампании
                </p>
              </div>
            ) : (
              <ul>
                {stats?.recentLogs.map((log) => {
                  const nick = log.commenterName ?? "неизвестно";
                  return (
                    <li
                      key={log.id}
                      className="flex items-center gap-3 border-b border-border-subtle px-5 py-3 last:border-0"
                    >
                      <span className="avatar">{nick.charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          @{nick}
                        </p>
                        <p className="truncate text-[12px] text-muted">
                          {log.instagramAccount
                            ? `@${log.instagramAccount.username} · `
                            : ""}
                          {log.commentText}
                        </p>
                      </div>
                      <StatusBadge status={log.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
