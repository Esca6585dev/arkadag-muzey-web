"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/shared/smart-image";
import { t as tr } from "@/lib/utils";
import type { Article, Event, Exhibit, Favorite, Hall } from "@/lib/types";

const BASE: Record<Favorite["target_type"], string> = { article: "/news", exhibit: "/exhibits", hall: "/halls", event: "/events" };

export function favoriteInfo(f: Favorite, locale: string) {
  const target = f.target as (Partial<Article & Exhibit & Hall & Event> & { slug?: string }) | undefined;
  if (!target) return null;
  const title = tr((f.target_type === "hall" ? target.name : target.title) as Record<string, string> | undefined, locale);
  const image = f.target_type === "article" || f.target_type === "hall" ? target.cover_image : target.image;
  return { title, image, href: `${BASE[f.target_type]}/${target.slug ?? ""}` };
}

export function FavoriteCard({ favorite, locale, onRemove, removing }: { favorite: Favorite; locale: string; onRemove?: () => void; removing?: boolean }) {
  const t = useTranslations("account");
  const info = favoriteInfo(favorite, locale);
  if (!info) return null;
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card card-hover">
      <Link href={info.href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <SmartImage src={info.image} alt="" fill sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
        <div className="space-y-2 p-4">
          <Badge variant="outline" className="border-accent/40 text-accent">
            {t(`types.${favorite.target_type}`)}
          </Badge>
          <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug group-hover:text-primary">{info.title}</h3>
        </div>
      </Link>
      {onRemove && (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={removing}
          onClick={onRemove}
          aria-label={t("removeFavorite")}
          title={t("removeFavorite")}
          className="absolute right-3 top-3 size-9 rounded-full bg-background/90 text-destructive shadow-sm backdrop-blur hover:bg-destructive hover:text-white"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </article>
  );
}
