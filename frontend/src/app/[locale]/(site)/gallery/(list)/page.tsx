import type { Metadata } from "next";
import { Images } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeaderBlock } from "@/components/blocks/content-blocks";
import { GalleryCard } from "@/components/site/cards";
import { Crumbs } from "@/components/site/list-tools";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { buildMetadata } from "@/lib/site";
import type { Gallery } from "@/lib/types";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery" });
  return buildMetadata(locale, { title: t("title"), description: t("subtitle"), path: "/gallery" });
}

export default async function GalleryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("gallery");
  const galleries = (await api.safeGet<Gallery[]>("/public/galleries", { revalidate: 60, locale })) ?? [];

  return (
    <>
      <PageHeaderBlock s={{ title: { [locale]: t("title") }, subtitle: { [locale]: t("subtitle") } }} locale={locale} />
      <div className="container-x section">
        <Crumbs items={[{ label: t("title") }]} />
        {galleries.length === 0 ? (
          <EmptyState className="mt-8" icon={<Images />} title={t("noPhotos")} />
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((g) => (
              <GalleryCard key={g.id} gallery={g} locale={locale} countLabel={t("photoCount", { count: g.item_count ?? g.items?.length ?? 0 })} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
