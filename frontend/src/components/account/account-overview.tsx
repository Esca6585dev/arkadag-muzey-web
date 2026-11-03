"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CalendarHeart, Heart, Mail, Newspaper, Landmark } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FavoriteCard } from "@/components/account/favorite-card";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatNumber, initials } from "@/lib/utils";
import type { Favorite } from "@/lib/types";

interface Dashboard {
  favorites: number;
  messages: number;
  member_since: string;
}

export function AccountOverview({ memberSinceFallback }: { memberSinceFallback: string | null }) {
  const t = useTranslations("account");
  const locale = useLocale();
  const { user } = useAuth();

  const dash = useQuery({ queryKey: ["user", "dashboard"], queryFn: () => api.get<Dashboard>("/user/dashboard") });
  const favs = useQuery({ queryKey: ["user", "favorites", "all"], queryFn: () => api.get<Favorite[]>("/user/favorites") });

  const since = dash.data?.member_since ?? memberSinceFallback;
  const recent = (favs.data ?? []).filter((f) => f.target).slice(0, 6);

  const stats = [
    { label: t("favoritesCount"), value: dash.data?.favorites, icon: Heart, href: "/account/favorites" },
    { label: t("messagesCount"), value: dash.data?.messages, icon: Mail, href: "/account/messages" },
  ] as const;

  const quick = [
    { href: "/exhibits", label: t("browseExhibits"), icon: Landmark },
    { href: "/news", label: t("browseNews"), icon: Newspaper },
    { href: "/events", label: t("viewEvents"), icon: CalendarDays },
    { href: "/contact", label: t("contactUs"), icon: Mail },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-ornament opacity-40" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar className="size-16 border-2 border-accent/50 sm:size-20">
            <AvatarImage src={user?.avatar || undefined} alt={user?.name} />
            <AvatarFallback className="bg-primary text-xl text-primary-foreground">{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="eyebrow">{t("title")}</p>
            <h1 className="heading-md mt-1 break-words">{t("greeting", { name: user?.name ?? "" })}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("overviewSubtitle")}</p>
            {since && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarHeart className="size-4 text-accent" />
                {t("memberSince")} {formatDate(since, locale)}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Statistics">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={href} href={href} className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-6" />
            </span>
            <span>
              <span className="block text-sm text-muted-foreground">{label}</span>
              {dash.isLoading ? <Skeleton className="mt-1 h-8 w-12" /> : <span className="font-display text-3xl font-semibold">{formatNumber(value ?? 0, locale)}</span>}
            </span>
            <ArrowRight className="ml-auto size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{t("recentFavorites")}</h2>
          {recent.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href="/account/favorites">
                {t("viewAllFavorites")} <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
        {favs.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-60 rounded-2xl" />
            ))}
          </div>
        ) : favs.isError ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("loadError")}</p>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
            <Heart className="size-8 text-muted-foreground" />
            <p className="font-medium">{t("noFavorites")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("noFavoritesText")}</p>
            <Button asChild className="rounded-full">
              <Link href="/exhibits">{t("browseExhibits")}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((f) => (
              <FavoriteCard key={f.id} favorite={f} locale={locale} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">{t("quickLinks")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quick.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex flex-col items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-sm font-medium card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Icon className="size-5 text-accent" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
