import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Calendar, Eye, User } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SmartImage } from "@/components/shared/smart-image";
import { Badge } from "@/components/ui/badge";
import { ArticleCard } from "@/components/site/cards";
import { FavoriteButton } from "@/components/site/favorite-button";
import { Crumbs } from "@/components/site/list-tools";
import { PhotoGrid } from "@/components/site/photo-grid";
import { ShareButtons } from "@/components/site/share-buttons";
import { ApiRequestError, api } from "@/lib/api";
import { buildMetadata, siteUrl } from "@/lib/site";
import { excerpt, formatDate, stripHtml, t as tr } from "@/lib/utils";
import type { Article } from "@/lib/types";

type Props = { params: Promise<{ locale: string; slug: string }> };
type Detail = { article: Article; related: Article[] };

async function load(slug: string, locale: string): Promise<Detail | null> {
  try {
    return await api.get<Detail>(`/public/articles/${slug}`, { params: { locale }, revalidate: 60, tags: ["articles", `article:${slug}`] });
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const d = await load(slug, locale);
  if (!d) return {};
  const a = d.article;
  return buildMetadata(locale, {
    title: tr(a.meta_title, locale) || tr(a.title, locale),
    description: tr(a.meta_description, locale) || tr(a.excerpt, locale) || excerpt(tr(a.body, locale), 160),
    image: a.cover_image,
    path: `/news/${slug}`,
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const d = await load(slug, locale);
  if (!d) notFound();
  const { article: a } = d;
  const related = d.related ?? [];
  const t = await getTranslations("news");
  const tc = await getTranslations("common");
  const title = tr(a.title, locale);
  const lead = tr(a.excerpt, locale);
  const body = tr(a.body, locale);
  const date = formatDate(a.published_at || a.created_at, locale);
  const cat = a.category ? tr(a.category.name, locale) : "";
  const url = siteUrl(`/${locale}/news/${a.slug}`);
  const photos = (a.images ?? []).filter(Boolean).map((src) => ({ src }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: lead || stripHtml(body).slice(0, 200),
    datePublished: a.published_at || a.created_at,
    dateModified: a.updated_at,
    inLanguage: locale,
    mainEntityOfPage: url,
    image: a.cover_image ? [a.cover_image.startsWith("http") ? a.cover_image : siteUrl(a.cover_image)] : undefined,
    author: a.author ? { "@type": "Person", name: a.author.name } : undefined,
  };

  return (
    <article className="container-x section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Crumbs items={[{ label: t("title"), href: "/news" }, { label: title }]} />
      <div className="mx-auto mt-8 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {cat && <Badge className="bg-primary-soft text-primary hover:bg-primary-soft">{cat}</Badge>}
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="size-4" /> {date}
          </span>
          {a.views > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4" /> {tc("views", { count: a.views })}
            </span>
          )}
          {a.author && (
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" /> {a.author.name}
            </span>
          )}
        </div>
        <h1 className="heading-lg mt-4 text-balance">{title}</h1>
        {lead && <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{lead}</p>}
      </div>

      {a.cover_image && (
        <div className="mx-auto mt-8 max-w-4xl">
          <SmartImage src={a.cover_image} alt={title} fill priority sizes="(max-width: 1024px) 100vw, 896px" wrapperClassName="relative aspect-[16/9] overflow-hidden rounded-2xl bg-muted" className="object-cover" />
        </div>
      )}

      <div className="mx-auto mt-8 max-w-3xl">
        {body && <div className="prose-museum" dangerouslySetInnerHTML={{ __html: body }} />}

        {photos.length > 0 && (
          <section className="mt-10">
            <h2 className="heading-md mb-4">{t("photos")}</h2>
            <PhotoGrid images={photos} alt={title} />
          </section>
        )}

        {a.tags && a.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t("tags")}:</span>
            {a.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="rounded-full">
                #{tr(tag.name, locale)}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <ShareButtons url={url} title={title} />
          <FavoriteButton type="article" id={a.id} variant="button" />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="heading-md mb-6">{t("related")}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <ArticleCard key={r.id} article={r} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
