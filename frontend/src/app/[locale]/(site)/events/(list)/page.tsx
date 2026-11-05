import type { Metadata } from "next";
import { CalendarX } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeaderBlock } from "@/components/blocks/content-blocks";
import { EventCard } from "@/components/site/cards";
import { FilterPill, ListPagination } from "@/components/site/list-pagination";
import { Crumbs } from "@/components/site/list-tools";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { buildMetadata } from "@/lib/site";
import type { Event } from "@/lib/types";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "events" });
  return buildMetadata(locale, { title: t("title"), description: t("subtitle"), path: "/events" });
}

export default async function EventsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("events");
  const past = sp.tab === "past";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const res = await api.safeList<Event>("/public/events", {
    params: { locale, page: String(page), limit: "12", ...(past ? { past: "true" } : { upcoming: "true" }) },
    revalidate: 60,
    tags: ["events"],
  });
  // On the "upcoming" tab also show the most recent past events, so the archive is visible at once.
  const recentPast = past
    ? null
    : await api.safeList<Event>("/public/events", { params: { locale, past: "true", limit: "6" }, revalidate: 60, tags: ["events"] });

  return (
    <>
      <PageHeaderBlock s={{ title: t("title"), subtitle: t("subtitle") }} locale={locale} fallbackTitle={t("title")} />
      <div className="container-x section">
        <Crumbs items={[{ label: t("title") }]} />
        <div className="mt-6 flex gap-2">
          <FilterPill href="/events" active={!past}>
            {t("upcoming")}
          </FilterPill>
          <FilterPill href={{ pathname: "/events", query: { tab: "past" } }} active={past}>
            {t("past")}
          </FilterPill>
        </div>
        <div className="mt-8">
          {res.data.length === 0 ? (
            <EmptyState icon={<CalendarX />} title={t("noEvents")} />
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                {res.data.map((e) => (
                  <EventCard key={e.id} event={e} locale={locale} />
                ))}
              </div>
              <ListPagination pathname="/events" page={res.meta?.page ?? page} pages={res.meta?.pages ?? 1} query={{ tab: past ? "past" : undefined }} />
            </>
          )}
        </div>
        {recentPast && recentPast.data.length > 0 && (
          <section className="mt-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="heading-md">{t("past")}</h2>
              <FilterPill href={{ pathname: "/events", query: { tab: "past" } }} active={false}>
                {t("past")} · {recentPast.meta.total}
              </FilterPill>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {recentPast.data.map((e) => (
                <EventCard key={e.id} event={e} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
