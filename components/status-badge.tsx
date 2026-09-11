/**
 * Подпись статуса сообщения в Direct. Только текст; состояние передаёт цвет.
 * Подписи — из DM_STATUS_LABEL, ключи — enum DmStatus в Prisma.
 */

import { DM_STATUS_LABEL } from "@/lib/i18n/common";

const statusColor: Record<string, string> = {
  SENT: "text-success",
  FAILED: "text-error",
  PENDING: "text-warning",
  SKIPPED_DEDUP: "text-muted",
  SKIPPED_RATE_LIMIT: "text-warning",
  SKIPPED_PLAN_LIMIT: "text-warning",
  SKIPPED_NO_MATCH: "text-muted",
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const known = status in DM_STATUS_LABEL;
  const label = known ? DM_STATUS_LABEL[status] : DM_STATUS_LABEL.PENDING;
  const text = known ? statusColor[status] ?? "text-muted" : statusColor.PENDING;

  return (
    <span className={`shrink-0 whitespace-nowrap text-sm ${text}`}>
      {label}
    </span>
  );
}
