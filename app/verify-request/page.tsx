import Link from "next/link";
import { BRAND } from "@/lib/i18n/common";

export const metadata = {
  title: `Проверьте почту — ${BRAND}`,
  description: "Ссылка для входа отправлена на вашу электронную почту.",
};

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">{BRAND}</h1>
        </div>

        <div className="panel rounded p-8 text-center">
          <h2 className="text-lg font-semibold mb-2">Проверьте почту</h2>
          <p className="text-sm text-muted">
            Мы отправили вам ссылку для входа. Откройте её на этом устройстве,
            чтобы продолжить.
          </p>
          <p className="mt-6 text-sm">
            <Link href="/login" className="text-accent hover:underline">
              Вернуться ко входу
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
