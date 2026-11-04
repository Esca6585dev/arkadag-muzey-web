import type { Metadata } from "next";
import { Landmark, Layers } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SmartImage } from "@/components/shared/smart-image";
import { ExhibitCard, HallCard } from "@/components/site/cards";
import { getOr404, getOrNull } from "@/components/site/detail-fetch";
import { FavoriteButton } from "@/components/site/favorite-button";
import { Crumbs } from "@/components/site/list-tools";
import { PhotoGrid } from "@/components/site/photo-grid";
import { ShareButtons } from "@/components/site/share-buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { buildMetadata, siteUrl } from "@/lib/site";
import { excerpt, t as tr } from "@/lib/utils";
import type { Hall } from "@/lib/types";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const hall = await getOrNull<Hall>(`/public/halls/${slug}`, locale);
  if (!hall) return {};
  return buildMetadata(locale, {
    title: hall.name,
    description: tr(hall.summary, locale) || excerpt(tr(hall.description, locale), 160),
    image: hall.cover_image,
    path: `/halls/${slug}`,
  });
}

export default async function HallPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("halls");
  const te = await getTranslations("exhibits");
  const hall = await getOr404<Hall>(`/public/halls/${slug}`, locale);
  const all = (await api.safeGet<Hall[]>("/public/halls", { revalidate: 60, locale })) ?? [];
  const others = all.filter((h) => h.id !== hall.id).slice(0, 4);

  const name = tr(hall.name, locale);
  const summary = tr(hall.summary, locale);
  const description = tr(hall.description, locale);
  const exhibits = hall.exhibits ?? [];
  const count = hall.exhibit_count ?? exhibits.length;
  const photos = (hall.images ?? []).filter(Boolean).map((src) => ({ src }));
  const url = siteUrl(`/${locale}/halls/${slug}`);

  return (
    <>
      <section className="relative -mt-[var(--header-height)] overflow-hidden bg-sidebar pt-[var(--header-height)] text-white">
        <div className="absolute inset-0">
          <SmartImage src={hall.cover_image} alt="" fill priority sizes="100vw" className="object-cover" fallbackClassName="bg-sidebar-accent" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80" />
        </div>
        <div className="container-x relative py-20 md:py-28">
          <p className="eyebrow">{t("title")}</p>
          <h1 className="heading-xl mt-3 max-w-3xl text-balance text-white drop-shadow-md">{name}</h1>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            {hall.floor && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 backdrop-blur">
                <Layers className="size-4" /> {t("floor")}: {hall.floor}
              </span>
            )}
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 backdrop-blur">
              <Landmark className="size-4" /> {t("exhibitCount", { count })}
            </span>
          </div>
        </div>
      </section>

      <div className="container-x section">
        <Crumbs items={[{ label: t("title"), href: "/halls" }, { label: name }]} />

        <div className="mt-8 flex items-start justify-between gap-6">
          <div className="max-w-3xl">
            {summary && <p className="mb-6 text-xl text-muted-foreground">{summary}</p>}
            {description && <div className="prose-museum" dangerouslySetInnerHTML={{ __html: description }} />}
          </div>
          <FavoriteButton type="hall" id={hall.id} />
        </div>
        <div className="mt-8 border-t border-border/70 pt-6">
          <ShareButtons url={url} title={name} />
        </div>

        {photos.length > 0 && (
          <section className="mt-16">
            <h2 className="heading-md mb-6">{t("gallery")}</h2>
            <PhotoGrid images={photos} alt={name} />
          </section>
        )}

        <section className="mt-16">
          <h2 className="heading-md mb-6">{t("exhibitsInHall")}</h2>
          {exhibits.length === 0 ? (
            <EmptyState icon={<Landmark />} title={te("noExhibits")} />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
              {exhibits.map((e) => (
                <ExhibitCard key={e.id} exhibit={{ ...e, hall: null }} locale={locale} />
              ))}
            </div>
          )}
        </section>

        {others.length > 0 && (
          <section className="mt-16">
            <h2 className="heading-md mb-6">{t("otherHalls")}</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {others.map((h) => (
                <HallCard key={h.id} hall={h} locale={locale} countLabel={t("exhibitCount", { count: h.exhibit_count ?? 0 })} className="aspect-[3/4]" />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
