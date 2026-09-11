"use client";

/**
 * Динамика подписчиков
 *
 * Single-series line chart over stored daily snapshots. Deliberately separate
 * from the Overview stat tiles: those sum the selected posts, while this is an
 * account-level total that ignores the post range.
 *
 * History depth is limited by what has been snapshotted — Instagram only serves
 * ~30 days of account insights, so earlier days exist only if this instance was
 * already running then.
 */

import { useState } from "react";
import {
  formatCompactRu,
  formatDayRu,
  formatNumberRu,
  formatSignedRu,
  pluralRu,
} from "@/lib/i18n/common";
import { IconClock, IconTrendUp } from "@/components/ui/icons";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface FollowerChartPoint {
  date: string;
  followers: number;
  delta: number | null;
}

// Цвета берутся из токенов темы (globals.css), чтобы график одинаково читался
// в тёмной и светлой схеме. SVG принимает var() в атрибутах stroke/fill.
const SERIES_COLOR = "var(--accent-hi)";
const GRID_COLOR = "var(--border-subtle)";
const AXIS_TEXT = "var(--text-3)";
const DOT_RING = "var(--bg-1)";

const formatCompact = formatCompactRu;
const formatSigned = formatSignedRu;

function formatDay(iso: string): string {
  return formatDayRu(`${iso}T00:00:00Z`, "UTC");
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FollowerChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div
      className="rounded-[10px] border border-border bg-surface px-3 py-2 text-xs"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <p className="text-muted">{formatDay(point.date)}</p>
      <p className="mt-1 font-semibold tabular-nums text-foreground">
        {formatNumberRu(point.followers)}{" "}
        {pluralRu(point.followers, ["подписчик", "подписчика", "подписчиков"])}
      </p>
      {point.delta !== null && point.delta !== 0 && (
        <p className={`tabular-nums ${point.delta > 0 ? "text-success" : "text-error"}`}>
          {formatSigned(point.delta)} за день
        </p>
      )}
    </div>
  );
}

export default function FollowerChart({
  data,
  followers,
}: {
  data: FollowerChartPoint[];
  followers: number | null;
}) {
  const [showTable, setShowTable] = useState(false);

  const current = followers ?? data.at(-1)?.followers ?? null;

  // Net change across the whole visible window, shown once in the header rather
  // than labelling every point.
  const net =
    data.length > 1 ? data[data.length - 1].followers - data[0].followers : null;

  return (
    <div className="card">
      <div className="card-head">
        <div className="flex min-w-0 items-center gap-3">
          <span className="icon-tile !h-8 !w-8 !rounded-[9px]">
            <IconTrendUp size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="card-title">Динамика подписчиков</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {current === null ? (
                "Число подписчиков недоступно"
              ) : (
                <>
                  Сейчас{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatNumberRu(current)}
                  </span>
                </>
              )}
              {net !== null && (
                <>
                  {" · "}
                  <span
                    className={`font-semibold tabular-nums ${net >= 0 ? "text-success" : "text-error"}`}
                  >
                    {formatSigned(net)}
                  </span>{" "}
                  за {data.length}{" "}
                  {pluralRu(data.length, ["день", "дня", "дней"])}
                </>
              )}
            </p>
          </div>
        </div>
        {data.length > 1 && (
          <div className="seg">
            <button
              type="button"
              className="seg-item"
              aria-pressed={!showTable}
              onClick={() => setShowTable(false)}
            >
              График
            </button>
            <button
              type="button"
              className="seg-item"
              aria-pressed={showTable}
              onClick={() => setShowTable(true)}
            >
              Таблица
            </button>
          </div>
        )}
      </div>

      {data.length < 2 ? (
        <div className="empty">
          <span className="empty-icon">
            <IconClock size={20} />
          </span>
          <p className="empty-title">Собираем историю подписчиков</p>
          <p className="max-w-sm text-[13px]">
            {data.length === 0
              ? "Снимков пока нет."
              : "Пока записан один день."}{" "}
            Точка добавляется раз в сутки — график появится, когда их будет
            хотя бы две.
          </p>
        </div>
      ) : showTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Дата</th>
                <th className="!text-right">Подписчики</th>
                <th className="!text-right">Изменение</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((p) => (
                <tr key={p.date}>
                  <td className="text-foreground">{formatDay(p.date)}</td>
                  <td className="text-right tabular-nums text-foreground">
                    {formatNumberRu(p.followers)}
                  </td>
                  <td
                    className={`text-right tabular-nums ${
                      p.delta === null || p.delta === 0
                        ? "text-muted"
                        : p.delta > 0
                          ? "text-success"
                          : "text-error"
                    }`}
                  >
                    {p.delta === null ? "—" : formatSigned(p.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-body">
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke={GRID_COLOR}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                  stroke={GRID_COLOR}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                  minTickGap={28}
                  dy={6}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tick={{ fill: AXIS_TEXT, fontSize: 11 }}
                  stroke={GRID_COLOR}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  // Followers rarely start near zero, so a zero baseline would
                  // flatten the line into a straight edge.
                  domain={["dataMin - 5", "dataMax + 5"]}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="followers"
                  stroke={SERIES_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: SERIES_COLOR, stroke: DOT_RING, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
