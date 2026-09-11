import Link from "next/link";
import { BRAND, PRODUCT } from "@/lib/i18n/common";

interface LegalShellProps {
  title: string;
  description: string;
  updatedAt: string;
  children: React.ReactNode;
}

export default function LegalShell({
  title,
  description,
  updatedAt,
  children,
}: LegalShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-cube.png" alt="" className="h-8 w-8" />
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-wide text-foreground">
                {BRAND}
              </span>
              <span className="block text-[11px] text-muted">{PRODUCT}</span>
            </span>
          </Link>
          <Link href="/login" className="btn btn-secondary btn-sm">
            Войти
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <p className="section-label">Обновлено {updatedAt}</p>
        <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-muted-2">{description}</p>
        <div className="card mt-8">
          {/* Страницы-документы красят заголовки text-white под старую тёмную тему;
              в светлой они пропадали — перекрываем токеном из оболочки. */}
          <div className="card-body space-y-8 text-[14px] leading-7 text-foreground sm:p-8 [&_h2]:!text-foreground [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:tracking-tight">
            {children}
          </div>
        </div>
      </article>
    </main>
  );
}
