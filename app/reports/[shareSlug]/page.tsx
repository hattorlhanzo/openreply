import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaignReportBySlug } from "@/lib/reports/data";
import { BRAND, PRODUCT, formatDateRu } from "@/lib/i18n/common";
import StatCard from "@/components/stat-card";
import {
  IconAlert,
  IconInstagram,
  IconLink,
  IconPercent,
  IconSend,
  IconSkip,
  IconSliders,
  IconTarget,
  IconTrendUp,
} from "@/components/ui/icons";

type ReportPageProps = {
  params: Promise<{ shareSlug: string }>;
};

function formatDate(date: Date | null) {
  if (!date) return "Отправок ещё не было";
  return formatDateRu(date);
}

function CardHead({
  icon,
  tone,
  title,
  aside,
}: {
  icon: React.ReactNode;
  tone?: "success" | "warning" | "error" | "muted";
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="card-head">
      <div className="flex items-center gap-3">
        <span className={`icon-tile !h-8 !w-8 !rounded-[9px] ${tone ? `icon-tile-${tone}` : ""}`}>
          {icon}
        </span>
        <span className="card-title">{title}</span>
      </div>
      {aside}
    </div>
  );
}

export async function generateMetadata({
  params,
}: ReportPageProps): Promise<Metadata> {
  const { shareSlug } = await params;
  const report = await getCampaignReportBySlug(shareSlug);

  if (!report) {
    return {
      title: "Отчёт не найден",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `Отчёт по кампании «${report.campaign.name}»`,
    description: `Отчёт по Instagram-кампании «${report.campaign.name}»: комментарии → сообщения в Direct. Только для чтения.`,
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { shareSlug } = await params;
  const report = await getCampaignReportBySlug(shareSlug);

  if (!report) {
    notFound();
  }

  const maxDaily = Math.max(
    ...report.daily.map((day) => Math.max(day.sent, day.clicks)),
    1
  );
  const keywordTotal =
    report.topKeywords.reduce((sum, k) => sum + k.count, 0) || 1;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-cube.png" alt="" className="h-8 w-8" />
              <span className="leading-tight">
                <span className="block text-[15px] font-bold tracking-wide text-foreground">
                  {BRAND}
                </span>
                <span className="block text-[11px] text-muted">{PRODUCT}</span>
              </span>
            </span>
            <span className="badge badge-muted badge-plain">Отчёт · только чтение</span>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 lg:px-8">
        <div className="page-head flex-col md:flex-row">
          <div className="min-w-0">
            <p className="section-label">Отчёт по кампании</p>
            <h1 className="page-title mt-1.5 !text-[28px]">{report.campaign.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`badge ${report.campaign.isActive ? "badge-success" : "badge-muted"}`}
              >
                {report.campaign.isActive ? "Кампания активна" : "Кампания на паузе"}
              </span>
              <span className="chip chip-outline">
                <IconInstagram size={12} />@{report.campaign.instagramUsername}
              </span>
              {report.campaign.goal && (
                <span className="chip chip-outline">{report.campaign.goal}</span>
              )}
            </div>
          </div>

          <div className="card w-full p-4 md:w-72">
            <p className="section-label">Рабочее пространство</p>
            <p className="mt-2 text-[15px] font-semibold text-foreground">
              {report.workspace.name}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Сформирован {formatDate(report.generatedAt)}
            </p>
            {report.branded && (
              <Link href="/" className="btn btn-secondary btn-sm mt-4 w-full">
                Работает на {BRAND}
              </Link>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Отправлено"
            value={report.metrics.sent}
            icon={<IconSend size={16} />}
            tone="accent"
            hint="доставлено в Direct"
          />
          <StatCard
            label="Пропущено"
            value={report.metrics.skipped}
            icon={<IconSkip size={16} />}
            tone="muted"
            hint="повторы, лимиты"
          />
          <StatCard
            label="Ошибки"
            value={report.metrics.failed}
            icon={<IconAlert size={16} />}
            tone={report.metrics.failed > 0 ? "error" : "muted"}
            hint="стоит проверить"
          />
          <StatCard
            label="Переходы"
            value={report.metrics.clicks}
            icon={<IconLink size={16} />}
            tone="success"
            hint="по отслеживаемой ссылке"
          />
          <StatCard
            label="CTR"
            value={`${report.metrics.ctr}%`}
            icon={<IconPercent size={16} />}
            tone="warning"
            hint="переходы ÷ отправлено"
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          {/* Daily chart */}
          <div className="card">
            <CardHead
              icon={<IconTrendUp size={16} />}
              title="Последние 7 дней"
              aside={
                <span className="text-[12px] text-muted">
                  Последняя отправка: {formatDate(report.metrics.latestSentAt)}
                </span>
              }
            />
            <div className="card-body">
              <p className="text-[13px] text-muted">
                Отправленные сообщения и переходы по ссылке по дням.
              </p>
              <div className="mt-6 grid h-52 grid-cols-7 items-end gap-2 sm:gap-3">
                {report.daily.map((day) => (
                  <div key={day.date} className="flex h-full flex-col justify-end gap-2">
                    <div className="flex min-h-0 flex-1 items-end gap-1">
                      <div
                        className="w-full rounded-t-[4px] bg-accent"
                        style={{
                          height: `${Math.max((day.sent / maxDaily) * 100, 3)}%`,
                        }}
                        title={`Отправлено: ${day.sent}`}
                      />
                      <div
                        className="w-full rounded-t-[4px] bg-success"
                        style={{
                          height: `${Math.max((day.clicks / maxDaily) * 100, 3)}%`,
                        }}
                        title={`Переходы: ${day.clicks}`}
                      />
                    </div>
                    <p className="truncate text-center text-[11px] tabular-nums text-muted">
                      {day.date}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-muted">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
                  Отправленные сообщения
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-success" />
                  Переходы по ссылке
                </span>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="card">
              <CardHead icon={<IconTarget size={16} />} title="Популярные ключевые слова" />
              {report.topKeywords.length === 0 ? (
                <div className="empty !py-8">
                  <p className="text-[13px]">Совпадений по ключевым словам пока нет.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Слово</th>
                        <th className="!text-right">Раз</th>
                        <th className="w-1/3">Доля</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topKeywords.map((keyword) => {
                        const pct = Math.round((keyword.count / keywordTotal) * 100);
                        return (
                          <tr key={keyword.keyword}>
                            <td>
                              <span className="chip">{keyword.keyword}</span>
                            </td>
                            <td className="text-right font-semibold tabular-nums">
                              {keyword.count}
                            </td>
                            <td>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                                <div
                                  className="h-full rounded-full bg-accent"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <CardHead
                icon={<IconLink size={16} />}
                tone="success"
                title="Отслеживаемые ссылки"
              />
              {report.trackedLinks.length === 0 ? (
                <div className="empty !py-8">
                  <p className="text-[13px]">В этой кампании нет отслеживаемой ссылки.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Сайт</th>
                        <th className="!text-right">Переходы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.trackedLinks.map((link) => (
                        <tr key={link.slug}>
                          <td className="max-w-[240px] truncate text-muted-2">
                            {link.destinationHost}
                          </td>
                          <td className="text-right font-semibold tabular-nums">
                            {link.clicks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Settings */}
        <div className="card mt-5">
          <CardHead icon={<IconSliders size={16} />} tone="muted" title="Настройки кампании" />
          <div className="card-body grid gap-6 md:grid-cols-3">
            <div>
              <p className="section-label">Ключевые слова</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {report.campaign.keywords.length === 0 && (
                  <span className="text-[13px] text-muted">Любой комментарий</span>
                )}
                {report.campaign.keywords.map((keyword) => (
                  <span key={keyword} className="chip">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="section-label">Создана</p>
              <p className="mt-3 text-[14px] text-foreground">
                {formatDate(report.campaign.createdAt)}
              </p>
            </div>
            <div>
              <p className="section-label">Публикация-источник</p>
              {report.campaign.postUrl ? (
                <a
                  href={report.campaign.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm mt-3"
                >
                  <IconInstagram size={14} />
                  Открыть в Instagram
                </a>
              ) : (
                <p className="mt-3 text-[14px] text-muted">Не привязана</p>
              )}
            </div>
          </div>
        </div>

        {report.branded && (
          <footer className="mt-8 border-t border-border-subtle pt-6 text-center text-[12px] text-muted">
            Сделано в {BRAND} — автоматизация ответов на комментарии в Instagram Direct.
          </footer>
        )}
      </section>
    </main>
  );
}
