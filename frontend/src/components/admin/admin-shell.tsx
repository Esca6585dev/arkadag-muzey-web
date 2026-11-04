"use client";
// Admin layout chrome: sidebar built from ADMIN_NAV (collapsible on desktop, drawer on mobile),
// sticky top bar with the current section, theme/language switches and the user menu.

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, LogOut, Menu, PanelLeftClose, PanelLeftOpen, User as UserIcon } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { cn, initials } from "@/lib/utils";
import type { Language } from "@/lib/types";
import { ADMIN_NAV, type AdminNavItem } from "./nav";

const COLLAPSE_KEY = "admin.sidebar.collapsed";
const COLLAPSE_EVENT = "admin-sidebar-change";

function subscribeCollapsed(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(COLLAPSE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(COLLAPSE_EVENT, cb);
  };
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function useCollapsed(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const set = (v: boolean) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      // storage unavailable (private mode) - state just won't persist
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };
  return [value, set];
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Some nav keys (media, menus) are namespaces in the messages; their label lives in `.title`. */
function useNavLabel() {
  const t = useTranslations("admin");
  return (key: string) => (typeof t.raw(key) === "object" ? t(`${key}.title`) : t(key));
}

interface ShellProps {
  children: ReactNode;
  languages: Language[];
  siteName: string;
  logo: string;
}

export function AdminShell({ children, languages, siteName, logo }: ShellProps) {
  const t = useTranslations();
  const label = useNavLabel();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

  const unread = useQuery({
    queryKey: ["admin", "messages", "unread-count"],
    queryFn: () => api.get<{ count: number }>("/admin/messages/unread-count"),
    refetchInterval: 60_000,
  });
  const unreadCount = unread.data?.count ?? 0;

  const groups = ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || (user && i.roles.includes(user.role))),
  })).filter((g) => g.items.length);

  const current = groups.flatMap((g) => g.items).filter((i) => isActive(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0];

  const renderNav = (compact: boolean, onNavigate?: () => void) => (
    <nav aria-label={t("admin.shell.navigation")} className="flex flex-col gap-5 px-3 py-4">
      {groups.map((g, gi) => (
        <div key={g.label || gi} className="flex flex-col gap-0.5">
          {g.label && !compact && (
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">{label(g.label)}</p>
          )}
          {g.label && compact && <div className="mx-3 mb-1 h-px bg-sidebar-border" />}
          {g.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              text={label(item.label)}
              active={isActive(pathname, item.href)}
              compact={compact}
              badge={item.badge === "messages" ? unreadCount : 0}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );

  const brand = (compact: boolean) => (
    <Link href="/admin" className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4" onClick={() => setMobileOpen(false)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/95 ring-1 ring-sidebar-primary/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo || "/logo.png"} alt="" className="size-6 object-contain" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-semibold leading-tight text-sidebar-foreground">{siteName}</span>
          <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-sidebar-primary">{t("admin.title")}</span>
        </span>
      )}
    </Link>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("common.skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        {brand(collapsed)}
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">{renderNav(collapsed)}</div>
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary"
            aria-label={collapsed ? t("admin.shell.expand") : t("admin.shell.collapse")}
          >
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
            {!collapsed && <span>{t("admin.shell.collapse")}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">{t("admin.shell.navigation")}</SheetTitle>
          {brand(false)}
          <div className="min-h-0 flex-1 overflow-y-auto">{renderNav(false, () => setMobileOpen(false))}</div>
        </SheetContent>
      </Sheet>

      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-md sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t("header.openMenu")}>
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{current ? label(current.label) : t("admin.title")}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon" className="rounded-full">
                <Link href="/" target="_blank" aria-label={t("admin.viewSite")}>
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("admin.viewSite")}</TooltipContent>
          </Tooltip>
          <ThemeToggle />
          <LanguageSwitcher languages={languages} compact />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("nav.account")}>
                  <Avatar className="size-9 border border-border">
                    <AvatarImage src={user.avatar || undefined} alt={user.name} />
                    <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary">{t(`admin.roles.${user.role}`)}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/account/profile")}>
                  <UserIcon className="size-4" /> {t("account.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/")}>
                  <ExternalLink className="size-4" /> {t("admin.viewSite")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    await logout();
                    router.push("/");
                    router.refresh();
                  }}
                >
                  <LogOut className="size-4" /> {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        <main id="admin-main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  text,
  active,
  compact,
  badge,
  onNavigate,
}: {
  item: AdminNavItem;
  text: string;
  active: boolean;
  compact: boolean;
  badge: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary",
        compact && "justify-center px-0",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-primary" : "")} />
      {!compact && <span className="truncate">{text}</span>}
      {badge > 0 &&
        (compact ? (
          <span className="absolute right-2 top-1.5 size-2 rounded-full bg-sidebar-primary" />
        ) : (
          <span className="ml-auto rounded-full bg-sidebar-primary px-2 py-0.5 text-[10px] font-bold text-sidebar-primary-foreground">{badge > 99 ? "99+" : badge}</span>
        ))}
    </Link>
  );
  if (!compact) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{text}</TooltipContent>
    </Tooltip>
  );
}
