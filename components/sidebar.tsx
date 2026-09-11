"use client";

/**
 * Боковое меню: логотип, разделы с иконками, карточка рабочего пространства.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND, NAV, PRODUCT } from "@/lib/i18n/common";
import {
  IconActivity,
  IconGrid,
  IconInbox,
  IconList,
  IconSliders,
  IconUser,
  IconZap,
} from "@/components/ui/icons";

const navItems = [
  { label: NAV.dashboard, href: "/dashboard", Icon: IconGrid },
  { label: NAV.campaigns, href: "/campaigns", Icon: IconZap },
  { label: NAV.logs, href: "/logs", Icon: IconList },
  { label: NAV.inbox, href: "/inbox", Icon: IconInbox },
  { label: NAV.overview, href: "/overview", Icon: IconUser },
  { label: NAV.settings, href: "/settings", Icon: IconSliders },
  { label: NAV.diagnostics, href: "/diagnostics", Icon: IconActivity },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export default function Sidebar({ isOpen, onClose, workspaceName }: SidebarProps) {
  const pathname = usePathname();
  const initial = workspaceName.replace(/[«»"']/g, "").trim().charAt(0).toUpperCase() || "С";

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "var(--backdrop)" }}
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 flex flex-col
          bg-surface border-r border-border-subtle
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div
          className="px-5 py-4"
          style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <Link href="/dashboard" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-cube.png" alt="" className="h-8 w-8" />
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-wide text-foreground">
                {BRAND}
              </span>
              <span className="block text-[11px] text-muted">{PRODUCT}</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, href, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`
                  relative flex items-center gap-3 px-3 h-10 rounded-[10px] text-[14px]
                  transition-colors
                  ${
                    isActive
                      ? "bg-surface-hover text-foreground font-semibold"
                      : "text-muted-2 hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                {isActive && (
                  <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-accent" />
                )}
                <Icon
                  size={18}
                  className={isActive ? "text-accent-hi" : "text-muted"}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-3 pt-2">
          <div className="flex items-center gap-3 rounded-[12px] border border-border-subtle bg-surface-2 px-3 py-2.5">
            <span className="avatar">{initial}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-foreground">
                {workspaceName}
              </span>
              <span className="block text-[11px] text-muted">Рабочее пространство</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
