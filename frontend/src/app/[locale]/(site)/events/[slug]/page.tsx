import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, Clock, MapPin, Ticket } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SmartImage } from "@/components/shared/smart-image";
import { Badge } from "@/components/ui/badge";
import { AddToCalendar } from "@/components/site/add-to-calendar";
import { FavoriteButton } from "@/components/site/favorite-button";
import { Crumbs } from "@/components/site/list-tools";
import { ShareButtons } from "@/components/site/share-buttons";
import { ApiRequestError, api } from "@/lib/api";
import { buildMetadata, siteUrl } from "@/lib/site";
import { formatDate, stripHtml, t as tr } from "@/lib/utils";
import type { Event } from "@/lib/types";

const isPast = (ms: number) => ms < Date.now();

type Props = { params: Promise<{ locale: string; slug: string }> };

async function load(slug: string, locale: string): Promise<Event | null> {
  try {
    return await api.get<Event>(`/public/events/${slug}`, { params: { locale }, revalidate: 60, tags: ["events", `event:${slug}`] });
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const e = await load(slug, locale);
  if (!e) return {};
  return buildMetadata(locale, { title: tr(e.title, locale), description: tr(e.summary, locale) || stripHtml(tr(e.description, locale)).slice(0, 160), image: e.image, path: `/events/${slug}` });
}

export default async function EventPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const e = await load(slug, locale);
  if (!e) notFound();
  const t = await getTranslations("events");
  const title = tr(e.title, locale);
  const location = tr(e.location, locale);
  const price = tr(e.price, locale);
  const summary = tr(e.summary, locale);
  const desc = tr(e.description, locale);
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : null;
  const sameDay = end ? start.toDateString() === end.toDateString() : true;
  const time = { hour: "2-digit", minute: "2-digit" } as const;
  const full = { day: "numeric", month: "long", year: "numeric" } as const;
  const dateLine = formatDate(start, locale, full) + (end && !sameDay ? ` – ${formatDate(end, locale, full)}` : "");
  const timeLine = formatDate(start, locale, time) + (end ? ` – ${formatDate(end, locale, time)}` : "");
  const ended = isPast((end ?? start).getTime());
  const url = siteUrl(`/${locale}/events/${e.slug}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: title,
    description: summary,
    startDate: e.starts_at,
    endDate: e.ends_at || undefined,
    location: location ? { "@type": "Place", name: location } : undefined,
    image: e.image ? [e.image.startsWith("http") ? e.image : siteUrl(e.image)] : undefined,
    url,
  };

  const rows = [
    { icon: Calendar, label: t("date"), value: dateLine },
    { icon: Clock, label: t("time"), value: timeLine },
    ...(location ? [{ icon: MapPin, label: t("where"), value: location }] : []),
    { icon: Ticket, label: t("price"), value: price || t("free") },
  ];

  return (
    <article className="container-x section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Crumbs items={[{ label: t("title"), href: "/events" }, { label: title }]} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          {ended && (
            <Badge variant="secondary" className="mb-3">
              {t("ended")}
            </Badge>
          )}
          <h1 className="heading-lg text-balance">{title}</h1>
          {summary && <p className="mt-4 text-lg text-muted-foreground">{summary}</p>}
          {e.image && (
            <SmartImage src={e.image} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 700px" wrapperClassName="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl bg-muted" className="object-cover" />
          )}
          {desc && <div className="prose-museum mt-8" dangerouslySetInnerHTML={{ __html: desc }} />}
        </div>
        <aside className="h-fit space-y-6 rounded-2xl border border-border/70 bg-card p-6 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
          <dl className="space-y-4">
            {rows.map((r) => (
              <div key={r.label} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <r.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</dt>
                  <dd className="font-medium">{r.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            {!ended && <AddToCalendar title={title} description={summary} location={location} startsAt={e.starts_at} endsAt={e.ends_at} url={url} label={t("addToCalendar")} />}
            <FavoriteButton type="event" id={e.id} variant="button" />
          </div>
          <ShareButtons url={url} title={title} />
        </aside>
      </div>
    </article>
  );
}
