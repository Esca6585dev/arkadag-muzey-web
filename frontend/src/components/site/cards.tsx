import { ArrowUpRight, Calendar, Clock, Eye, Images, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SmartImage } from "@/components/shared/smart-image";
import { Badge } from "@/components/ui/badge";
import { cn, excerpt, formatDate, t as tr } from "@/lib/utils";
import type { Article, Event, Exhibit, Gallery, Hall } from "@/lib/types";

/* ---------------- Article ---------------- */

export function ArticleCard({ article, locale, variant = "default", className }: { article: Article; locale: string; variant?: "default" | "horizontal" | "featured"; className?: string }) {
  const title = tr(article.title, locale);
  const summary = tr(article.excerpt, locale) || excerpt(tr(article.body, locale), 140);
  const date = formatDate(article.published_at || article.created_at, locale);
  const cat = article.category ? tr(article.category.name, locale) : "";

  if (variant === "horizontal") {
    return (
      <Link href={`/news/${article.slug}`} className={cn("group flex gap-4 rounded-xl p-2 transition hover:bg-muted/60", className)}>
        <SmartImage src={article.cover_image} alt={title} fill wrapperClassName="relative size-24 shrink-0 overflow-hidden rounded-lg" className="object-cover transition duration-500 group-hover:scale-105" sizes="96px" />
        <div className="min-w-0 py-1">
          <p className="text-xs text-muted-foreground">{date}</p>
          <h3 className="mt-1 line-clamp-2 font-medium leading-snug group-hover:text-primary">{title}</h3>
        </div>
      </Link>
    );
  }

  if (variant === "featured") {
    return (
      <Link href={`/news/${article.slug}`} className={cn("group relative block overflow-hidden rounded-2xl bg-sidebar text-white", className)}>
        <div className="relative aspect-[16/10] md:aspect-auto md:h-full md:min-h-[420px]">
          <SmartImage src={article.cover_image} alt={title} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(max-width: 1024px) 100vw, 60vw" fallbackClassName="bg-sidebar-accent text-white/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          <div className="mb-3 flex items-center gap-3 text-xs text-white/80">
            {cat && <Badge className="bg-accent text-accent-foreground hover:bg-accent">{cat}</Badge>}
            <span>{date}</span>
          </div>
          <h3 className="heading-md text-balance text-white">{title}</h3>
          {summary && <p className="mt-3 line-clamp-2 max-w-xl text-sm text-white/80">{summary}</p>}
        </div>
      </Link>
    );
  }

  return (
    <article className={cn("group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card card-hover", className)}>
      <Link href={`/news/${article.slug}`} className="relative block aspect-[16/10] overflow-hidden">
        <SmartImage src={article.cover_image} alt={title} fill className="object-cover transition duration-700 group-hover:scale-105" />
        {cat && <Badge className="absolute left-3 top-3 bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-background">{cat}</Badge>}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3.5" /> {date}
          </span>
          {article.views > 0 && (
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" /> {article.views}
            </span>
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 font-display text-lg font-semibold leading-snug">
          <Link href={`/news/${article.slug}`} className="transition-colors hover:text-primary">
            {title}
          </Link>
        </h3>
        {summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{summary}</p>}
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary">
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}

/* ---------------- Hall ---------------- */

export function HallCard({ hall, locale, countLabel, className }: { hall: Hall; locale: string; countLabel?: string; className?: string }) {
  const name = tr(hall.name, locale);
  return (
    <Link href={`/halls/${hall.slug}`} className={cn("group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-sidebar text-white", className)}>
      <SmartImage src={hall.cover_image} alt={name} fill className="object-cover transition duration-700 group-hover:scale-110" fallbackClassName="bg-sidebar-accent text-white/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        {countLabel && <p className="mb-2 text-xs uppercase tracking-[0.18em] text-accent">{countLabel}</p>}
        <h3 className="font-display text-xl font-semibold leading-snug">{name}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-white/75">{tr(hall.summary, locale)}</p>
        <span className="mt-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-accent group-hover:text-accent-foreground">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

/* ---------------- Exhibit ---------------- */

export function ExhibitCard({ exhibit, locale, className }: { exhibit: Exhibit; locale: string; className?: string }) {
  const title = tr(exhibit.title, locale);
  const period = tr(exhibit.period, locale);
  return (
    <Link href={`/exhibits/${exhibit.slug}`} className={cn("group block", className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
        <SmartImage src={exhibit.image} alt={title} fill className="object-cover transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {exhibit.hall && (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur">
            {tr(exhibit.hall.name, locale)}
          </span>
        )}
      </div>
      <div className="mt-3 px-1">
        <h3 className="font-display text-lg font-semibold leading-snug transition-colors group-hover:text-primary">{title}</h3>
        {period && <p className="mt-0.5 text-sm text-muted-foreground">{period}</p>}
      </div>
    </Link>
  );
}

/* ---------------- Event ---------------- */

export function EventCard({ event, locale, className }: { event: Event; locale: string; className?: string }) {
  const title = tr(event.title, locale);
  const start = new Date(event.starts_at);
  const day = formatDate(start, locale, { day: "2-digit" });
  const month = formatDate(start, locale, { month: "short" });
  const time = formatDate(start, locale, { hour: "2-digit", minute: "2-digit" });
  const location = tr(event.location, locale);
  return (
    <Link href={`/events/${event.slug}`} className={cn("group flex gap-5 rounded-2xl border border-border/70 bg-card p-4 card-hover", className)}>
      <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft py-3 text-primary">
        <span className="font-display text-2xl font-bold leading-none">{day}</span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider">{month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug group-hover:text-primary">{title}</h3>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {time}
          </span>
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {location}
            </span>
          )}
        </div>
        {tr(event.summary, locale) && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{tr(event.summary, locale)}</p>}
      </div>
      {event.image && (
        <SmartImage src={event.image} alt="" fill wrapperClassName="relative hidden size-24 shrink-0 overflow-hidden rounded-xl sm:block" className="object-cover" sizes="96px" />
      )}
    </Link>
  );
}

/* ---------------- Gallery ---------------- */

export function GalleryCard({ gallery, locale, countLabel, className }: { gallery: Gallery; locale: string; countLabel?: string; className?: string }) {
  const title = tr(gallery.title, locale);
  return (
    <Link href={`/gallery/${gallery.slug}`} className={cn("group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-muted", className)}>
      <SmartImage src={gallery.cover_image || gallery.items?.[0]?.image} alt={title} fill className="object-cover transition duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white">
        <div>
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          {countLabel && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/75">
              <Images className="size-3.5" /> {countLabel}
            </p>
          )}
        </div>
        <span className="flex size-9 items-center justify-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-accent group-hover:text-accent-foreground">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}
