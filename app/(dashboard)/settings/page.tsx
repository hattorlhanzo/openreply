"use client";

import { Suspense, useEffect, useState } from "react";
import type { AccountOption } from "@/components/account-select";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import { NAV, WORKSPACE_ROLE_LABEL, pluralRu } from "@/lib/i18n/common";
import {
  IconActivity,
  IconAlert,
  IconInstagram,
  IconPlus,
  IconUsers,
} from "@/components/ui/icons";

interface SettingsData {
  workspace: {
    name: string;
    dmsSentThisPeriod: number;
  };
  instagramAccount: {
    id: string;
    username: string;
    instagramId: string;
    tokenExpiresAt: string | null;
    webhookSubscribed: boolean;
  } | null;
  instagramAccounts: Array<
    AccountOption & {
      tokenExpiresAt: string | null;
      webhookSubscribed: boolean;
    }
  >;
}

interface WorkspaceMembersData {
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  members: Array<{
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    createdAt: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
    };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    inviteUrl: string;
    expiresAt: string;
  }>;
}

function initialOf(value: string): string {
  const ch = value.replace(/[«»"'@]/g, "").trim().charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

function SectionHead({
  icon,
  tone,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  tone?: "accent" | "success" | "warning" | "error" | "muted";
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const toneClass = tone && tone !== "accent" ? `icon-tile-${tone}` : "";
  return (
    <div className="card-head">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`icon-tile ${toneClass}`}>{icon}</span>
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [membersData, setMembersData] = useState<WorkspaceMembersData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((res) => res.json()),
      fetch("/api/workspace/members").then((res) => res.json()),
    ])
      .then(([statsPayload, membersPayload]) => {
        if (statsPayload.success) setData(statsPayload.data);
        if (membersPayload.success) setMembersData(membersPayload.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function refreshMembers() {
    const res = await fetch("/api/workspace/members");
    const payload = await res.json();
    if (payload.success) setMembersData(payload.data);
  }

  async function disconnectInstagram(instagramAccountId: string) {
    if (
      !confirm(
        "Отключить Instagram-аккаунт? Кампании этого аккаунта перестанут работать: сообщения на комментарии отправляться не будут."
      )
    ) {
      return;
    }

    setBusy(`disconnect:${instagramAccountId}`);
    await fetch("/api/instagram/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramAccountId }),
    });
    window.location.reload();
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setMemberError(null);
    setBusy("invite");
    const res = await fetch("/api/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const payload = await res.json();
    if (payload.success) {
      setMembersData(payload.data);
      setInviteEmail("");
    } else {
      setMemberError(payload.error ?? "Не удалось отправить приглашение");
    }
    setBusy(null);
  }

  async function removeInvitation(invitationId: string) {
    setBusy(`invite:${invitationId}`);
    await fetch("/api/workspace/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    await refreshMembers();
    setBusy(null);
  }

  function copyInvite(invitation: { id: string; inviteUrl: string }) {
    void navigator.clipboard?.writeText(invitation.inviteUrl);
    setCopiedId(invitation.id);
    window.setTimeout(() => setCopiedId((cur) => (cur === invitation.id ? null : cur)), 1500);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="page-head">
          <div>
            <h1 className="page-title">{NAV.settings}</h1>
            <p className="page-sub">Загрузка…</p>
          </div>
        </div>
        <div className="space-y-5">
          <div className="skeleton h-44 !rounded-[14px]" />
          <div className="skeleton h-64 !rounded-[14px]" />
          <div className="skeleton h-24 !rounded-[14px]" />
        </div>
      </div>
    );
  }

  const accounts = data?.instagramAccounts ?? [];
  const canManageMembers =
    membersData?.currentUserRole === "OWNER" ||
    membersData?.currentUserRole === "ADMIN";
  const memberCount = membersData?.members.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="page-head">
        <div>
          <h1 className="page-title">{NAV.settings}</h1>
          <p className="page-sub">
            Подключённые аккаунты, участники рабочего пространства и использование.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Surfaces the ?instagram= code the OAuth routes redirect back with.
            Needs a Suspense boundary: useSearchParams in a prerendered client
            page fails the production build without one. */}
        <Suspense fallback={null}>
          <InstagramConnectNotice />
        </Suspense>

        {/* ---------- Instagram-аккаунты ---------- */}
        <section className="card">
          <SectionHead
            icon={<IconInstagram size={18} />}
            title="Instagram-аккаунты"
            description="От подключения зависят вебхуки комментариев и ответы в личные сообщения."
            action={
              <span
                className={`badge ${accounts.length > 0 ? "badge-success" : "badge-warning"}`}
              >
                {accounts.length > 0
                  ? `Подключено: ${accounts.length} ${pluralRu(accounts.length, ["профиль", "профиля", "профилей"])}`
                  : "Не подключено"}
              </span>
            }
          />
          <div className="card-body">
            {accounts.length === 0 ? (
              <div className="empty !py-6">
                <span className="empty-icon">
                  <IconInstagram size={22} />
                </span>
                <p className="empty-title">Аккаунт не подключён</p>
                <p className="max-w-sm text-[13px]">
                  Подключите профессиональный Instagram-аккаунт, чтобы запускать кампании.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle rounded-[10px] border border-border-subtle">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="icon-tile !h-9 !w-9">
                        <IconInstagram size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-foreground">
                          @{account.username}
                        </p>
                        <p className="truncate text-[12px] text-muted tabular-nums">
                          ID {account.instagramId}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge badge-plain ${
                          account.tokenExpiresAt ? "badge-muted" : "badge-warning"
                        } tabular-nums`}
                      >
                        {account.tokenExpiresAt
                          ? `Токен до ${new Date(account.tokenExpiresAt).toLocaleDateString("ru-RU")}`
                          : "Срок токена неизвестен"}
                      </span>
                      <span
                        className={`badge ${
                          account.webhookSubscribed ? "badge-success" : "badge-warning"
                        }`}
                      >
                        {account.webhookSubscribed ? "Вебхук подключён" : "Вебхук ожидает"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <a
                href="/api/instagram/connect"
                className={`btn ${accounts.length > 0 ? "btn-secondary" : "btn-primary"}`}
              >
                <IconPlus size={16} />
                {accounts.length > 0 ? "Подключить ещё аккаунт" : "Подключить Instagram"}
              </a>
            </div>
          </div>
        </section>

        {/* ---------- Рабочее пространство ---------- */}
        <section className="card">
          <SectionHead
            icon={<IconUsers size={18} />}
            title="Рабочее пространство"
            description={data?.workspace.name}
            action={
              <span className="badge badge-plain badge-muted tabular-nums">
                {memberCount}{" "}
                {pluralRu(memberCount, ["участник", "участника", "участников"])}
              </span>
            }
          />
          <div className="card-body space-y-6">
            <div>
              <p className="section-label mb-3">Участники</p>
              <div className="divide-y divide-border-subtle rounded-[10px] border border-border-subtle">
                {membersData?.members.map((member) => {
                  const display = member.user.name ?? member.user.email ?? "Без имени";
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="avatar">{initialOf(display)}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-foreground">
                            {display}
                          </p>
                          {member.user.email && (
                            <p className="truncate text-[12px] text-muted">{member.user.email}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`badge badge-plain ${
                          member.role === "OWNER" ? "badge-accent" : "badge-muted"
                        }`}
                      >
                        {WORKSPACE_ROLE_LABEL[member.role] ?? member.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {membersData?.invitations.length ? (
              <div>
                <p className="section-label mb-3">Приглашения</p>
                <div className="divide-y divide-border-subtle rounded-[10px] border border-border-subtle">
                  {membersData.invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="avatar !bg-surface-2 !text-muted">
                          {initialOf(invitation.email)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-foreground">
                            {invitation.email}
                          </p>
                          <p className="truncate text-[12px] text-muted">
                            {WORKSPACE_ROLE_LABEL[invitation.role] ?? invitation.role} · до{" "}
                            {new Date(invitation.expiresAt).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => copyInvite(invitation)}
                          className="btn btn-ghost btn-sm"
                        >
                          {copiedId === invitation.id ? "Скопировано" : "Копировать"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeInvitation(invitation.id)}
                          disabled={busy === `invite:${invitation.id}`}
                          className="btn btn-ghost btn-sm !text-error"
                        >
                          Отозвать
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {canManageMembers && (
              <div>
                <p className="section-label mb-3">Пригласить участника</p>
                <form
                  onSubmit={inviteMember}
                  className="grid gap-2 sm:grid-cols-[1fr_160px_auto]"
                >
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="email сотрудника"
                    className="input"
                    aria-label="Email сотрудника"
                    required
                  />
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as "ADMIN" | "MEMBER")
                    }
                    className="select"
                    aria-label="Роль"
                  >
                    <option value="MEMBER">{WORKSPACE_ROLE_LABEL.MEMBER}</option>
                    <option value="ADMIN">{WORKSPACE_ROLE_LABEL.ADMIN}</option>
                  </select>
                  <button
                    type="submit"
                    disabled={busy === "invite"}
                    className="btn btn-primary !h-10"
                  >
                    {busy === "invite" ? "Отправка…" : "Пригласить"}
                  </button>
                  {memberError && (
                    <p className="flex items-center gap-1.5 text-[13px] text-error sm:col-span-3">
                      <IconAlert size={14} />
                      {memberError}
                    </p>
                  )}
                </form>
                <p className="hint">
                  Приглашённый получит ссылку, по которой войдёт в это рабочее пространство.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ---------- Использование ---------- */}
        <section className="card">
          <SectionHead
            icon={<IconActivity size={18} />}
            tone="success"
            title="Использование"
            description="Статистика за текущий месяц."
          />
          <div className="card-body flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-medium text-foreground">
                Сообщений отправлено за месяц
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                Ограничений тарифа нет.
              </p>
            </div>
            <span className="text-[26px] font-bold tracking-tight text-foreground tabular-nums">
              {data?.workspace.dmsSentThisPeriod ?? 0}
            </span>
          </div>
        </section>

        {/* ---------- Отключить Instagram ---------- */}
        {accounts.length > 0 && (
          <section className="card !border-error/30">
            <SectionHead
              icon={<IconAlert size={18} />}
              tone="error"
              title="Отключить Instagram"
              description="Кампании аккаунта остановятся: комментарии не будут обрабатываться, сообщения — отправляться. Подключить заново можно в любой момент."
            />
            <div className="card-body">
              <div className="divide-y divide-border-subtle rounded-[10px] border border-border-subtle">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="icon-tile icon-tile-muted !h-8 !w-8 !rounded-[9px]">
                        <IconInstagram size={16} />
                      </span>
                      <p className="truncate text-[14px] font-medium text-foreground">
                        @{account.username}
                      </p>
                    </div>
                    <button
                      onClick={() => disconnectInstagram(account.id)}
                      disabled={busy === `disconnect:${account.id}`}
                      className="btn btn-danger btn-sm"
                    >
                      {busy === `disconnect:${account.id}` ? "Отключение…" : "Отключить"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
