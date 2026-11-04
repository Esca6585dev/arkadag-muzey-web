import type { Metadata } from "next";
import { Calendar, FileText, Landmark, Newspaper, Search, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Crumbs, ListSearch } from "@/components/site/list-tools";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { buildMetadata } from "@/lib/site";
import { excerpt, formatDate, t as tr } from "@/lib/utils";
import type { SearchResult } from "@/lib/types";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { ...(await buildMetadata(locale, { title: t("title"), path: "/search" })), robots: { index: false } };
}

const pageHref = (s: string) => (s === "home" ? "/" : s === "about" || s === "contact" || s === "visit" ? `/${s}` : `/p/${s}`);

type Row = { id: number; href: string; title: string; sub?: string };

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("search");
  const q = (sp.q ?? "").trim();
  const data = q.length >= 2 ? await api.safeGet<SearchResult>("/public/search", { params: { q, locale }, revalidate: 30 }) : null;

  const groups: { key: "articles" | "exhibits" | "halls" | "events" | "pages"; icon: typeof Search; rows: Row[] }[] = data
    ? [
        {
          key: "articles",
          icon: Newspaper,
          rows: (data.articles ?? []).map((a) => {
            const ex = tr(a.excerpt, locale);
            return { id: a.id, href: `/news/${a.slug}`, title: tr(a.title, locale), sub: formatDate(a.published_at || a.created_at, locale) + (ex ? " · " + excerpt(ex, 120) : "") };
          }),
        },
        { key: "exhibits", icon: Sparkles, rows: (data.exhibits ?? []).map((x) => ({ id: x.id, href: `/exhibits/${x.slug}`, title: tr(x.title, locale), sub: tr(x.period, locale) })) },
        { key: "halls", icon: Landmark, rows: (data.halls ?? []).map((h) => ({ id: h.id, href: `/halls/${h.slug}`, title: tr(h.name, locale), sub: excerpt(tr(h.summary, locale), 120) })) },
        { key: "events", icon: Calendar, rows: (data.events ?? []).map((e) => ({ id: e.id, href: `/events/${e.slug}`, title: tr(e.title, locale), sub: formatDate(e.starts_at, locale) })) },
        { key: "pages", icon: FileText, rows: (data.pages ?? []).map((p) => ({ id: p.id, href: pageHref(p.slug), title: tr(p.title, locale) })) },
      ]
    : [];
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="container-x section">
      <Crumbs items={[{ label: t("title") }]} />
      <h1 className="heading-lg mt-6">{t("title")}</h1>
      <ListSearch q={q} placeholder={t("placeholder")} className="relative mt-6 w-full max-w-xl" />

      <div className="mt-10">
        {q.length < 2 ? (
          <EmptyState icon={<Search />} title={q ? t("minChars") : t("hint")} />
        ) : total === 0 ? (
          <EmptyState icon={<Search />} title={t("results", { count: 0, query: q })} description={t("empty")} />
        ) : (
          <>
            <p className="mb-8 text-muted-foreground">{t("results", { count: total, query: q })}</p>
            <div className="space-y-10">
              {groups
                .filter((g) => g.rows.length > 0)
                .map((g) => (
                  <section key={g.key}>
                    <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
                      <g.icon className="size-5 text-primary" />
                      {t(g.key)}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{g.rows.length}</span>
                    </h2>
                    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card">
                      {g.rows.map((r) => (
                        <li key={r.id}>
                          <Link href={r.href as never} className="block px-5 py-4 transition hover:bg-muted/60">
                            <span className="font-medium">{r.title}</span>
                            {r.sub && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{r.sub}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
