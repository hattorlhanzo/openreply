"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import { NAV, formatDateTimeRu } from "@/lib/i18n/common";
import {
  IconActivity,
  IconAlert,
  IconCheck,
  IconClock,
  IconLink,
  IconList,
  IconRefresh,
  IconSend,
  IconSkip,
} from "@/components/ui/icons";

interface DiagnosticsData {
  queueCounts: Record<string, number>;
  workerHealth: {
    healthy: boolean;
    ageMs: number | null;
    heartbeat: {
      checkedAt: string;
      hostname?: string;
      pid: number;
      startedAt?: string;
    } | null;
  };
  workerAlerts: Array<{
    level: string;
    message: string;
    jobId?: string;
    commentId?: string;
    createdAt: string;
  }>;
  webhookFailures: Array<{
    id: string;
    object: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
  dmFailures: Array<{
    id: string;
    status: string;
    commentId: string;
    commentText: string;
    errorMessage: string | null;
    updatedAt: string;
    automation: { name: string };
  }>;
  tokenRefreshFailures: Array<{
    id: string;
    message: string;
    createdAt: string;
  }>;
  operationalEvents: Array<{
    id: string;
    source: string;
    level: string;
    message: string;
    createdAt: string;
    resolvedAt: string | null;
  }>;
}

/** Подписи счётчиков очереди BullMQ; ключи — состояния очереди, их не переводим. */
const QUEUE_LABEL: Record<string, string> = {
  waiting: "Очередь: ожидают",
  active: "Очередь: в работе",
  delayed: "Очередь: отложены",
  failed: "Очередь: с ошибкой",
};

const QUEUE_TILE: Record<
  string,
  { icon: React.ReactNode; tone: "accent" | "success" | "warning" | "error" | "muted" }
> = {
  waiting: { icon: <IconClock size={16} />, tone: "muted" },
  active: { icon: <IconSend size={16} />, tone: "accent" },
  delayed: { icon: <IconSkip size={16} />, tone: "warning" },
  failed: { icon: <IconAlert size={16} />, tone: "error" },
};

function formatDate(value: string) {
  return formatDateTimeRu(value);
}

function levelBadge(level: string): string {
  const l = level.toLowerCase();
  if (l === "error" || l === "critical" || l === "fatal") return "badge-error";
  if (l === "warn" || l === "warning") return "badge-warning";
  if (l === "info") return "badge-accent";
  return "badge-muted";
}

function EmptyState({
  label,
  icon,
  tone = "success",
}: {
  label: string;
  icon?: React.ReactNode;
  tone?: "success" | "muted";
}) {
  return (
    <div className="empty !py-8">
      <span className={`empty-icon ${tone === "success" ? "icon-tile-success" : ""}`}>
        {icon ?? <IconCheck size={22} />}
      </span>
      <p className="empty-title">{label}</p>
    </div>
  );
}

function Section({
  title,
  icon,
  tone,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone?: "accent" | "success" | "warning" | "error" | "muted";
  count?: number;
  children: React.ReactNode;
}) {
  const toneClass = tone && tone !== "accent" ? `icon-tile-${tone}` : "";
  return (
    <section className="card">
      <div className="card-head">
        <div className="flex items-center gap-3">
          <span className={`icon-tile ${toneClass}`}>{icon}</span>
          <h2 className="card-title">{title}</h2>
        </div>
        {typeof count === "number" && count > 0 && (
          <span className={`badge badge-plain ${tone === "error" ? "badge-error" : "badge-muted"} tabular-nums`}>
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshDiagnostics() {
    setLoading(true);
    const response = await fetch("/api/admin/diagnostics");
    const payload = await response.json();
    if (payload.success) {
      setData(payload.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialDiagnostics() {
      const response = await fetch("/api/admin/diagnostics");
      const payload = await response.json();
      if (active && payload.success) {
        setData(payload.data);
      }
      if (active) {
        setLoading(false);
      }
    }

    void loadInitialDiagnostics();

    return () => {
      active = false;
    };
  }, []);

  if (loading && !data) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="page-title">{NAV.diagnostics}</h1>
            <p className="page-sub">Загрузка…</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-[108px] !rounded-[14px]" />
          ))}
        </div>
        <div className="skeleton mt-6 h-40 !rounded-[14px]" />
      </div>
    );
  }

  const workerAgeSeconds =
    data?.workerHealth.ageMs == null
      ? null
      : Math.round(data.workerHealth.ageMs / 1000);
  const healthy = Boolean(data?.workerHealth.healthy);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{NAV.diagnostics}</h1>
          <p className="page-sub">
            Состояние обработчика очереди, очереди, сбои вебхуков и токенов.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshDiagnostics()}
          disabled={loading}
          className="btn btn-secondary"
        >
          <IconRefresh size={16} className={loading ? "animate-spin" : undefined} />
          {loading ? "Обновляем…" : "Обновить"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Обработчик очереди"
          value={healthy ? "Работает" : "Внимание"}
          icon={<IconActivity size={16} />}
          tone={healthy ? "success" : "warning"}
          hint={
            workerAgeSeconds == null
              ? "Пульс не найден"
              : `Последний пульс ${workerAgeSeconds} с назад`
          }
        />
        {["waiting", "active", "delayed", "failed"].map((key) => (
          <StatCard
            key={key}
            label={QUEUE_LABEL[key] ?? key}
            value={data?.queueCounts[key] ?? 0}
            icon={QUEUE_TILE[key]?.icon}
            tone={QUEUE_TILE[key]?.tone ?? "muted"}
          />
        ))}
      </div>

      <div className="mt-6 space-y-6">
        <Section
          title="Последние сигналы обработчика"
          icon={<IconActivity size={18} />}
          tone={data?.workerAlerts.length ? "warning" : "muted"}
          count={data?.workerAlerts.length}
        >
          {data?.workerAlerts.length ? (
            <ul className="divide-y divide-border-subtle">
              {data.workerAlerts.map((alert) => (
                <li
                  key={`${alert.createdAt}-${alert.jobId ?? alert.message}`}
                  className="px-5 py-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 break-words text-[14px] font-medium text-foreground">
                      {alert.message}
                    </p>
                    <span className={`badge badge-plain ${levelBadge(alert.level)}`}>
                      {alert.level}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted tabular-nums">
                    {formatDate(alert.createdAt)}
                    {alert.commentId ? ` · ${alert.commentId}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState label="Сигналов обработчика нет." />
          )}
        </Section>

        <div className="grid gap-6 lg:grid-cols-3">
          <Section
            title="Ошибки и пропуски отправок"
            icon={<IconSend size={18} />}
            tone={data?.dmFailures.length ? "error" : "muted"}
            count={data?.dmFailures.length}
          >
            {data?.dmFailures.length ? (
              <ul className="divide-y divide-border-subtle">
                {data.dmFailures.map((item) => (
                  <li key={item.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
                        {item.automation.name}
                      </p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 truncate text-[12px] text-muted">{item.commentText}</p>
                    {item.errorMessage && (
                      <p className="mt-1 break-words text-[12px] text-error">
                        {item.errorMessage}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState label="Ошибок и пропусков отправок нет." />
            )}
          </Section>

          <Section
            title="Сбои вебхуков"
            icon={<IconLink size={18} />}
            tone={data?.webhookFailures.length ? "error" : "muted"}
            count={data?.webhookFailures.length}
          >
            {data?.webhookFailures.length ? (
              <ul className="divide-y divide-border-subtle">
                {data.webhookFailures.map((event) => (
                  <li key={event.id} className="px-5 py-3.5">
                    <p className="text-[14px] font-medium text-foreground">
                      {event.object ?? "Вебхук Instagram"}
                    </p>
                    <p className="mt-1 break-words text-[12px] text-error">
                      {event.errorMessage ?? "Неизвестная ошибка"}
                    </p>
                    <p className="mt-1 text-[12px] text-muted tabular-nums">
                      {formatDate(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState label="Сбоев вебхуков нет." />
            )}
          </Section>

          <Section
            title="Сбои обновления токенов"
            icon={<IconRefresh size={18} />}
            tone={data?.tokenRefreshFailures.length ? "error" : "muted"}
            count={data?.tokenRefreshFailures.length}
          >
            {data?.tokenRefreshFailures.length ? (
              <ul className="divide-y divide-border-subtle">
                {data.tokenRefreshFailures.map((event) => (
                  <li key={event.id} className="px-5 py-3.5">
                    <p className="break-words text-[14px] font-medium text-foreground">
                      {event.message}
                    </p>
                    <p className="mt-1 text-[12px] text-muted tabular-nums">
                      {formatDate(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState label="Сбоев обновления токенов нет." />
            )}
          </Section>
        </div>

        <Section
          title="Журнал событий"
          icon={<IconList size={18} />}
          tone="muted"
          count={data?.operationalEvents.length}
        >
          {data?.operationalEvents.length ? (
            <ul className="divide-y divide-border-subtle">
              {data.operationalEvents.map((event) => (
                <li
                  key={event.id}
                  className="grid gap-1 px-5 py-3 sm:grid-cols-[150px_1fr_auto] sm:items-center sm:gap-4"
                >
                  <div className="flex items-center gap-2">
                    <span className={`badge badge-plain ${levelBadge(event.level)} !h-5 !px-2 !text-[10px] uppercase`}>
                      {event.level}
                    </span>
                    <span className="truncate text-[12px] font-semibold text-muted-2">
                      {event.source}
                    </span>
                  </div>
                  <p className="break-words text-[14px] text-foreground">{event.message}</p>
                  <p className="text-[12px] text-muted tabular-nums sm:text-right">
                    {formatDate(event.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState label="Событий пока нет." icon={<IconList size={22} />} tone="muted" />
          )}
        </Section>
      </div>
    </div>
  );
}
