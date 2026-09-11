/**
 * Плитка показателя: иконка в цветной плашке, значение, подпись, тренд.
 */

import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: "accent" | "success" | "warning" | "error" | "muted";
  trend?: string;
  trendUp?: boolean;
  hint?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  tone = "accent",
  trend,
  trendUp,
  hint,
}: StatCardProps) {
  const toneClass = tone === "accent" ? "" : `icon-tile-${tone}`;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-2 leading-snug min-h-[2.5em]">{label}</p>
        {icon && <span className={`icon-tile !h-8 !w-8 !rounded-[9px] ${toneClass}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-[26px] font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {(trend || hint) && (
        <p className="mt-1 text-[12px] text-muted">
          {trend && (
            <span className={trendUp ? "text-success" : "text-error"}>
              {trendUp ? "▲" : "▼"} {trend}
            </span>
          )}
          {trend && hint && " · "}
          {hint}
        </p>
      )}
    </div>
  );
}
