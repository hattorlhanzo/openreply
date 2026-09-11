import { EMAIL_PROVIDER_ID, signIn } from "@/lib/auth";
import { BRAND, PRODUCT } from "@/lib/i18n/common";
import { IconSend } from "@/components/ui/icons";

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
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-cube.png" alt="" className="h-14 w-14" />
          <h1 className="mt-4 text-[22px] font-bold tracking-wide text-foreground">
            {BRAND}
          </h1>
          <p className="mt-1 text-[13px] text-muted">{PRODUCT}</p>
        </div>

        <div className="card">
          {checkEmail ? (
            <div className="card-body flex flex-col items-center py-9 text-center">
              <span className="icon-tile icon-tile-success !h-12 !w-12 !rounded-[12px]">
                <IconSend size={22} />
              </span>
              <h2 className="mt-4 text-[17px] font-bold text-foreground">
                Проверьте почту
              </h2>
              <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-muted">
                Мы отправили вам ссылку для входа. Откройте её на этом
                устройстве, чтобы продолжить.
              </p>
            </div>
          ) : (
            <form action={sendMagicLink} className="card-body space-y-5 sm:p-7">
              <div>
                <h2 className="text-[17px] font-bold text-foreground">Вход в кабинет</h2>
                <p className="mt-1 text-[13px] text-muted">
                  Укажите почту — пришлём ссылку для входа.
                </p>
              </div>
              <div>
                <label htmlFor="email" className="label">
                  Электронная почта
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.ru"
                  className="input"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-full">
                Получить ссылку для входа
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-[12px] text-muted">
          Вход по одноразовой ссылке на почту
        </p>
      </div>
    </div>
  );
}
