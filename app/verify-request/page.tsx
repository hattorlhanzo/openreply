import Link from "next/link";
import { BRAND, PRODUCT } from "@/lib/i18n/common";
import { IconSend } from "@/components/ui/icons";

export const metadata = {
  title: `Проверьте почту — ${BRAND}`,
  description: "Ссылка для входа отправлена на вашу электронную почту.",
};

export default function VerifyRequestPage() {
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
          <div className="card-body flex flex-col items-center py-9 text-center">
            <span className="icon-tile icon-tile-success !h-12 !w-12 !rounded-[12px]">
              <IconSend size={22} />
            </span>
            <h2 className="mt-4 text-[17px] font-bold text-foreground">
              Проверьте почту
            </h2>
            <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-muted">
              Мы отправили вам ссылку для входа. Откройте её на этом устройстве,
              чтобы продолжить.
            </p>
            <Link href="/login" className="btn btn-ghost btn-sm mt-5">
              Вернуться ко входу
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] text-muted">
          Вход по одноразовой ссылке на почту
        </p>
      </div>
    </div>
  );
}
