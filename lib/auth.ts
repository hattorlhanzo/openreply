import NextAuth, { type NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser, getPrimaryWorkspace } from "@/lib/workspace";
import { isEmailAllowedToSignIn } from "@/lib/env";
import { BRAND } from "@/lib/i18n/common";

type AdapterPrismaClient = Parameters<typeof PrismaAdapter>[0];

const emailFrom = process.env.EMAIL_FROM ?? `${BRAND} <login@example.com>`;
// Setting EMAIL_SERVER switches magic links to your own SMTP server, for
// self-hosters who do not want a third-party mail service. Resend stays the
// default, so an existing deployment is unaffected.
const smtpServer = process.env.EMAIL_SERVER;

/** Тема письма со ссылкой для входа. */
function loginEmailSubject(): string {
  return `Вход в ${BRAND}`;
}

/** Текстовая версия письма (для клиентов без HTML). */
function loginEmailText({ url }: { url: string }): string {
  return `Вход в ${BRAND}\n\nЧтобы войти, откройте ссылку:\n${url}\n\nЕсли вы не запрашивали вход, просто не обращайте внимания на это письмо.\n`;
}

/**
 * HTML-версия письма. В домен вставлен невидимый пробел, чтобы почтовые
 * клиенты не превращали его в ссылку — иначе кажется, что кликать нужно по нему.
 */
function loginEmailHtml({ url, host }: { url: string; host: string }): string {
  const escapedHost = host.replace(/\./g, "&#8203;.");
  const color = {
    background: "#f9f9f9",
    text: "#444",
    mainBackground: "#fff",
    button: "#f97316",
    buttonText: "#fff",
  };
  return `
<body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center"
        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Вход в <strong>${BRAND}</strong>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0; font-size: 14px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        ${escapedHost}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.button}"><a href="${url}"
                target="_blank"
                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.button}; display: inline-block; font-weight: bold;">Войти</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Ссылка действует 24 часа. Если вы не запрашивали вход, просто не обращайте внимания на это письмо.
      </td>
    </tr>
  </table>
</body>
`;
}

/**
 * Provider id the login form has to sign in with. It differs per transport,
 * so it is derived here rather than hardcoded at the call site.
 */
export const EMAIL_PROVIDER_ID = smtpServer ? "nodemailer" : "resend";

export const authConfig = {
  adapter: PrismaAdapter(prisma as unknown as AdapterPrismaClient),
  providers: [
    smtpServer
      ? Nodemailer({
          server: smtpServer,
          from: emailFrom,
          // Транспорт тот же, что у провайдера по умолчанию, — свои только тема и текст.
          async sendVerificationRequest({ identifier, url, provider }) {
            const { host } = new URL(url);
            const { createTransport } = await import("nodemailer");
            const transport = createTransport(provider.server);
            const result = await transport.sendMail({
              to: identifier,
              from: provider.from,
              subject: loginEmailSubject(),
              text: loginEmailText({ url }),
              html: loginEmailHtml({ url, host }),
            });
            const failed = [
              ...(result.rejected ?? []),
              ...(result.pending ?? []),
            ].filter(Boolean);
            if (failed.length) {
              throw new Error(`Email (${failed.join(", ")}) could not be sent`);
            }
          },
        })
      : Resend({
          apiKey: process.env.RESEND_API_KEY ?? "missing-resend-api-key",
          from: emailFrom,
          async sendVerificationRequest({ identifier, url, provider }) {
            const { host } = new URL(url);
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${provider.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: provider.from,
                to: identifier,
                subject: loginEmailSubject(),
                html: loginEmailHtml({ url, host }),
                text: loginEmailText({ url }),
              }),
            });
            if (!res.ok) {
              throw new Error("Resend error: " + JSON.stringify(await res.json()));
            }
          },
        }),
  ],
  callbacks: {
    // Runs before the magic link is sent, so a blocked address never receives
    // one, and again when the link is verified.
    async signIn({ user }) {
      return isEmailAllowedToSignIn(user?.email);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureWorkspaceForUser(user.id, user.email);
      }
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify-request",
  },
  session: {
    strategy: "database",
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getCurrentWorkspaceId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const workspace = await getPrimaryWorkspace(userId);
  if (workspace) return workspace.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const createdWorkspace = await ensureWorkspaceForUser(userId, user?.email);
  return createdWorkspace.id;
}
