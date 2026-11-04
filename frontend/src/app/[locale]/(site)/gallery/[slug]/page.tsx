import type { Metadata } from "next";
import { Images } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOr404, getOrNull } from "@/components/site/detail-fetch";
import { Crumbs } from "@/components/site/list-tools";
import { PhotoGrid } from "@/components/site/photo-grid";
import { ShareButtons } from "@/components/site/share-buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { buildMetadata, siteUrl } from "@/lib/site";
import { t as tr } from "@/lib/utils";
import type { Gallery } from "@/lib/types";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = await getOrNull<Gallery>(`/public/galleries/${slug}`, locale);
  if (!g) return {};
  return buildMetadata(locale, {
    title: g.title,
    description: g.description,
    image: g.cover_image || g.items?.[0]?.image,
    path: `/gallery/${slug}`,
  });
}

export default async function GalleryDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gallery");
  const g = await getOr404<Gallery>(`/public/galleries/${slug}`, locale);

  const title = tr(g.title, locale);
  const description = tr(g.description, locale);
  const items = g.items ?? [];
  const photos = items.map((i) => ({ src: i.image, caption: tr(i.caption, locale) || undefined }));

  return (
    <div className="container-x section">
      <Crumbs items={[{ label: t("title"), href: "/gallery" }, { label: title }]} />
      <header className="mt-8 max-w-3xl">
        <p className="eyebrow">{t("photoCount", { count: items.length })}</p>
        <h1 className="heading-xl mt-3 text-balance">{title}</h1>
        {description && <p className="mt-4 text-lg text-muted-foreground">{description}</p>}
      </header>
      <div className="mt-10">
        {photos.length === 0 ? <EmptyState icon={<Images />} title={t("noPhotos")} /> : <PhotoGrid images={photos} variant="masonry" alt={title} />}
      </div>
      <div className="mt-10 border-t border-border/70 pt-6">
        <ShareButtons url={siteUrl(`/${locale}/gallery/${slug}`)} title={title} />
      </div>
    </div>
  );
}
