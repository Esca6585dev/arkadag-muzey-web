"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Heart, LayoutDashboard, LogOut, Mail, ShieldCheck, User as UserIcon, UserCog } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useAuth } from "@/hooks/use-auth";
import { cn, initials } from "@/lib/utils";
import type { Language } from "@/lib/types";

const NAV = [
  { href: "/account", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/account/profile", key: "profile", icon: UserCog },
  { href: "/account/favorites", key: "favorites", icon: Heart },
  { href: "/account/messages", key: "messages", icon: Mail },
  { href: "/account/security", key: "security", icon: ShieldCheck },
] as const;

export function AccountShell({ children, languages, siteName, logo }: { children: ReactNode; languages: Language[]; siteName: string; logo: string }) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isEditor } = useAuth();

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="min-h-screen bg-muted/30">
      <a href="#account-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        {t("common.skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={siteName}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft ring-1 ring-primary/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo || "/logo.png"} alt="" className="size-7 object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-semibold leading-tight">{siteName}</span>
              <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{t("account.title")}</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
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
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/account/profile")}>
                    <UserIcon className="size-4" /> {t("account.profile")}
                  </DropdownMenuItem>
                  {isEditor && (
                    <DropdownMenuItem onClick={() => router.push("/admin")}>
                      <LayoutDashboard className="size-4" /> {t("nav.admin")}
                    </DropdownMenuItem>
                  )}
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
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label={t("account.nav")} className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:overflow-visible lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ul className="flex gap-2 lg:flex-col lg:gap-1 lg:rounded-2xl lg:border lg:border-border/70 lg:bg-card lg:p-2">
              {NAV.map(({ href, key, icon: Icon, ...rest }) => {
                const active = isActive(href, "exact" in rest ? rest.exact : false);
                return (
                  <li key={href} className="shrink-0">
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:rounded-xl lg:border-transparent lg:py-2.5",
                        active
                          ? "border-primary/30 bg-primary-soft text-primary lg:shadow-[inset_3px_0_0_0_var(--accent)]"
                          : "border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground lg:bg-transparent",
                      )}
                    >
                      <Icon className="size-4" />
                      {t(`account.${key}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <main id="account-main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
