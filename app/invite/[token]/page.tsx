import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import InvitationAcceptCard from "@/components/invitation-accept-card";
import { IconAlert, IconUsers } from "@/components/ui/icons";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { BRAND, PRODUCT, WORKSPACE_ROLE_LABEL } from "@/lib/i18n/common";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: `Приглашение в рабочее пространство — ${BRAND}`,
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const [session, invitation] = await Promise.all([
    auth(),
    prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { name: true } },
      },
    }),
  ]);

  if (!invitation || invitation.status !== "PENDING") {
    notFound();
  }

  const expired = invitation.expiresAt <= new Date();
  const roleLabel =
    WORKSPACE_ROLE_LABEL[invitation.role] ?? invitation.role.toLowerCase();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">
          <Link
            href="/"
            className="mb-7 flex flex-col items-center text-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-cube.png" alt="" className="h-14 w-14" />
            <span className="mt-4 block text-[22px] font-bold tracking-wide text-foreground">
              {BRAND}
            </span>
            <span className="mt-1 block text-[13px] text-muted">{PRODUCT}</span>
          </Link>

          <section className="card">
            <div className="card-body sm:p-7">
              <div className="flex items-start gap-4">
                <span className="icon-tile !h-11 !w-11 !rounded-[12px]">
                  <IconUsers size={20} />
                </span>
                <div className="min-w-0">
                  <p className="section-label">Приглашение в рабочее пространство</p>
                  <h1 className="mt-1.5 text-[20px] font-bold leading-tight tracking-tight text-foreground">
                    Присоединиться к «{invitation.workspace.name}»
                  </h1>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    Вас пригласили с ролью «{roleLabel}» на адрес{" "}
                    <span className="font-medium text-foreground">{invitation.email}</span>.
                  </p>
                </div>
              </div>
              <div className="divider my-6" />
              {expired ? (
                <div className="empty !py-4">
                  <span className="empty-icon icon-tile-error">
                    <IconAlert size={20} />
                  </span>
                  <p className="empty-title">Срок приглашения истёк</p>
                  <p className="text-[13px]">
                    Попросите владельца рабочего пространства отправить его
                    заново.
                  </p>
                </div>
              ) : (
                <InvitationAcceptCard
                  token={token}
                  isSignedIn={Boolean(session?.user?.id)}
                  invitedEmail={invitation.email}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
