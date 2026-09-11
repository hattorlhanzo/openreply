"use client";

/**
 * Followers Over Time
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

// Colors read against the light chart surface (#ffffff): the accent line clears
// 3:1 contrast and grid/axis text match the muted/border tokens. See globals.css.
const SERIES_COLOR = "#f97316";
const GRID_COLOR = "#e4e4e7";
const AXIS_TEXT = "#71717a";

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
    <div className="rounded border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-muted">{formatDay(point.date)}</p>
      <p className="mt-1 font-semibold text-foreground">
        {formatNumberRu(point.followers)}{" "}
        {pluralRu(point.followers, ["подписчик", "подписчика", "подписчиков"])}
      </p>
      {point.delta !== null && point.delta !== 0 && (
        <p className={point.delta > 0 ? "text-success" : "text-error"}>
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
    <div className="panel rounded p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Динамика подписчиков
          </h2>
          <p className="mt-1 text-sm text-muted">
            {current === null
              ? "Число подписчиков недоступно"
              : `Сейчас ${formatNumberRu(current)}`}
            {net !== null && (
              <>
                {" · "}
                <span className={net >= 0 ? "text-success" : "text-error"}>
                  {formatSigned(net)}
                </span>{" "}
                за {data.length}{" "}
                {pluralRu(data.length, ["день", "дня", "дней"])}
              </>
            )}
          </p>
        </div>
        {data.length > 1 && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="rounded border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-hover hover:text-foreground"
          >
            {showTable ? "Показать график" : "Показать таблицу"}
          </button>
        )}
      </div>

      {data.length < 2 ? (
        <div className="mt-6 rounded border border-border bg-surface/60 p-6 text-center">
          <p className="text-sm text-foreground">Собираем историю подписчиков</p>
          <p className="mt-1 text-sm text-muted">
            {data.length === 0
              ? "Снимков пока нет."
              : "Пока записан один день."}{" "}
            Точка добавляется раз в сутки — график появится, когда их будет
            хотя бы две.
          </p>
        </div>
      ) : showTable ? (
        <div className="mt-4 max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4 font-medium">Дата</th>
                <th className="py-2 px-3 font-medium text-right">Подписчики</th>
                <th className="py-2 pl-3 font-medium text-right">Изменение</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((p) => (
                <tr key={p.date} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 text-foreground">
                    {formatDay(p.date)}
                  </td>
                  <td className="py-2 px-3 text-right text-muted">
                    {formatNumberRu(p.followers)}
                  </td>
                  <td className="py-2 pl-3 text-right text-muted">
                    {p.delta === null ? "—" : formatSigned(p.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke={GRID_COLOR}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDay}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                stroke={GRID_COLOR}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={formatCompact}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                stroke={GRID_COLOR}
                tickLine={false}
                width={52}
                // Followers rarely start near zero, so a zero baseline would
                // flatten the line into a straight edge.
                domain={["dataMin - 5", "dataMax + 5"]}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="followers"
                stroke={SERIES_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: SERIES_COLOR, stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
