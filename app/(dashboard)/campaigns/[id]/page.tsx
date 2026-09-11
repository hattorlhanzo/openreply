"use client";

/**
 * Campaign Detail
 *
 * Clicking a campaign opens this read-only view: a summary of the automation
 * on the left, and Insights / Preview tabs on the right. Edit and Stop/Resume
 * live in the top bar.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import StatCard from "@/components/stat-card";
import {
  IconAlert,
  IconChevronLeft,
  IconInstagram,
  IconLink,
  IconMessage,
  IconPercent,
  IconSend,
  IconSkip,
  IconTarget,
  IconZap,
} from "@/components/ui/icons";

interface Campaign {
  id: string;
  name: string;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmTriggerEnabled: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  isActive: boolean;
  instagramAccountId: string;
  instagramAccount: { username: string };
  trackedLinks?: {
    destinationUrl: string;
    label?: string | null;
    trackedUrl?: string;
    _count?: { clicks: number };
  }[];
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    ctr: number;
    topKeywords?: { keyword: string; count: number }[];
  };
}

type Tab = "insights" | "preview";

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("insights");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return setNotFound(true);
        const found = (payload.data as Campaign[]).find((c) => c.id === id);
        if (!found) return setNotFound(true);
        setCampaign(found);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!campaign) return;
    const acct = campaign.instagramAccountId;
    fetch(`/api/instagram/profile?instagramAccountId=${acct}`)
      .then((r) => r.json())
      .then((d) =>
        setAvatarUrl(d.success ? d.data.profilePictureUrl ?? null : null)
      )
      .catch(() => setAvatarUrl(null));

    if (campaign.postId) {
      fetch(`/api/instagram/posts?instagramAccountId=${acct}&limit=50`)
        .then((r) => r.json())
        .then((payload) => {
          if (!payload.success) return;
          const hit = (
            payload.data as {
              id: string;
              thumbnail_url?: string;
              media_url?: string;
            }[]
          ).find((p) => p.id === campaign.postId);
          setPostThumb(hit?.thumbnail_url ?? hit?.media_url ?? null);
        })
        .catch(() => setPostThumb(null));
    }
  }, [campaign]);

  async function toggleActive() {
    if (!campaign) return;
    setBusy(true);
    try {
      await fetch(`/api/automations?id=${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !campaign.isActive }),
      });
      setCampaign({ ...campaign, isActive: !campaign.isActive });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="card h-20" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-[108px]" />
          ))}
        </div>
        <div className="card h-64" />
      </div>
    );
  }
  if (notFound || !campaign) {
    return (
      <div className="card">
        <div className="empty !py-14">
          <span className="empty-icon">
            <IconZap size={22} />
          </span>
          <p className="empty-title">Кампания не найдена</p>
          <p className="text-[13px]">Возможно, её удалили или ссылка устарела.</p>
          <button
            type="button"
            onClick={() => router.push("/campaigns")}
            className="btn btn-secondary mt-3"
          >
            <IconChevronLeft size={16} />
            К списку кампаний
          </button>
        </div>
      </div>
    );
  }

  const publicReplies =
    campaign.publicReplyMessages && campaign.publicReplyMessages.length > 0
      ? campaign.publicReplyMessages
      : campaign.publicReplyMessage
        ? [campaign.publicReplyMessage]
        : [];
  const hasLink = Boolean(campaign.trackedLinks?.[0]?.destinationUrl);
  const hasSecondLink = Boolean(campaign.trackedLinks?.[1]?.destinationUrl);

  const trigger = campaign.matchAnyPost
    ? "Любая публикация или Reels"
    : campaign.pendingNextReel
      ? "Ваш следующий Reels"
      : "Конкретная публикация или Reels";
  const matchText = campaign.matchAnyWord
    ? "Любой комментарий"
    : campaign.keywords.join(", ") || "Без ключевых слов";

  const topKeywords = campaign.analytics.topKeywords ?? [];
  const links = (campaign.trackedLinks ?? []).filter((l) => l.destinationUrl);

  let step = 0;
  const nextStep = () => ++step;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          href="/campaigns"
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-foreground"
        >
          <IconChevronLeft size={15} />
          Кампании
        </Link>
        <div className="page-head !mb-0 flex-col sm:flex-row sm:!items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`icon-tile !h-11 !w-11 ${campaign.isActive ? "icon-tile-success" : "icon-tile-muted"}`}
            >
              <IconZap size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="page-title truncate">{campaign.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`badge ${campaign.isActive ? "badge-success" : "badge-muted"}`}>
                  {campaign.isActive ? "Активна" : "На паузе"}
                </span>
                <span className="chip chip-outline">
                  <IconInstagram size={12} />@{campaign.instagramAccount.username}
                </span>
                {campaign.pendingNextReel && (
                  <span className="badge badge-warning badge-plain">Ждёт следующий Reels</span>
                )}
                {campaign.requireFollow && (
                  <span className="badge badge-accent badge-plain">Проверка подписки</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/campaigns/${campaign.id}/edit`} className="btn btn-secondary">
              Редактировать
            </Link>
            <button
              type="button"
              onClick={toggleActive}
              disabled={busy}
              className={`btn ${campaign.isActive ? "btn-danger" : "btn-primary"}`}
            >
              {campaign.isActive ? "Остановить" : "Возобновить"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="seg">
        <button
          type="button"
          className="seg-item"
          aria-pressed={tab === "insights"}
          onClick={() => setTab("insights")}
        >
          Статистика
        </button>
        <button
          type="button"
          className="seg-item"
          aria-pressed={tab === "preview"}
          onClick={() => setTab("preview")}
        >
          Предпросмотр
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* Left: config summary */}
        <div className="space-y-4">
          <SummaryCard step={nextStep()} title="Когда кто-то комментирует">
            <div className="flex items-center gap-3">
              {postThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={postThumb}
                  alt="Публикация"
                  className="h-14 w-14 rounded-[10px] border border-border object-cover"
                />
              ) : (
                <span className="icon-tile !h-14 !w-14 icon-tile-muted">
                  <IconInstagram size={22} />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-foreground">{trigger}</p>
                {campaign.postUrl && (
                  <a
                    href={campaign.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-accent-hi hover:underline"
                  >
                    Открыть в Instagram
                  </a>
                )}
              </div>
            </div>
          </SummaryCard>

          <SummaryCard step={nextStep()} title="И в комментарии есть">
            {campaign.matchAnyWord || campaign.keywords.length === 0 ? (
              <FieldBox>{matchText}</FieldBox>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {campaign.keywords.map((kw) => (
                  <span key={kw} className="chip">
                    {kw}
                  </span>
                ))}
              </div>
            )}
            {campaign.dmTriggerEnabled && (
              <p className="hint">
                Также отвечает, когда пишут в Direct{" "}
                {campaign.matchAnyWord ? "что угодно" : "эти слова"}.
              </p>
            )}
            {publicReplies.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="section-label">Публичный ответ под публикацией</p>
                {publicReplies.map((m, i) => (
                  <FieldBox key={i}>{m}</FieldBox>
                ))}
              </div>
            )}
          </SummaryCard>

          {campaign.openingDmEnabled && (
            <SummaryCard step={nextStep()} title="Подписчик получит первое сообщение">
              <FieldBox>{campaign.openingDmMessage || "Первое сообщение"}</FieldBox>
              <ButtonBox>{campaign.openingDmButtonLabel || "Кнопка"}</ButtonBox>
            </SummaryCard>
          )}

          {campaign.requireFollow && (
            <SummaryCard step={nextStep()} title="Сначала нужно подписаться">
              <FieldBox>
                {campaign.followPromptMessage ||
                  "Небольшая просьба перед тем, как отправлю ссылку: подпишитесь на нас, чтобы не пропустить новинки. Нажмите кнопку, когда подпишетесь, — и я сразу всё пришлю"}
              </FieldBox>
              <ButtonBox>{campaign.followPromptButtonLabel || "Я подписан(а)"}</ButtonBox>
            </SummaryCard>
          )}

          <SummaryCard step={nextStep()} title="А затем получит сообщение в Direct">
            <FieldBox>{campaign.dmMessage}</FieldBox>
            {hasLink && (
              <ButtonBox>{campaign.linkButtonLabel || "Открыть ссылку"}</ButtonBox>
            )}
            {hasSecondLink && (
              <ButtonBox>{campaign.trackedLinks?.[1]?.label || "Открыть ссылку"}</ButtonBox>
            )}
          </SummaryCard>

          {hasLink && (
            <SummaryCard step={nextStep()} title="Какая ссылка отправляется">
              {links.map((link, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-start gap-2 rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2">
                    <IconLink size={14} className="mt-0.5 shrink-0 text-muted" />
                    <p className="select-all break-all font-mono text-[12px] text-foreground">
                      {link.trackedUrl ?? link.destinationUrl}
                    </p>
                  </div>
                  <p className="hint !mt-1">
                    {link.label ? `${link.label} · ` : ""}ведёт на{" "}
                    <span className="break-all">{link.destinationUrl}</span>
                  </p>
                </div>
              ))}
            </SummaryCard>
          )}

          {campaign.followUpEnabled && campaign.followUpMessage && (
            <SummaryCard step={nextStep()} title="Затем напоминание">
              <FieldBox>{campaign.followUpMessage}</FieldBox>
              <p className="hint">
                {campaign.followUpDelayMinutes && campaign.followUpDelayMinutes > 0
                  ? `Уйдёт через ${campaign.followUpDelayMinutes} мин после ссылки.`
                  : "Уйдёт сразу после ссылки."}
              </p>
            </SummaryCard>
          )}
        </div>

        {/* Right: statistics or preview */}
        <div className="min-w-0 space-y-4">
          {tab === "insights" && (
            <>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <StatCard
                  label="Отправлено"
                  value={campaign.analytics.sent}
                  icon={<IconSend size={16} />}
                  tone="accent"
                  hint="сообщений в Direct"
                />
                <StatCard
                  label="Переходы"
                  value={campaign.analytics.clicks}
                  icon={<IconLink size={16} />}
                  tone="success"
                  hint="по отслеживаемой ссылке"
                />
                <StatCard
                  label="CTR"
                  value={`${campaign.analytics.ctr}%`}
                  icon={<IconPercent size={16} />}
                  tone="warning"
                  hint="переходы ÷ отправлено"
                />
                <StatCard
                  label="Ошибки"
                  value={campaign.analytics.failed}
                  icon={<IconAlert size={16} />}
                  tone={campaign.analytics.failed > 0 ? "error" : "muted"}
                  hint={`${campaign.analytics.skipped} пропущено`}
                />
              </div>

              <div className="card">
                <div className="card-head">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile !h-8 !w-8 !rounded-[9px]">
                      <IconTarget size={16} />
                    </span>
                    <span className="card-title">Срабатывания по ключевым словам</span>
                  </div>
                </div>
                {topKeywords.length === 0 ? (
                  <div className="empty !py-10">
                    <span className="empty-icon">
                      <IconMessage size={20} />
                    </span>
                    <p className="empty-title">Совпадений пока нет</p>
                    <p className="text-[13px]">
                      Как только под публикацией напишут ключевое слово, оно появится здесь.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Ключевое слово</th>
                          <th className="!text-right">Срабатываний</th>
                          <th className="w-1/2">Доля</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topKeywords.map((k) => {
                          const total = topKeywords.reduce((s, x) => s + x.count, 0) || 1;
                          const pct = Math.round((k.count / total) * 100);
                          return (
                            <tr key={k.keyword}>
                              <td>
                                <span className="chip">{k.keyword}</span>
                              </td>
                              <td className="text-right font-semibold tabular-nums">{k.count}</td>
                              <td>
                                <div className="flex items-center gap-3">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                                    <div
                                      className="h-full rounded-full bg-accent"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="w-10 text-right text-[12px] tabular-nums text-muted">
                                    {pct}%
                                  </span>
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
                <div className="card-head">
                  <div className="flex items-center gap-3">
                    <span className="icon-tile !h-8 !w-8 !rounded-[9px] icon-tile-success">
                      <IconLink size={16} />
                    </span>
                    <span className="card-title">Отслеживаемые ссылки</span>
                  </div>
                </div>
                {links.length === 0 ? (
                  <div className="empty !py-10">
                    <span className="empty-icon">
                      <IconSkip size={20} />
                    </span>
                    <p className="empty-title">Ссылок нет</p>
                    <p className="text-[13px]">
                      Добавьте отслеживаемую ссылку в конструкторе, чтобы считать переходы.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Кнопка</th>
                          <th>Ведёт на</th>
                          <th className="!text-right">Переходы</th>
                        </tr>
                      </thead>
                      <tbody>
                        {links.map((l, i) => (
                          <tr key={i}>
                            <td className="whitespace-nowrap font-medium">
                              {l.label || campaign.linkButtonLabel || "Открыть ссылку"}
                            </td>
                            <td className="max-w-[360px] truncate font-mono text-[12px] text-muted">
                              {l.destinationUrl}
                            </td>
                            <td className="text-right font-semibold tabular-nums">
                              {l._count?.clicks ?? (i === 0 ? campaign.analytics.clicks : "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "preview" && (
            <div className="card">
              <div className="card-head">
                <div className="flex items-center gap-3">
                  <span className="icon-tile !h-8 !w-8 !rounded-[9px]">
                    <IconInstagram size={16} />
                  </span>
                  <span className="card-title">Как это увидит подписчик</span>
                </div>
              </div>
              <div className="card-body flex justify-center !py-8">
                <CampaignPreview
                  tab={previewTab}
                  onTabChange={setPreviewTab}
                  username={campaign.instagramAccount.username}
                  avatarUrl={avatarUrl}
                  postThumb={postThumb}
                  caption=""
                  sampleComment={campaign.matchAnyWord ? "класс!" : campaign.keywords[0] ?? "ССЫЛКА"}
                  dmTriggerEnabled={campaign.dmTriggerEnabled}
                  publicReplyEnabled={campaign.publicReplyEnabled}
                  publicReplyMessage={publicReplies[0] ?? ""}
                  openingDmEnabled={campaign.openingDmEnabled}
                  openingDmMessage={campaign.openingDmMessage ?? ""}
                  openingDmButtonLabel={campaign.openingDmButtonLabel ?? ""}
                  revealMessage={campaign.dmMessage}
                  hasLink={hasLink}
                  linkButtonLabel={campaign.linkButtonLabel ?? "Открыть ссылку"}
                  linkUrl={
                    campaign.trackedLinks?.[0]?.trackedUrl ??
                    campaign.trackedLinks?.[0]?.destinationUrl
                  }
                  hasSecondLink={hasSecondLink}
                  secondLinkButtonLabel={
                    campaign.trackedLinks?.[1]?.label ?? "Открыть ссылку"
                  }
                  requireFollow={campaign.requireFollow}
                  followPromptMessage={campaign.followPromptMessage ?? ""}
                  followPromptButtonLabel={
                    campaign.followPromptButtonLabel ?? "Я подписан(а)"
                  }
                  followUpEnabled={campaign.followUpEnabled ?? false}
                  followUpMessage={campaign.followUpMessage ?? ""}
                  followUpDelayMinutes={campaign.followUpDelayMinutes ?? 0}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-head !py-3.5">
        <div className="flex items-center gap-3">
          <span className="icon-tile !h-7 !w-7 !rounded-[8px] text-[12px] font-bold tabular-nums">
            {step}
          </span>
          <span className="card-title">{title}</span>
        </div>
      </div>
      <div className="card-body space-y-2 !p-4">{children}</div>
    </div>
  );
}

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="whitespace-pre-wrap rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-foreground">
      {children}
    </div>
  );
}

function ButtonBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface px-3 py-2 text-center text-[13px] font-semibold text-accent-hi">
      {children}
    </div>
  );
}
