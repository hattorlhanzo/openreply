"use client";

/**
 * Верхняя панель
 *
 * Заголовок страницы, кнопка меню на мобильных и статус подключения.
 */

import { usePathname } from "next/navigation";
import { NAV, pluralRu } from "@/lib/i18n/common";

const pageTitles: Record<string, string> = {
  "/dashboard": NAV.dashboard,
  "/overview": NAV.overview,
  "/inbox": NAV.inbox,
  "/campaigns": NAV.campaigns,
  "/campaigns/new": "Новая кампания",
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
  const title = pageTitles[pathname] ?? NAV.dashboard;

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 border-b border-border bg-background"
      // Installed to the home screen the app starts at the very top of the
      // display, so without this the title sits under the clock and battery.
      // The inset is 0 in a browser tab and on desktop.
      style={{
        height: "calc(4rem + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden shrink-0 px-2.5 py-1.5 rounded border border-border text-sm text-muted hover:text-foreground"
          aria-label="Открыть меню"
        >
          Меню
        </button>
        <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
      </div>

      {instagramAccountCount > 0 ? (
        <p className="shrink-0 truncate text-sm text-muted">
          {instagramAccountCount > 1
            ? `${instagramAccountCount} ${pluralRu(instagramAccountCount, ["аккаунт", "аккаунта", "аккаунтов"])}`
            : `@${instagramUsername}`}
        </p>
      ) : (
        <a
          href="/api/instagram/connect"
          className="shrink-0 whitespace-nowrap text-sm font-medium px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover"
        >
          {/* Full label needs more room than a 360px header has to spare. */}
          <span className="sm:hidden">Подключить</span>
          <span className="hidden sm:inline">Подключить Instagram</span>
        </a>
      )}
    </header>
  );
}
