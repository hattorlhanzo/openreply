"use client";

/**
 * Боковое меню
 *
 * Текстовая навигация с активным пунктом и блоком рабочего пространства.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND, NAV } from "@/lib/i18n/common";

const navItems = [
  { label: NAV.dashboard, href: "/dashboard" },
  { label: NAV.overview, href: "/overview" },
  { label: NAV.inbox, href: "/inbox" },
  { label: NAV.campaigns, href: "/campaigns" },
  { label: NAV.logs, href: "/logs" },
  { label: NAV.settings, href: "/settings" },
  { label: NAV.diagnostics, href: "/diagnostics" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  workspaceName,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 bg-surface border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Same reason as the top bar: the drawer is full height, so the
            wordmark would otherwise land under the status bar. */}
        <div
          className="px-6 py-5 border-b border-border"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-base font-semibold"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- статичный логотип, оптимизация не нужна */}
            <img
              src="/logo-cube.png"
              alt=""
              aria-hidden="true"
              className="h-7 w-auto shrink-0"
            />
            <span>{BRAND}</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`
                  block px-3 py-2.5 rounded text-sm
                  ${
                    isActive
                      ? "bg-surface-hover text-foreground font-medium"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <p className="text-sm text-foreground truncate">{workspaceName}</p>
        </div>
      </aside>
    </>
  );
}
