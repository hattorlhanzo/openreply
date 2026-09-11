import { EMAIL_PROVIDER_ID, signIn } from "@/lib/auth";
import { BRAND, PRODUCT } from "@/lib/i18n/common";

export const metadata = {
  title: `Вход — ${BRAND}`,
  description: "Войдите, чтобы управлять кампаниями «комментарий → сообщение в Direct» в Instagram.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkEmail?: string;
    callbackUrl?: string;
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params.checkEmail === "1";
  const callbackUrl = params.callbackUrl ?? "/dashboard";

  async function sendMagicLink(formData: FormData) {
    "use server";
    await signIn(EMAIL_PROVIDER_ID, {
      email: String(formData.get("email") ?? ""),
      redirectTo: callbackUrl,
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">{BRAND}</h1>
          <p className="text-muted text-sm leading-relaxed mt-2">{PRODUCT}</p>
        </div>

        <div className="panel rounded p-8 shadow-black/40">
          {checkEmail ? (
            <div className="text-center py-4">
              <h2 className="text-lg font-semibold mb-2">Проверьте почту</h2>
              <p className="text-sm text-muted">
                Мы отправили вам ссылку для входа. Откройте её на этом
                устройстве, чтобы продолжить.
              </p>
            </div>
          ) : (
            <form action={sendMagicLink} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground"
                >
                  Электронная почта
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.ru"
                  className="w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-indigo-500/25 transition-all hover:shadow-indigo-500/30"
              >
                Получить ссылку для входа
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
