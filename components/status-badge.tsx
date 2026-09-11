/**
 * Бейдж статуса отправки. Ключи — enum DmStatus, подписи — из словаря.
 */

import { DM_STATUS_LABEL } from "@/lib/i18n/common";

const toneByStatus: Record<string, string> = {
  SENT: "badge-success",
  FAILED: "badge-error",
  PENDING: "badge-warning",
  SKIPPED_DEDUP: "badge-muted",
  SKIPPED_RATE_LIMIT: "badge-warning",
  SKIPPED_PLAN_LIMIT: "badge-warning",
  SKIPPED_NO_MATCH: "badge-muted",
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const tone = toneByStatus[status] ?? "badge-muted";
  const label = DM_STATUS_LABEL[status] ?? status;
  return <span className={`badge ${tone}`}>{label}</span>;
}
