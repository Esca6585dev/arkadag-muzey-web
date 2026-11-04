import type { Metadata } from "next";
import { Landmark, Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeaderBlock } from "@/components/blocks/content-blocks";
import { ExhibitCard } from "@/components/site/cards";
import { FilterPill, ListPagination } from "@/components/site/list-pagination";
import { Crumbs, ListSearch } from "@/components/site/list-tools";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { buildMetadata } from "@/lib/site";
import { t as tr } from "@/lib/utils";
import type { Exhibit, Hall } from "@/lib/types";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "exhibits" });
  return buildMetadata(locale, { title: t("title"), description: t("subtitle"), path: "/exhibits" });
}

export default async function ExhibitsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("exhibits");
  const tc = await getTranslations("common");

  const hall = sp.hall || undefined;
  const featured = sp.featured === "true" ? "true" : undefined;
  const search = (sp.search || sp.q || "").trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [halls, res] = await Promise.all([
    api.safeGet<Hall[]>("/public/halls", { revalidate: 60, locale }),
    api.safeList<Exhibit>("/public/exhibits", { params: { hall, featured, search, page, limit: 12 }, revalidate: 60, locale }),
  ]);

  const q = (over: Record<string, string | undefined>) => {
    const query: Record<string, string> = {};
    const merged: Record<string, string | undefined> = { hall, featured, search, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) query[k] = v;
    return { pathname: "/exhibits", query };
  };

  return (
    <>
      <PageHeaderBlock s={{ title: { [locale]: t("title") }, subtitle: { [locale]: t("subtitle") } }} locale={locale} />
      <div className="container-x section">
        <Crumbs items={[{ label: t("title") }]} />

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            <FilterPill href={q({ hall: undefined })} active={!hall}>
              {t("allHalls")}
            </FilterPill>
            {(halls ?? []).map((h) => (
              <FilterPill key={h.id} href={q({ hall: h.slug })} active={hall === h.slug}>
                {tr(h.name, locale)}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FilterPill href={q({ featured: featured ? undefined : "true" })} active={!!featured}>
              <Star className="mr-1.5 size-4" /> {t("featuredOnly")}
            </FilterPill>
            <ListSearch q={search} placeholder={t("searchPlaceholder")} hidden={{ hall, featured }} />
          </div>
        </div>

        {res.data.length === 0 ? (
          <EmptyState className="mt-10" icon={<Landmark />} title={t("noExhibits")} description={tc("noResults")} />
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {res.data.map((e) => (
              <ExhibitCard key={e.id} exhibit={e} locale={locale} />
            ))}
          </div>
        )}
        <ListPagination pathname="/exhibits" page={res.meta.page || page} pages={res.meta.pages || 1} query={{ hall, featured, search }} />
      </div>
    </>
  );
}
