"use client";

/**
 * Inbox
 *
 * Instagram DM conversations for the selected account, with live message
 * history and a reply composer. Messages are read from the Conversations API
 * (Meta only exposes the 20 most recent per thread) and refreshed by polling.
 * Sending is subject to Instagram's 24-hour messaging window — Meta's error is
 * surfaced verbatim when it applies.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { readCache, writeCache } from "@/lib/client-cache";
import { API_ERRORS, NAV, pluralRu } from "@/lib/i18n/common";
import {
  IconAlert,
  IconChevronLeft,
  IconMessage,
  IconSend,
} from "@/components/ui/icons";
import type { ConversationListItem } from "@/app/api/instagram/conversations/route";
import type { ThreadMessage } from "@/app/api/instagram/conversations/[id]/route";

const POLL_MS = 12_000;
// Cached list/threads are shown instantly on revisit, then revalidated in the
// background. The Instagram Conversations API is slow (often several seconds),
// so this is what makes the inbox feel fast after the first load.
const CACHE_MAX_AGE_MS = 60_000;
const convCacheKey = (accountId: string) => `inbox:convs:${accountId}`;
const msgCacheKey = (conversationId: string) => `inbox:msgs:${conversationId}`;

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function initialOf(username: string | null): string {
  const ch = (username ?? "").trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

export default function InboxPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  // Seed from the last-used account so a revisit can paint the cached
  // conversation list immediately, before the account list even loads.
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem("inbox:selectedAccount") ?? "";
  });

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Counter for optimistic message ids (a ref, not Date.now(): the React
  // compiler lint forbids impure calls inside component scope).
  const optimisticSeq = useRef(0);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Accounts for the selector; default to the first connected account. Uses the
  // lightweight accounts endpoint (one query) rather than the heavy dashboard
  // stats aggregation, so the inbox isn't gated on analytics before it can load.
  useEffect(() => {
    fetch("/api/instagram/accounts")
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return;
        const next: AccountOption[] = payload.data.instagramAccounts ?? [];
        setAccounts(next);
        setSelectedAccountId((prev) => {
          // Keep the seeded account only if it's still connected; otherwise
          // fall back to the default so a removed account can't wedge the inbox.
          const stillValid = prev && next.some((a) => a.id === prev);
          return stillValid
            ? prev
            : payload.data.selectedInstagramAccountId || next[0]?.id || "";
        });
      })
      .catch(() => setAccounts([]));
  }, []);

  // Remember the chosen account for the next visit.
  useEffect(() => {
    if (typeof window === "undefined" || !selectedAccountId) return;
    window.sessionStorage.setItem("inbox:selectedAccount", selectedAccountId);
  }, [selectedAccountId]);

  const loadConversations = useCallback(
    async (silent: boolean) => {
      if (!selectedAccountId) return;
      if (!silent) setConvLoading(true);
      try {
        const res = await fetch(
          `/api/instagram/conversations?instagramAccountId=${selectedAccountId}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data.success) {
          setConversations(data.data.conversations);
          writeCache(convCacheKey(selectedAccountId), data.data.conversations);
          setConvError(null);
        } else if (!silent) {
          setConvError(data.error ?? API_ERRORS.failedToLoadConversations);
        }
      } catch {
        if (!silent) setConvError(API_ERRORS.failedToLoadConversations);
      } finally {
        if (!silent) setConvLoading(false);
      }
    },
    [selectedAccountId]
  );

  // Load + poll conversations for the selected account. A cached list is shown
  // immediately (so revisits are instant) while a fresh copy loads silently.
  useEffect(() => {
    if (!selectedAccountId) return;
    // Reset the open thread when switching accounts. This is an intentional
    // synchronous reset on a dependency change, not derived render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(null);
    setMessages([]);
    const cached = readCache<ConversationListItem[]>(
      convCacheKey(selectedAccountId),
      CACHE_MAX_AGE_MS
    );
    if (cached.data) {
      setConversations(cached.data);
      setConvLoading(false);
    } else {
      setConversations([]);
      setConvLoading(true);
    }
    void loadConversations(Boolean(cached.data));
    const timer = window.setInterval(() => void loadConversations(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [selectedAccountId, loadConversations]);

  const loadMessages = useCallback(
    async (conversationId: string, silent: boolean) => {
      if (!selectedAccountId) return;
      if (!silent) setThreadLoading(true);
      try {
        const res = await fetch(
          `/api/instagram/conversations/${conversationId}?instagramAccountId=${selectedAccountId}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data.success) {
          setMessages(data.data.messages);
          writeCache(msgCacheKey(conversationId), data.data.messages);
        }
      } catch {
        // keep whatever is shown
      } finally {
        if (!silent) setThreadLoading(false);
      }
    },
    [selectedAccountId]
  );

  // Load + poll the open thread. Cached messages render instantly while a fresh
  // copy loads silently; opening a thread never shows a blank pane on revisit.
  useEffect(() => {
    if (!activeId) return;
    const cached = readCache<ThreadMessage[]>(
      msgCacheKey(activeId),
      CACHE_MAX_AGE_MS
    );
    if (cached.data) {
      // Paint cached messages instantly on thread change; intentional reset.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(cached.data);
      setThreadLoading(false);
    } else {
      setMessages([]);
      setThreadLoading(true);
    }
    void loadMessages(activeId, Boolean(cached.data));
    const timer = window.setInterval(
      () => void loadMessages(activeId, true),
      POLL_MS
    );
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages]);

  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function openConversation(id: string) {
    setActiveId(id);
    setSendError(null);
    // Paint any cached thread synchronously so the pane never flashes empty
    // or shows the previously open conversation while the fetch runs.
    const cached = readCache<ThreadMessage[]>(msgCacheKey(id), CACHE_MAX_AGE_MS);
    setMessages(cached.data ?? []);
    setThreadLoading(!cached.data);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !active?.contact.id || sending) return;
    setSending(true);
    setSendError(null);

    // Optimistically show the reply immediately, then confirm with the server.
    const optimistic: ThreadMessage = {
      id: `optimistic-${++optimisticSeq.current}`,
      text,
      fromMe: true,
      fromUsername: null,
      createdTime: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const res = await fetch("/api/instagram/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId: selectedAccountId,
          recipientId: active.contact.id,
          text,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadMessages(active.id, true);
        void loadConversations(true);
      } else {
        // Roll the optimistic message back and restore the draft so it's not lost.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setDraft(text);
        setSendError(data.error ?? API_ERRORS.failedToSendMessage);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setSendError(API_ERRORS.failedToSendMessage);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const convCount = conversations.length;
  const subtitle = convLoading
    ? "Загружаем диалоги…"
    : convError
      ? "Не удалось загрузить диалоги"
      : convCount === 0
        ? "Диалогов пока нет"
        : `${convCount} ${pluralRu(convCount, ["диалог", "диалога", "диалогов"])}`;

  return (
    <div>
      <div className="page-head">
        <div className="min-w-0">
          <h1 className="page-title">{NAV.inbox}</h1>
          <p className="page-sub tabular-nums">{subtitle}</p>
          {convError && !convLoading && (
            <p className="mt-1 max-w-2xl break-words text-[12px] leading-relaxed text-muted">
              {convError}
            </p>
          )}
        </div>
        {accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            includeAll={false}
          />
        )}
      </div>

      <div className="card grid h-[calc(100dvh-14.5rem)] min-h-[420px] grid-cols-1 overflow-hidden sm:grid-cols-[320px_1fr]">
        {/* Conversation list. On mobile it takes the full pane and is hidden
            once a thread is open (ManyChat-style); on sm+ it is always shown. */}
        <div
          className={`min-h-0 flex-col border-b border-border-subtle sm:flex sm:border-b-0 sm:border-r ${
            active ? "hidden" : "flex"
          }`}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-4">
            <span className="card-title">Диалоги</span>
            {!convLoading && !convError && convCount > 0 && (
              <span className="badge badge-plain badge-muted tabular-nums">{convCount}</span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {convLoading ? (
              <div className="space-y-1 p-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                    <span className="skeleton h-8 w-8 shrink-0 !rounded-full" />
                    <div className="flex-1 space-y-2">
                      <span className="skeleton block h-3 w-24" />
                      <span className="skeleton block h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : convError ? (
              <div className="empty h-full">
                <span className="empty-icon">
                  <IconAlert size={22} />
                </span>
                <p className="empty-title">Диалоги недоступны</p>
                <p className="text-[13px]">
                  Instagram не ответил на запрос. Проверьте подключение аккаунта в
                  настройках и попробуйте позже.
                </p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="empty h-full">
                <span className="empty-icon">
                  <IconMessage size={22} />
                </span>
                <p className="empty-title">Диалогов пока нет</p>
                <p className="text-[13px]">Сообщения подписчиков появятся здесь.</p>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={`relative flex w-full items-start gap-3 border-b border-border-subtle px-4 py-3 text-left transition-colors ${
                      isActive ? "bg-surface-hover" : "hover:bg-surface-hover"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-full bg-accent" />
                    )}
                    <span className="avatar mt-0.5">{initialOf(c.contact.username)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold text-foreground">
                          @{c.contact.username ?? "неизвестно"}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted tabular-nums">
                          {formatTime(c.updatedTime)}
                        </span>
                      </span>
                      {c.lastMessage && (
                        <span className="mt-0.5 block truncate text-[13px] text-muted">
                          {c.lastMessage.fromMe ? "Вы: " : ""}
                          {c.lastMessage.text || "(без текста)"}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread. On mobile it is only shown once a conversation is open and
            fills the pane; on sm+ it always sits beside the list. */}
        <div
          className={`min-h-0 flex-col bg-surface-2/40 ${active ? "flex" : "hidden sm:flex"}`}
        >
          {!active ? (
            <div className="empty flex-1">
              <span className="empty-icon">
                <IconMessage size={22} />
              </span>
              <p className="empty-title">
                {convError ? "Переписка недоступна" : "Выберите диалог"}
              </p>
              <p className="max-w-xs text-[13px]">
                {convError
                  ? "Когда подключение к Instagram восстановится, диалоги появятся слева."
                  : "Откройте диалог слева, чтобы прочитать сообщения и ответить."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => setActiveId(null)}
                  className="btn btn-ghost btn-icon btn-sm sm:hidden"
                  aria-label="Назад к диалогам"
                >
                  <IconChevronLeft size={18} />
                </button>
                <span className="avatar !h-7 !w-7 !text-[11px]">
                  {initialOf(active.contact.username)}
                </span>
                <span className="truncate text-[14px] font-semibold text-foreground">
                  @{active.contact.username ?? "неизвестно"}
                </span>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {threadLoading && messages.length === 0 ? (
                  <div className="space-y-3">
                    <span className="skeleton block h-10 w-2/5" />
                    <span className="skeleton ml-auto block h-10 w-1/3" />
                    <span className="skeleton block h-10 w-1/2" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="empty h-full">
                    <span className="empty-icon">
                      <IconMessage size={22} />
                    </span>
                    <p className="empty-title">Сообщений нет</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-[14px] px-3.5 py-2 text-[14px] leading-relaxed ${
                          m.fromMe
                            ? "rounded-br-[4px] bg-accent text-white"
                            : "rounded-bl-[4px] border border-border-subtle bg-surface text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p
                          className={`mt-1 text-right text-[10px] tabular-nums ${
                            m.fromMe ? "text-white/70" : "text-muted"
                          }`}
                        >
                          {formatTime(m.createdTime)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="shrink-0 border-t border-border-subtle bg-surface p-3">
                {sendError && (
                  <p className="mb-2 flex items-start gap-1.5 text-[12px] text-error">
                    <IconAlert size={14} className="mt-0.5 shrink-0" />
                    <span className="break-words">{sendError}</span>
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Напишите ответ…  (Enter — отправить, Shift+Enter — новая строка)"
                    className="textarea max-h-32 !min-h-[40px] flex-1 !py-2.5 resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim()}
                    className="btn btn-primary"
                  >
                    <IconSend size={16} />
                    {sending ? "Отправка…" : "Отправить"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
