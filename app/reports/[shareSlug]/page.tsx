import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaignReportBySlug } from "@/lib/reports/data";
import { BRAND, formatDateRu } from "@/lib/i18n/common";

type ReportPageProps = {
  params: Promise<{ shareSlug: string }>;
};

function formatDate(date: Date | null) {
  if (!date) return "Отправок ещё не было";
  return formatDateRu(date);
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-zinc-400">{helper}</p>
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-white/10 bg-zinc-950/70">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-cyan-200">
                Отчёт по кампании
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl">
                {report.campaign.name}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                <span>@{report.campaign.instagramUsername}</span>
                {report.campaign.goal && (
                  <>
                    <span>·</span>
                    <span>{report.campaign.goal}</span>
                  </>
                )}
                <span>·</span>
                <span>
                  {report.campaign.isActive ? "Кампания активна" : "Кампания на паузе"}
                </span>
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.035] p-4 text-sm text-zinc-300 md:min-w-64">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Рабочее пространство
              </p>
              <p className="mt-2 font-bold text-white">{report.workspace.name}</p>
              <p className="mt-4 text-xs text-zinc-500">
                Сформирован {formatDate(report.generatedAt)}
              </p>
              {report.branded && (
                <Link
                  href="/"
                  className="mt-4 inline-flex items-center justify-center border border-cyan-200/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/40"
                >
                  Работает на {BRAND}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Отправлено"
            value={report.metrics.sent}
            helper="Сообщения в Direct, доставленные успешно."
          />
          <MetricCard
            label="Пропущено"
            value={report.metrics.skipped}
            helper="Повторы, лимиты и другие случаи без отправки."
          />
          <MetricCard
            label="Ошибки"
            value={report.metrics.failed}
            helper="Отправки, которые нужно проверить."
          />
          <MetricCard
            label="Переходы"
            value={report.metrics.clicks}
            helper="Переходы по отслеживаемой ссылке из сообщений."
          />
          <MetricCard
            label="CTR"
            value={`${report.metrics.ctr}%`}
            helper="Переходы, делённые на отправленные сообщения."
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="border border-white/10 bg-white/[0.035] p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">
                  Последние 7 дней
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Отправленные сообщения и переходы по ссылке по дням.
                </p>
              </div>
              <p className="text-xs text-zinc-500">
                Последняя отправка: {formatDate(report.metrics.latestSentAt)}
              </p>
            </div>
            <div className="mt-8 grid h-56 grid-cols-7 items-end gap-1.5 sm:gap-3">
              {report.daily.map((day) => (
                <div key={day.date} className="flex h-full flex-col justify-end gap-2">
                  <div className="flex min-h-0 flex-1 items-end gap-1">
                    <div
                      className="w-full bg-cyan-300/75"
                      style={{
                        height: `${Math.max((day.sent / maxDaily) * 100, 4)}%`,
                      }}
                      title={`Отправлено: ${day.sent}`}
                    />
                    <div
                      className="w-full bg-emerald-300/75"
                      style={{
                        height: `${Math.max((day.clicks / maxDaily) * 100, 4)}%`,
                      }}
                      title={`Переходы: ${day.clicks}`}
                    />
                  </div>
                  <p className="truncate text-center text-[11px] text-zinc-500">
                    {day.date}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 bg-cyan-300" />
                Отправленные сообщения
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 bg-emerald-300" />
                Переходы по ссылке
              </span>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="border border-white/10 bg-white/[0.035] p-4 sm:p-6">
              <h2 className="text-xl font-black text-white">Популярные ключевые слова</h2>
              <div className="mt-5 space-y-3">
                {report.topKeywords.length === 0 && (
                  <p className="text-sm text-zinc-400">
                    Совпадений по ключевым словам пока нет.
                  </p>
                )}
                {report.topKeywords.map((keyword) => (
                  <div
                    key={keyword.keyword}
                    className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0"
                  >
                    <span className="text-sm font-semibold text-white">
                      {keyword.keyword}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {keyword.count}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-white/10 bg-white/[0.035] p-4 sm:p-6">
              <h2 className="text-xl font-black text-white">Отслеживаемые ссылки</h2>
              <div className="mt-5 space-y-3">
                {report.trackedLinks.length === 0 && (
                  <p className="text-sm text-zinc-400">
                    В этой кампании нет отслеживаемой ссылки.
                  </p>
                )}
                {report.trackedLinks.map((link) => (
                  <div
                    key={link.slug}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="min-w-0 truncate text-sm text-zinc-300">
                      {link.destinationHost}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {link.clicks}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-8 border border-white/10 bg-white/[0.035] p-4 sm:p-6">
          <h2 className="text-xl font-black text-white">Настройки кампании</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Ключевые слова
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.campaign.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="border border-white/10 bg-zinc-950 px-2 py-1 text-xs font-semibold text-zinc-300"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Создана
              </p>
              <p className="mt-3 text-sm text-zinc-300">
                {formatDate(report.campaign.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Публикация-источник
              </p>
              {report.campaign.postUrl ? (
                <a
                  href={report.campaign.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
                >
                  Открыть публикацию в Instagram
                </a>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">Не привязана</p>
              )}
            </div>
          </div>
        </section>

        {report.branded && (
          <footer className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-zinc-500">
            Сделано в {BRAND} — автоматизация ответов на комментарии в Instagram Direct.
          </footer>
        )}
      </section>
    </main>
  );
}
