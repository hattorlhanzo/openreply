"use client";

/**
 * Campaign Builder
 *
 * Two-pane campaign editor: a control panel on the left and a live phone
 * preview on the right. Used for both creating and editing a campaign.
 *
 * Turn 1 wires the fully-functional pieces: trigger scope (specific / any /
 * next post), match mode (specific words / any word), the opening + reveal DM
 * text, public reply, and the tracked link. Button-driven delivery and the
 * follow / email / follow-up steps arrive in later turns.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import PostPicker from "@/components/post-picker";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import { readCache, writeCache } from "@/lib/client-cache";
import {
  IMPORT_QUEUE_KEY,
  IMPORT_ACCOUNT_KEY,
  type ImportRow,
} from "@/lib/import-queue";
import {
  IconAlert,
  IconChevronLeft,
  IconInstagram,
  IconList,
  IconPlus,
  IconX,
  IconZap,
} from "@/components/ui/icons";

type TriggerScope = "specific" | "any" | "next";
type MatchMode = "specific" | "any";

interface LoadedCampaign {
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
  trackedLinks?: { destinationUrl: string; label?: string | null }[];
}

interface CampaignBuilderProps {
  mode: "new" | "edit";
  campaignId?: string;
}

function Section({
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
      <div className="card-body space-y-3 !p-4">{children}</div>
    </div>
  );
}

function Radio({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      data-checked={checked}
      className="choice w-full text-left"
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
          checked ? "border-accent" : "border-border-hover"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="flex-1 text-foreground">{children}</span>
    </button>
  );
}

function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-accent" : "bg-border-hover"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
          on ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

/** A toggle row with optional nested fields — a sub-block inside a step card. */
function ToggleBlock({
  on,
  onToggle,
  label,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[10px] border p-3 transition-colors ${
        on ? "border-border bg-surface" : "border-border-subtle bg-surface-2"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] text-foreground">{label}</span>
        <Toggle on={on} onToggle={onToggle} />
      </div>
      {on && children && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

export default function CampaignBuilder({ mode, campaignId }: CampaignBuilderProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(mode === "edit");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [triggerScope, setTriggerScope] = useState<TriggerScope>("specific");
  const [postId, setPostId] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState("");

  // Post IDs already tied to another automation on this account, so the picker
  // can flag them and the user knows not to double-assign. Maps postId ->
  // the campaign name using it (for the tooltip).
  const [usedPosts, setUsedPosts] = useState<Record<string, string>>({});

  const [matchMode, setMatchMode] = useState<MatchMode>("specific");
  const [keywordText, setKeywordText] = useState("");
  const [dmTriggerEnabled, setDmTriggerEnabled] = useState(false);

  const [publicReplyEnabled, setPublicReplyEnabled] = useState(false);
  const [publicReplyMessages, setPublicReplyMessages] = useState<string[]>([""]);

  const [openingDmEnabled, setOpeningDmEnabled] = useState(false);
  const [openingDmMessage, setOpeningDmMessage] = useState("");
  const [openingDmButtonLabel, setOpeningDmButtonLabel] = useState("");

  const [dmMessage, setDmMessage] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [trackedDestinationUrl, setTrackedDestinationUrl] = useState("");
  const [linkButtonLabel, setLinkButtonLabel] = useState("Открыть ссылку");
  const [secondLinkOpen, setSecondLinkOpen] = useState(false);
  const [secondaryDestinationUrl, setSecondaryDestinationUrl] = useState("");
  const [secondaryButtonLabel, setSecondaryButtonLabel] = useState("Открыть ссылку");
  const [requireFollow, setRequireFollow] = useState(false);
  const [followPromptMessage, setFollowPromptMessage] = useState("");
  const [followPromptButtonLabel, setFollowPromptButtonLabel] =
    useState("Я подписан(а)");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpDelayMinutes, setFollowUpDelayMinutes] = useState(0);

  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");

  // CSV import queue. When present, each save advances to the next row instead
  // of returning to the campaigns list.
  const [importQueue, setImportQueue] = useState<ImportRow[] | null>(null);
  const [importTotal, setImportTotal] = useState(0);

  const keywords = useMemo(
    () =>
      keywordText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    [keywordText]
  );

  // Fetch the connected account's real avatar for the preview (cache-first so
  // it shows instantly on a return visit instead of a blank circle).
  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    const cacheKey = `ig-avatar:${selectedAccountId}`;
    const cached = readCache<string | null>(cacheKey, 30 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached.data !== null) setAvatarUrl(cached.data);

    const params = new URLSearchParams({ instagramAccountId: selectedAccountId });
    fetch(`/api/instagram/profile?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const url = d.success ? d.data.profilePictureUrl ?? null : null;
        setAvatarUrl(url);
        writeCache(cacheKey, url);
      })
      .catch(() => {
        if (!cancelled && cached.data === null) setAvatarUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  // Load accounts (both modes need them for the preview username + selector).
  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return;
        const next: AccountOption[] = payload.data.instagramAccounts ?? [];
        setAccounts(next);
        setSelectedAccountId(
          (prev) => prev || payload.data.selectedInstagramAccountId || next[0]?.id || ""
        );
      })
      .catch(() => setAccounts([]));
  }, []);

  // Prefill when editing.
  useEffect(() => {
    if (mode !== "edit" || !campaignId) return;
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return setNotFound(true);
        const c = (payload.data as LoadedCampaign[]).find((x) => x.id === campaignId);
        if (!c) return setNotFound(true);
        setName(c.name);
        setSelectedAccountId(c.instagramAccountId);
        setTriggerScope(
          c.matchAnyPost ? "any" : c.pendingNextReel ? "next" : "specific"
        );
        setPostId(c.postId);
        setPostUrl(c.postUrl);
        setMatchMode(c.matchAnyWord ? "any" : "specific");
        setKeywordText(c.keywords.join(", "));
        setDmTriggerEnabled(c.dmTriggerEnabled ?? false);
        setPublicReplyEnabled(c.publicReplyEnabled);
        setPublicReplyMessages(
          c.publicReplyMessages?.length
            ? c.publicReplyMessages
            : c.publicReplyMessage
              ? [c.publicReplyMessage]
              : [""]
        );
        setOpeningDmEnabled(c.openingDmEnabled);
        setOpeningDmMessage(c.openingDmMessage ?? "");
        setOpeningDmButtonLabel(c.openingDmButtonLabel ?? "");
        setDmMessage(c.dmMessage);
        setLinkButtonLabel(c.linkButtonLabel ?? "Открыть ссылку");
        setIsActive(c.isActive);
        const link = c.trackedLinks?.[0]?.destinationUrl ?? "";
        setTrackedDestinationUrl(link);
        setLinkOpen(Boolean(link));
        const secondLink = c.trackedLinks?.[1];
        setSecondaryDestinationUrl(secondLink?.destinationUrl ?? "");
        setSecondaryButtonLabel(secondLink?.label ?? "Открыть ссылку");
        setSecondLinkOpen(Boolean(secondLink?.destinationUrl));
        setRequireFollow(c.requireFollow ?? false);
        setFollowPromptMessage(c.followPromptMessage ?? "");
        setFollowPromptButtonLabel(
          c.followPromptButtonLabel ?? "Я подписан(а)"
        );
        setFollowUpEnabled(c.followUpEnabled ?? false);
        setFollowUpMessage(c.followUpMessage ?? "");
        setFollowUpDelayMinutes(c.followUpDelayMinutes ?? 0);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [mode, campaignId]);

  // Track which posts on the selected account are already assigned to an
  // automation, so the picker can highlight them. The campaign being edited is
  // excluded — its own post should read as selected, not "taken".
  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled || !payload.success) return;
        const map: Record<string, string> = {};
        for (const a of payload.data as LoadedCampaign[]) {
          if (!a.postId) continue;
          if (a.instagramAccountId !== selectedAccountId) continue;
          if (mode === "edit" && a.id === campaignId) continue;
          map[a.postId] = a.name;
        }
        setUsedPosts(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, mode, campaignId]);

  // Prefill the editable fields from one queued import row. The reel is left
  // unset so the user picks it per row.
  function prefillFromRow(row: ImportRow) {
    setName(row.name ?? "");
    setTriggerScope("specific");
    setPostId(null);
    setPostUrl(null);
    setPostThumb(null);
    setPostCaption("");
    setMatchMode("specific");
    setKeywordText((row.keywords ?? []).join(", "));
    setDmMessage(row.dmMessage ?? "");
    setPublicReplyEnabled(Boolean(row.publicReply));
    setPublicReplyMessages(row.publicReply ? [row.publicReply] : [""]);
    const hasOpening = Boolean(row.openingDmMessage);
    setOpeningDmEnabled(hasOpening);
    setOpeningDmMessage(row.openingDmMessage ?? "");
    setOpeningDmButtonLabel(
      row.openingDmButtonLabel || (hasOpening ? "Получить ссылку" : "")
    );
    const link = row.trackedUrl ?? "";
    setTrackedDestinationUrl(link);
    setLinkOpen(Boolean(link));
    setError(null);
  }

  // Pick up a staged CSV import (new mode only) and prefill the first row.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "new") return;
    try {
      const raw = window.localStorage.getItem(IMPORT_QUEUE_KEY);
      const acct = window.localStorage.getItem(IMPORT_ACCOUNT_KEY);
      if (!raw) return;
      const queue = JSON.parse(raw) as ImportRow[];
      if (!Array.isArray(queue) || queue.length === 0) return;
      setImportQueue(queue);
      setImportTotal(queue.length);
      if (acct) setSelectedAccountId(acct);
      prefillFromRow(queue[0]);
    } catch {
      // ignore a malformed queue
    }
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const username =
    accounts.find((a) => a.id === selectedAccountId)?.username ?? "vashbrend";

  function handlePostSelect(
    id: string,
    url?: string,
    thumb?: string,
    caption?: string
  ) {
    setPostId(id);
    setPostUrl(url ?? null);
    setPostThumb(thumb ?? null);
    setPostCaption(caption ?? "");
  }

  function ensureLinkToken() {
    setDmMessage((cur) => (cur.includes("{link}") ? cur : `${cur.trim()} {link}`.trim()));
  }

  async function handleSubmit(activeValue: boolean) {
    setError(null);

    if (!selectedAccountId) return setError("Сначала подключите Instagram-аккаунт.");
    if (triggerScope === "specific" && !postId)
      return setError("Выберите публикацию или Reels, которые запускают кампанию.");
    if (matchMode === "specific" && keywords.length === 0)
      return setError("Добавьте хотя бы одно ключевое слово или выберите «любое слово».");
    if (!dmMessage.trim()) return setError("Напишите сообщение в Direct со ссылкой.");
    if (openingDmEnabled && (!openingDmMessage.trim() || !openingDmButtonLabel.trim()))
      return setError("Для первого сообщения нужны текст и подпись кнопки.");

    setSaving(true);

    const payload = {
      name: name.trim() || `Кампания для @${username}`,
      instagramAccountId: selectedAccountId,
      postId: triggerScope === "specific" ? postId : null,
      postUrl: triggerScope === "specific" ? postUrl : null,
      matchAnyPost: triggerScope === "any",
      pendingNextReel: triggerScope === "next",
      matchAnyWord: matchMode === "any",
      keywords: matchMode === "any" ? [] : keywords,
      dmTriggerEnabled,
      dmMessage,
      openingDmEnabled,
      openingDmMessage: openingDmEnabled ? openingDmMessage : null,
      openingDmButtonLabel: openingDmEnabled ? openingDmButtonLabel : null,
      publicReplyEnabled,
      publicReplyMessages: publicReplyEnabled
        ? publicReplyMessages.map((m) => m.trim()).filter(Boolean)
        : [],
      trackedDestinationUrl: trackedDestinationUrl.trim() || "",
      linkButtonLabel: linkButtonLabel.trim() || "Открыть ссылку",
      secondaryDestinationUrl: secondaryDestinationUrl.trim() || "",
      secondaryButtonLabel: secondaryButtonLabel.trim() || "Открыть ссылку",
      requireFollow,
      followPromptMessage: requireFollow ? followPromptMessage.trim() : "",
      followPromptButtonLabel: requireFollow
        ? followPromptButtonLabel.trim() || "Я подписан(а)"
        : "",
      followUpEnabled,
      followUpMessage: followUpEnabled ? followUpMessage.trim() : "",
      followUpDelayMinutes: followUpEnabled ? followUpDelayMinutes : 0,
      isActive: activeValue,
    };

    try {
      const res =
        mode === "new"
          ? await fetch("/api/automations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/automations?id=${campaignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json();
      if (data.success) {
        // The post we just assigned is now in use. Reflect it immediately so
        // the picker flags it on the next imported row — the fetch that builds
        // this map doesn't re-run while the builder stays mounted through the
        // import queue.
        if (triggerScope === "specific" && postId) {
          const assignedPostId = postId;
          setUsedPosts((prev) => ({ ...prev, [assignedPostId]: payload.name }));
        }
        // Importing: advance to the next queued row instead of leaving.
        if (importQueue && importQueue.length > 1) {
          const remaining = importQueue.slice(1);
          try {
            window.localStorage.setItem(
              IMPORT_QUEUE_KEY,
              JSON.stringify(remaining)
            );
          } catch {
            // ignore
          }
          setImportQueue(remaining);
          prefillFromRow(remaining[0]);
          setSaving(false);
          if (typeof window !== "undefined") window.scrollTo({ top: 0 });
          return;
        }
        if (importQueue) {
          try {
            window.localStorage.removeItem(IMPORT_QUEUE_KEY);
            window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
          } catch {
            // ignore
          }
        }
        // refresh() busts the router cache so the list reflects the save
        // instead of landing on a stale (empty) campaigns page.
        router.push("/campaigns");
        router.refresh();
      } else {
        // Surface the specific field that failed validation instead of a
        // generic "Invalid input".
        const fieldErrors = data.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        const firstField = fieldErrors && Object.keys(fieldErrors)[0];
        setError(
          firstField
            ? fieldErrors[firstField][0]
            : data.error ?? "Не удалось сохранить кампанию"
        );
        if (typeof window !== "undefined")
          window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError("Не удалось сохранить кампанию");
    } finally {
      setSaving(false);
    }
  }

  // Skip the current imported row without saving a campaign for it, advancing
  // to the next one (or finishing the import if it was the last).
  function skipRow() {
    if (!importQueue) return;
    setError(null);
    if (importQueue.length > 1) {
      const remaining = importQueue.slice(1);
      try {
        window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(remaining));
      } catch {
        // ignore
      }
      setImportQueue(remaining);
      prefillFromRow(remaining[0]);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      return;
    }
    // Last row skipped — finish the import.
    try {
      window.localStorage.removeItem(IMPORT_QUEUE_KEY);
      window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
    } catch {
      // ignore
    }
    router.push("/campaigns");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="card h-16" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="card h-40" />
            <div className="card h-64" />
          </div>
          <div className="card h-[520px]" />
        </div>
      </div>
    );
  }

  if (notFound) {
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

  const fieldCls = "input";
  const areaCls = "textarea";

  return (
    <div className="space-y-5">
      {importQueue && (
        <div className="card flex items-start gap-3 p-4">
          <span className="icon-tile !h-8 !w-8 !rounded-[9px]">
            <IconList size={16} />
          </span>
          <div className="min-w-0 flex-1 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">Импорт из CSV</span>
              <span className="badge badge-accent badge-plain tabular-nums">
                {importTotal - importQueue.length + 1} из {importTotal}
              </span>
            </div>
            <p className="mt-1 text-muted">
              Поля заполнены из вашего CSV. Выберите Reels, поправьте что нужно и
              сохраните — откроется следующая строка. Не нужна — нажмите «Пропустить».
            </p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="page-head !mb-1 flex-col sm:flex-row sm:!items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`icon-tile !h-11 !w-11 ${
              mode === "edit" ? (isActive ? "icon-tile-success" : "icon-tile-muted") : ""
            }`}
          >
            <IconZap size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="page-title truncate">
              {mode === "edit" ? name || "Кампания без названия" : "Новая кампания"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {mode === "edit" ? (
                <span className={`badge ${isActive ? "badge-success" : "badge-muted"}`}>
                  {isActive ? "Активна" : "На паузе"}
                </span>
              ) : (
                <span className="page-sub !mt-0">Комментарий под публикацией → сообщение в Direct</span>
              )}
              {username && (
                <span className="chip chip-outline">
                  <IconInstagram size={12} />@{username}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {importQueue && (
            <button
              type="button"
              onClick={skipRow}
              disabled={saving}
              className="btn btn-ghost"
            >
              {importQueue.length > 1 ? "Пропустить" : "Пропустить и завершить"}
            </button>
          )}
          {mode === "edit" &&
            (isActive ? (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="btn btn-secondary"
              >
                Остановить
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="btn btn-secondary"
              >
                Запустить
              </button>
            ))}
          <button
            type="button"
            onClick={() => handleSubmit(mode === "new" ? true : isActive)}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? "Сохранение…" : mode === "new" ? "Запустить" : "Сохранить изменения"}
          </button>
        </div>
      </div>

      {/* min-w-0 on the cells: a grid item defaults to min-width:auto, so a
          long string widens the whole page instead of wrapping. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
      {/* Left: controls */}
      <div className="min-w-0 space-y-4">
        {error && (
          <div className="card flex items-start gap-3 border-error/40 p-4">
            <span className="icon-tile !h-8 !w-8 !rounded-[9px] icon-tile-error">
              <IconAlert size={16} />
            </span>
            <div>
              <span className="badge badge-error">Проверьте кампанию</span>
              <p className="mt-1.5 text-[13px] text-foreground">{error}</p>
            </div>
          </div>
        )}

        <Section step={1} title="Основное">
          <div>
            <label className="label" htmlFor="campaign-name">
              Название кампании{" "}
              <span className="font-normal text-muted">(необязательно)</span>
            </label>
            <input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Меню по слову МЕНЮ"
              className={fieldCls}
              maxLength={100}
            />
            <p className="hint">Видно только вам — в списке кампаний.</p>
          </div>
          {accounts.length > 1 && (
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={(id) => {
                setSelectedAccountId(id);
                setPostId(null);
                setPostUrl(null);
                setPostThumb(null);
              }}
              includeAll={false}
              label="Instagram-аккаунт"
            />
          )}
        </Section>

        <Section step={2} title="Когда кто-то комментирует">
          <div role="radiogroup" className="space-y-2">
            <Radio
              checked={triggerScope === "specific"}
              onSelect={() => setTriggerScope("specific")}
            >
              конкретную публикацию или Reels
            </Radio>
            {triggerScope === "specific" && (
              <div className="rounded-[10px] border border-border-subtle bg-surface-2 p-2.5">
                <PostPicker
                  selectedPostId={postId}
                  instagramAccountId={selectedAccountId}
                  usedPostIds={usedPosts}
                  onSelect={handlePostSelect}
                />
              </div>
            )}
            <Radio
              checked={triggerScope === "any"}
              onSelect={() => setTriggerScope("any")}
            >
              любую публикацию или Reels
            </Radio>
            <Radio
              checked={triggerScope === "next"}
              onSelect={() => setTriggerScope("next")}
            >
              следующую публикацию или Reels
            </Radio>
          </div>
        </Section>

        <Section step={3} title="И в комментарии есть">
          <div role="radiogroup" className="space-y-2">
            <Radio
              checked={matchMode === "specific"}
              onSelect={() => setMatchMode("specific")}
            >
              определённое слово или слова
            </Radio>
            {matchMode === "specific" && (
              <div className="px-0.5 pb-1">
                <input
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                  placeholder="Введите одно или несколько слов"
                  className={fieldCls}
                />
                {keywords.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {keywords.map((kw) => (
                      <span key={kw} className="chip">
                        {kw}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="hint">Разделяйте слова запятыми</p>
                )}
              </div>
            )}
            <Radio
              checked={matchMode === "any"}
              onSelect={() => setMatchMode("any")}
            >
              любое слово
            </Radio>
          </div>

          <div className="divider !my-4" />

          <ToggleBlock
            on={dmTriggerEnabled}
            onToggle={() => setDmTriggerEnabled(!dmTriggerEnabled)}
            label={
              <>
                также отвечать, когда пишут в Direct{" "}
                {matchMode === "any" ? "что угодно" : "эти слова"}
              </>
            }
          >
            <p className="hint !mt-0">
              {matchMode === "any"
                ? "Каждое входящее сообщение в Direct получит ответ ниже — используйте осторожно."
                : "Сообщение в Direct с любым из этих слов получит тот же ответ — комментарий не нужен."}
            </p>
          </ToggleBlock>

          <ToggleBlock
            on={publicReplyEnabled}
            onToggle={() => setPublicReplyEnabled(!publicReplyEnabled)}
            label="отвечать на комментарии под публикацией"
          >
            {publicReplyMessages.map((msg, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={msg}
                  onChange={(e) =>
                    setPublicReplyMessages((prev) =>
                      prev.map((m, idx) => (idx === i ? e.target.value : m))
                    )
                  }
                  placeholder="Ответили в Direct! 📩"
                  maxLength={1000}
                  className={fieldCls}
                />
                {publicReplyMessages.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPublicReplyMessages((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                    className="btn btn-ghost btn-icon shrink-0 hover:!text-error"
                    aria-label="Удалить ответ"
                  >
                    <IconX size={16} />
                  </button>
                )}
              </div>
            ))}
            {publicReplyMessages.length < 10 && (
              <button
                type="button"
                onClick={() =>
                  setPublicReplyMessages((prev) => [...prev, ""])
                }
                className="btn btn-ghost btn-sm -ml-2 !text-accent-hi"
              >
                <IconPlus size={14} />
                Добавить ещё ответ
              </button>
            )}
            <p className="hint !mt-0">
              Каждый раз выбирается случайный вариант, чтобы ответы не выглядели
              одинаковыми.
            </p>
          </ToggleBlock>
        </Section>

        <Section step={4} title="Подписчик получит">
          <ToggleBlock
            on={openingDmEnabled}
            onToggle={() => setOpeningDmEnabled(!openingDmEnabled)}
            label="первое сообщение"
          >
            <textarea
              value={openingDmMessage}
              onChange={(e) => setOpeningDmMessage(e.target.value)}
              placeholder="Здравствуйте! Рады, что вы с нами 😊"
              rows={3}
              className={areaCls}
              maxLength={1000}
            />
            <input
              value={openingDmButtonLabel}
              onChange={(e) => setOpeningDmButtonLabel(e.target.value)}
              placeholder="Получить ссылку"
              className={fieldCls}
              maxLength={64}
            />
            <p className="hint !mt-0">Подпись кнопки под первым сообщением.</p>
          </ToggleBlock>
          <ToggleBlock
            on={requireFollow}
            onToggle={() => setRequireFollow(!requireFollow)}
            label="сначала проверку подписки"
          >
            <textarea
              value={followPromptMessage}
              onChange={(e) => setFollowPromptMessage(e.target.value)}
              placeholder="Небольшая просьба перед тем, как отправлю ссылку: подпишитесь на нас, чтобы не пропустить новинки. Нажмите кнопку, когда подпишетесь, — и я сразу всё пришлю"
              rows={3}
              className={areaCls}
              maxLength={1000}
            />
            <input
              value={followPromptButtonLabel}
              onChange={(e) => setFollowPromptButtonLabel(e.target.value)}
              placeholder="Я подписан(а)"
              className={fieldCls}
              maxLength={20}
            />
            <p className="hint !mt-0">
              Ссылка отправляется после нажатия кнопки, когда Instagram
              подтвердит подписку. Если проверить не удалось, ссылка всё равно
              уходит.
            </p>
          </ToggleBlock>
        </Section>

        <Section step={5} title="А затем получит">
          <div className="rounded-[10px] border border-border bg-surface p-3">
            <label className="label" htmlFor="campaign-dm">
              сообщение в Direct со ссылкой
            </label>
            <textarea
              id="campaign-dm"
              value={dmMessage}
              onChange={(e) => setDmMessage(e.target.value)}
              placeholder="Напишите сообщение"
              rows={3}
              className={areaCls}
              maxLength={1000}
            />
            <div className="mt-2 space-y-2">
              {linkOpen ? (
                <>
                  <input
                    value={trackedDestinationUrl}
                    onChange={(e) => setTrackedDestinationUrl(e.target.value)}
                    onBlur={ensureLinkToken}
                    placeholder="https://vash-sait.ru/predlozhenie"
                    className={fieldCls}
                  />
                  <input
                    value={linkButtonLabel}
                    onChange={(e) => setLinkButtonLabel(e.target.value)}
                    placeholder="Подпись кнопки (например: Открыть ссылку)"
                    maxLength={20}
                    className={fieldCls}
                  />
                  {secondLinkOpen ? (
                    <div className="space-y-2 border-t border-border-subtle pt-2">
                      <input
                        value={secondaryDestinationUrl}
                        onChange={(e) => setSecondaryDestinationUrl(e.target.value)}
                        placeholder="https://vash-sait.ru/vtoraya"
                        className={fieldCls}
                      />
                      <input
                        value={secondaryButtonLabel}
                        onChange={(e) => setSecondaryButtonLabel(e.target.value)}
                        placeholder="Подпись второй кнопки"
                        maxLength={20}
                        className={fieldCls}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSecondLinkOpen(true)}
                      className="btn btn-secondary btn-sm w-full"
                    >
                      <IconPlus size={14} />
                      Добавить вторую ссылку
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setLinkOpen(true)}
                  className="btn btn-secondary btn-sm w-full"
                >
                  <IconPlus size={14} />
                  Добавить ссылку
                </button>
              )}
            </div>
            <p className="hint">
              <code className="font-mono text-accent-hi">{"{link}"}</code> подставляет
              отслеживаемую ссылку,{" "}
              <code className="font-mono text-accent-hi">{"{username}"}</code> — имя
              подписчика.
            </p>
          </div>
          <ToggleBlock
            on={followUpEnabled}
            onToggle={() => setFollowUpEnabled(!followUpEnabled)}
            label="напоминание с благодарностью"
          >
            <textarea
              value={followUpMessage}
              onChange={(e) => setFollowUpMessage(e.target.value)}
              placeholder="Кстати, спасибо за подписку — очень ценим вашу поддержку 🙌"
              rows={3}
              className={areaCls}
              maxLength={1000}
            />
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-foreground">
              <span className="text-muted">Отправить через</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                value={followUpDelayMinutes}
                onChange={(e) =>
                  setFollowUpDelayMinutes(
                    Math.max(0, Math.min(1440, Math.floor(Number(e.target.value) || 0)))
                  )
                }
                className="input !h-9 w-24 !px-2.5 text-center tabular-nums"
              />
              <span className="text-muted">мин после ссылки</span>
            </div>
            <p className="hint !mt-0">
              {followUpDelayMinutes > 0
                ? `Уйдёт через ${followUpDelayMinutes} мин после перехода по ссылке.`
                : "Уйдёт сразу после перехода по ссылке."}
              {" {username}"} подставит имя. Максимум 24 часа — таково окно
              переписки Instagram.
            </p>
          </ToggleBlock>
        </Section>
      </div>

      {/* Right: preview */}
      <div className="min-w-0">
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto lg:rounded-[14px]">
          <div className="card">
            <div className="card-head !py-3.5">
              <div className="flex items-center gap-3">
                <span className="icon-tile !h-7 !w-7 !rounded-[8px]">
                  <IconInstagram size={14} />
                </span>
                <span className="card-title">Предпросмотр</span>
              </div>
              <span className="text-[12px] text-muted">Обновляется сразу</span>
            </div>
            <div className="card-body flex justify-center !px-4 !py-6">
              <CampaignPreview
                tab={previewTab}
                onTabChange={setPreviewTab}
                username={username}
                avatarUrl={avatarUrl}
                postThumb={postThumb}
                caption={postCaption}
                sampleComment={keywords[0] ?? ""}
                dmTriggerEnabled={dmTriggerEnabled}
                publicReplyEnabled={publicReplyEnabled}
                publicReplyMessage={publicReplyMessages.find((m) => m.trim()) ?? ""}
                openingDmEnabled={openingDmEnabled}
                openingDmMessage={openingDmMessage}
                openingDmButtonLabel={openingDmButtonLabel}
                revealMessage={dmMessage}
                hasLink={Boolean(trackedDestinationUrl.trim())}
                linkButtonLabel={linkButtonLabel || "Открыть ссылку"}
                linkUrl={trackedDestinationUrl.trim() || undefined}
                hasSecondLink={
                  secondLinkOpen && Boolean(secondaryDestinationUrl.trim())
                }
                secondLinkButtonLabel={secondaryButtonLabel || "Открыть ссылку"}
                requireFollow={requireFollow}
                followPromptMessage={followPromptMessage}
                followPromptButtonLabel={followPromptButtonLabel || "Я подписан(а)"}
                followUpEnabled={followUpEnabled}
                followUpMessage={followUpMessage}
                followUpDelayMinutes={followUpDelayMinutes}
              />
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
