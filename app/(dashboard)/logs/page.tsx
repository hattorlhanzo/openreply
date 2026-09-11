"use client";

/**
 * Журнал отправок
 *
 * Таблица DM-логов с фильтрами и постраничной навигацией.
 */

import { useEffect, useState, useCallback } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatusBadge from "@/components/status-badge";
import { DM_STATUS_LABEL, NAV, pluralRu } from "@/lib/i18n/common";
import { IconChevronLeft, IconChevronRight, IconList } from "@/components/ui/icons";

interface DmLog {
  id: string;
  commenterId: string;
  commenterName: string | null;
  commentText: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  automation: { name: string; keywords: string[] };
  instagramAccount: { username: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS = [
  "ALL",
  "SENT",
  "FAILED",
  "PENDING",
  "SKIPPED_RATE_LIMIT",
  "SKIPPED_PLAN_LIMIT",
  "SKIPPED_DEDUP",
];

const COLUMNS = ["Комментатор", "Комментарий", "Кампания", "Аккаунт", "Статус", "Время"];

function initialOf(name: string): string {
  const ch = name.replace(/^@/, "").trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

export default function LogsPage() {
  const [logs, setLogs] = useState<DmLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (selectedAccountId !== "all") {
        params.set("instagramAccountId", selectedAccountId);
      }

      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
        setPagination(data.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, selectedAccountId]);

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
      void fetchLogs();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchLogs]);

  function handleFilterChange(status: string) {
    setLoading(true);
    setStatusFilter(status);
    setPage(1);
  }

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
    setPage(1);
  }

  const total = pagination?.total ?? 0;
  const subtitle = loading
    ? "Загрузка…"
    : total === 0
      ? "Записей пока нет"
      : `${total} ${pluralRu(total, ["запись", "записи", "записей"])}${
          statusFilter !== "ALL" ? ` · ${DM_STATUS_LABEL[statusFilter] ?? statusFilter}` : ""
        }`;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{NAV.logs}</h1>
          <p className="page-sub tabular-nums">{subtitle}</p>
        </div>
        {accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={handleAccountChange}
          />
        )}
      </div>

      {/* Фильтр статусов: на узком экране прокручивается по горизонтали */}
      <div className="mb-4 overflow-x-auto">
        <div className="seg" role="group" aria-label="Фильтр по статусу">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleFilterChange(status)}
              aria-pressed={statusFilter === status}
              className="seg-item"
            >
              {status === "ALL" ? "Все" : DM_STATUS_LABEL[status] ?? status}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {/* Шесть колонок не влезают в телефон: таблица сохраняет ширину и
            прокручивается внутри карточки, а не сжимает ячейки. */}
        <div className="overflow-x-auto">
          <table className="tbl min-w-[820px]">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading &&
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="skeleton h-8 w-8 !rounded-full" />
                        <span className="skeleton h-3.5 w-24" />
                      </div>
                    </td>
                    <td><span className="skeleton block h-3.5 w-40" /></td>
                    <td><span className="skeleton block h-3.5 w-32" /></td>
                    <td><span className="skeleton block h-3.5 w-28" /></td>
                    <td><span className="skeleton block h-6 w-24 !rounded-full" /></td>
                    <td><span className="skeleton block h-3.5 w-24" /></td>
                  </tr>
                ))}

              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="!p-0">
                    <div className="empty">
                      <span className="empty-icon">
                        <IconList size={22} />
                      </span>
                      <p className="empty-title">Записей нет</p>
                      <p className="text-[13px]">
                        {statusFilter === "ALL"
                          ? "Как только кампания ответит на комментарий, запись появится здесь."
                          : "По выбранному статусу отправок не было."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                logs.map((log) => {
                  const name = log.commenterName ?? log.commenterId.slice(0, 8);
                  return (
                    <tr key={log.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="avatar">{initialOf(name)}</span>
                          <span className="truncate font-medium text-foreground">@{name}</span>
                        </div>
                      </td>
                      <td className="max-w-[260px]">
                        <span className="block truncate text-muted-2" title={log.commentText}>
                          {log.commentText}
                        </span>
                      </td>
                      <td className="max-w-[220px]">
                        <span className="block truncate text-muted-2">{log.automation.name}</span>
                      </td>
                      <td>
                        <span className="text-muted">@{log.instagramAccount.username}</span>
                      </td>
                      <td>
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="whitespace-nowrap text-[13px] text-muted tabular-nums">
                        {new Date(log.createdAt).toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:px-5">
            <p className="text-[13px] text-muted tabular-nums">
              Показано {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} из{" "}
              {pagination.total}
            </p>
            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setLoading(true);
                    setPage(page - 1);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  <IconChevronLeft size={16} />
                  Назад
                </button>
                <span className="px-1 text-[13px] text-muted tabular-nums">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => {
                    setLoading(true);
                    setPage(page + 1);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Вперёд
                  <IconChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
