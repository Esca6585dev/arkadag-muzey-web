import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ExhibitCard } from "@/components/site/cards";
import { getOr404, getOrNull } from "@/components/site/detail-fetch";
import { ExhibitGallery } from "@/components/site/exhibit-gallery";
import { FavoriteButton } from "@/components/site/favorite-button";
import { Crumbs } from "@/components/site/list-tools";
import { ShareButtons } from "@/components/site/share-buttons";
import { buildMetadata, siteUrl } from "@/lib/site";
import { excerpt, t as tr } from "@/lib/utils";
import type { Exhibit } from "@/lib/types";

type Props = { params: Promise<{ locale: string; slug: string }> };
type Detail = { exhibit: Exhibit; related?: Exhibit[] };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const d = await getOrNull<Detail>(`/public/exhibits/${slug}`, locale);
  if (!d) return {};
  const e = d.exhibit;
  return buildMetadata(locale, {
    title: e.title,
    description: tr(e.summary, locale) || excerpt(tr(e.description, locale), 160),
    image: e.image,
    path: `/exhibits/${slug}`,
  });
}

export default async function ExhibitPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("exhibits");
  const { exhibit, related = [] } = await getOr404<Detail>(`/public/exhibits/${slug}`, locale);

  const title = tr(exhibit.title, locale);
  const summary = tr(exhibit.summary, locale);
  const description = tr(exhibit.description, locale);
  const images = [exhibit.image, ...(exhibit.images ?? [])].filter(Boolean);
  const hallName = exhibit.hall ? tr(exhibit.hall.name, locale) : "";
  const url = siteUrl(`/${locale}/exhibits/${slug}`);

  const rows = [
    { label: t("period"), value: tr(exhibit.period, locale) },
    { label: t("material"), value: tr(exhibit.material, locale) },
    { label: t("origin"), value: tr(exhibit.origin, locale) },
    { label: t("inventoryNo"), value: exhibit.inventory_no },
  ].filter((r) => r.value);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    description: summary || excerpt(description, 200),
    image: images.map((s) => (s.startsWith("http") ? s : siteUrl(s))),
    url,
    ...(tr(exhibit.material, locale) && { material: tr(exhibit.material, locale) }),
    ...(tr(exhibit.origin, locale) && { locationCreated: { "@type": "Place", name: tr(exhibit.origin, locale) } }),
    ...(tr(exhibit.period, locale) && { temporalCoverage: tr(exhibit.period, locale) }),
    ...(exhibit.inventory_no && { identifier: exhibit.inventory_no }),
  };

  return (
    <div className="container-x section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Crumbs
        items={[
          { label: t("title"), href: "/exhibits" },
          ...(exhibit.hall ? [{ label: hallName, href: `/halls/${exhibit.hall.slug}` }] : []),
          { label: title },
        ]}
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ExhibitGallery images={images} alt={title} />

        <div>
          {exhibit.hall && (
            <Link href={`/halls/${exhibit.hall.slug}`} className="eyebrow transition-colors hover:text-primary">
              {hallName}
            </Link>
          )}
          <h1 className="heading-lg mt-3 text-balance">{title}</h1>
          {summary && <p className="mt-4 text-lg text-muted-foreground">{summary}</p>}

          {rows.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card">
              <h2 className="border-b border-border/70 px-5 py-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("details")}</h2>
              <dl className="divide-y divide-border/70">
                {rows.map((r) => (
                  <div key={r.label} className="grid grid-cols-[8rem_1fr] gap-4 px-5 py-3 text-sm sm:grid-cols-[10rem_1fr]">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="font-medium">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <FavoriteButton type="exhibit" id={exhibit.id} variant="button" />
            <ShareButtons url={url} title={title} />
          </div>
        </div>
      </div>

      {description && description !== summary && (
        <section className="mt-14 max-w-3xl">
          <h2 className="heading-md mb-5">{t("about")}</h2>
          <div className="prose-museum" dangerouslySetInnerHTML={{ __html: description }} />
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="heading-md mb-6">{t("related")}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {related
              .filter((r) => r.id !== exhibit.id)
              .slice(0, 4)
              .map((r) => (
                <ExhibitCard key={r.id} exhibit={r} locale={locale} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
