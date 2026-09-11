"use client";

/**
 * Верхняя панель: заголовок страницы, кнопка меню на телефоне,
 * подключённый Instagram-аккаунт.
 */

import { usePathname } from "next/navigation";
import { NAV, pluralRu } from "@/lib/i18n/common";
import { IconInstagram, IconMenu } from "@/components/ui/icons";

const pageTitles: Record<string, string> = {
  "/dashboard": NAV.dashboard,
  "/overview": NAV.overview,
  "/inbox": NAV.inbox,
  "/campaigns": NAV.campaigns,
  "/campaigns/new": "Новая кампания",
  "/campaigns/import": "Импорт кампаний",
  "/automations": NAV.campaigns,
  "/automations/new": "Новая кампания",
  "/logs": NAV.logs,
  "/settings": NAV.settings,
  "/diagnostics": NAV.diagnostics,
};

interface TopBarProps {
  onMenuClick: () => void;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  onMenuClick,
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const pathname = usePathname();
  const title =
    pageTitles[pathname] ??
    (pathname.startsWith("/campaigns/") ? "Кампания" : NAV.dashboard);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 border-b border-border-subtle bg-background"
      style={{
        height: "calc(3.75rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="btn btn-ghost btn-icon lg:hidden"
          aria-label="Меню"
        >
          <IconMenu size={20} />
        </button>
        <h1 className="truncate text-[15px] font-semibold text-foreground">{title}</h1>
      </div>

      {instagramAccountCount > 0 ? (
        <span className="badge badge-plain badge-muted h-8 gap-2 pl-2 pr-3 text-[13px]">
          <span className="icon-tile !h-5 !w-5 !rounded-md">
            <IconInstagram size={12} />
          </span>
          <span className="truncate">
            {instagramAccountCount > 1
              ? `${instagramAccountCount} ${pluralRu(instagramAccountCount, ["аккаунт", "аккаунта", "аккаунтов"])}`
              : `@${instagramUsername}`}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
        </span>
      ) : (
        <a href="/api/instagram/connect" className="btn btn-primary btn-sm">
          <IconInstagram size={16} />
          <span className="sm:hidden">Подключить</span>
          <span className="hidden sm:inline">Подключить Instagram</span>
        </a>
      )}
    </header>
  );
}
