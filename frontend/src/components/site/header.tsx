"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock, ExternalLink, LayoutDashboard, LogOut, Mail, Menu, Phone, Search, User as UserIcon } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { SearchDialog } from "@/components/site/search-dialog";
import { useAuth } from "@/hooks/use-auth";
import { cn, initials, isExternal, t as tr } from "@/lib/utils";
import type { Language, MenuItem } from "@/lib/types";

interface HeaderProps {
  menu: MenuItem[];
  languages: Language[];
  siteName: string;
  shortName: string;
  logo: string;
  phone?: string;
  email?: string;
  hours?: string;
  showTopBar?: boolean;
  transparent?: boolean;
}

export function SiteHeader({ menu, languages, siteName, shortName, logo, phone, email, hours, showTopBar = true, transparent = false }: HeaderProps) {
  const locale = useLocale();
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isEditor } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close the mobile menu after navigation (state adjusted during render, no effect needed)
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  const solid = scrolled || !transparent;
  const items = menu.filter((m) => m.is_active !== false);

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const NavLink = ({ item, mobile = false }: { item: MenuItem; mobile?: boolean }) => {
    const label = tr(item.title, locale);
    const external = item.type === "external" || isExternal(item.url);
    const cls = mobile
      ? cn("flex items-center justify-between rounded-lg px-3 py-3 text-base font-medium hover:bg-muted", isActive(item.url) && "bg-primary-soft text-primary")
      : cn(
          "relative whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-medium transition-colors hover:text-primary 2xl:px-3.5 2xl:text-sm",
          isActive(item.url) ? "text-primary after:absolute after:inset-x-2.5 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-accent 2xl:after:inset-x-3.5" : solid ? "text-foreground/80" : "text-white/85 hover:text-white",
        );
    if (external) {
      return (
        <a href={item.url} target={item.target || "_blank"} rel="noopener noreferrer" className={cls}>
          {label}
          <ExternalLink className={cn("ml-1 inline size-3.5 opacity-60", mobile && "ml-0")} />
        </a>
      );
    }
    return (
      <Link href={item.url || "/"} className={cls}>
        {label}
      </Link>
    );
  };

  return (
    <>
      {showTopBar && (phone || email || hours) && (
        <div className="hidden border-b border-border/60 bg-sidebar text-sidebar-foreground lg:block">
          <div className="container-x flex h-9 items-center justify-between text-xs">
            <div className="flex items-center gap-6">
              {hours && (
                <span className="inline-flex items-center gap-1.5 opacity-90">
                  <Clock className="size-3.5 text-accent" />
                  {hours}
                </span>
              )}
              {phone && (
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 opacity-90 hover:opacity-100">
                  <Phone className="size-3.5 text-accent" />
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 opacity-90 hover:opacity-100">
                  <Mail className="size-3.5 text-accent" />
                  {email}
                </a>
              )}
            </div>
            <div className="flex items-center gap-3 opacity-90">
              <LanguageSwitcher languages={languages} className="h-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" />
            </div>
          </div>
        </div>
      )}

      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-300",
          solid ? "border-b border-border/70 bg-background/85 shadow-sm backdrop-blur-md" : "border-b border-white/10 bg-gradient-to-b from-black/50 to-transparent",
        )}
      >
        <div className="container-x flex h-[var(--header-height)] items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={siteName}>
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full ring-1", solid ? "bg-primary-soft ring-primary/15" : "bg-white/10 ring-white/20")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo || "/logo.png"} alt="" className="size-8 object-contain" />
            </span>
            <span className="min-w-0">
              <span className={cn("block truncate font-display text-base font-semibold leading-tight md:text-lg", !solid && "text-white")}>{shortName}</span>
              <span className={cn("hidden max-w-[15rem] truncate text-[10px] uppercase tracking-[0.16em] sm:block xl:max-w-[11rem] 2xl:max-w-[15rem]", solid ? "text-muted-foreground" : "text-white/70")} title={siteName}>
                {siteName}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center xl:flex" aria-label="Main">
            {items.map((item) => (
              <NavLink key={item.id} item={item} />
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className={cn("rounded-full", !solid && "text-white hover:bg-white/10 hover:text-white")} aria-label={t("common.search")} onClick={() => setSearchOpen(true)}>
              <Search className="size-[1.1rem]" />
            </Button>
            <ThemeToggle className={cn(!solid && "text-white hover:bg-white/10 hover:text-white")} />
            {!showTopBar && <LanguageSwitcher languages={languages} compact className={cn(!solid && "text-white hover:bg-white/10 hover:text-white")} />}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 rounded-full ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("nav.account")}>
                    <Avatar className="size-9 border border-border">
                      <AvatarImage src={user.avatar || undefined} alt={user.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(user.name)}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/account")}>
                    <UserIcon className="size-4" /> {t("nav.account")}
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
                      router.refresh();
                    }}
                  >
                    <LogOut className="size-4" /> {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm" className={cn("ml-1 hidden rounded-full md:inline-flex", !solid && "bg-white text-foreground hover:bg-white/90")}>
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
            )}

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("rounded-full xl:hidden", !solid && "text-white hover:bg-white/10 hover:text-white")} aria-label={t("header.openMenu")}>
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] max-w-sm overflow-y-auto p-0">
                <SheetHeader className="border-b p-5 text-left">
                  <SheetTitle className="font-display">{shortName}</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 p-3" aria-label="Mobile">
                  {items.map((item) => (
                    <NavLink key={item.id} item={item} mobile />
                  ))}
                </nav>
                <div className="mt-auto space-y-3 border-t p-5">
                  <div className="flex items-center justify-between">
                    <LanguageSwitcher languages={languages} variant="outline" />
                    <ThemeToggle variant="outline" />
                  </div>
                  {user ? (
                    <Button asChild className="w-full rounded-full">
                      <Link href="/account">{t("nav.account")}</Link>
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild className="rounded-full">
                        <Link href="/login">{t("nav.login")}</Link>
                      </Button>
                      <Button asChild variant="outline" className="rounded-full">
                        <Link href="/register">{t("nav.register")}</Link>
                      </Button>
                    </div>
                  )}
                  {phone && (
                    <a href={`tel:${phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="size-4 text-accent" /> {phone}
                    </a>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
