import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeaderBlock } from "@/components/blocks/content-blocks";
import { ArticleCard } from "@/components/site/cards";
import { FilterPill, ListPagination } from "@/components/site/list-pagination";
import { Crumbs, ListSearch } from "@/components/site/list-tools";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { buildMetadata } from "@/lib/site";
import type { Article, Category } from "@/lib/types";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

const LIMIT = 12;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "news" });
  return buildMetadata(locale, { title: t("title"), description: t("subtitle"), path: "/news" });
}

export default async function NewsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("news");
  const tc = await getTranslations("common");
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const category = sp.category || undefined;
  const q = sp.q?.trim() || undefined;
  const plain = page === 1 && !category && !q;

  const [res, cats] = await Promise.all([
    api.safeList<Article>("/public/articles", { params: { locale, page: String(page), limit: String(LIMIT), category, search: q }, revalidate: 60, tags: ["articles"] }),
    api.safeGet<Category[]>("/public/categories", { params: { locale }, revalidate: 300, tags: ["categories"] }),
  ]);
  const items = res.data;
  const featured = plain ? (items.find((a) => a.is_featured && a.cover_image) ?? items[0]) : undefined;
  const rest = featured ? items.filter((a) => a.id !== featured.id) : items;
  const categories = (cats ?? []).filter((c) => (c.article_count ?? 1) > 0);

  return (
    <>
      <PageHeaderBlock s={{ title: t("title"), subtitle: t("subtitle") }} locale={locale} fallbackTitle={t("title")} />
      <div className="container-x section">
        <Crumbs items={[{ label: t("title") }]} />
        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <FilterPill href={{ pathname: "/news", query: q ? { q } : {} }} active={!category}>
              {t("allCategories")}
            </FilterPill>
            {categories.map((c) => (
              <FilterPill key={c.id} href={{ pathname: "/news", query: { category: c.slug, ...(q ? { q } : {}) } }} active={category === c.slug}>
                {c.name?.[locale] || c.name?.tk || c.slug}
              </FilterPill>
            ))}
          </div>
          <ListSearch q={q} placeholder={t("searchPlaceholder")} hidden={{ category }} />
        </div>

        <div className="mt-8">
          {items.length === 0 ? (
            <EmptyState icon={<Newspaper />} title={t("noNews")} description={tc("noResults")} />
          ) : (
            <>
              {featured && <ArticleCard article={featured} locale={locale} variant="featured" className="mb-8" />}
              {rest.length > 0 && (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((a) => (
                    <ArticleCard key={a.id} article={a} locale={locale} />
                  ))}
                </div>
              )}
              <ListPagination pathname="/news" page={res.meta?.page ?? page} pages={res.meta?.pages ?? 1} query={{ category, q }} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
