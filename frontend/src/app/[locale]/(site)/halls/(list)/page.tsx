import type { Metadata } from "next";
import { ArrowUpRight, Layers } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeaderBlock } from "@/components/blocks/content-blocks";
import { SmartImage } from "@/components/shared/smart-image";
import { Crumbs } from "@/components/site/list-tools";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { buildMetadata } from "@/lib/site";
import { cn, t as tr } from "@/lib/utils";
import type { Hall } from "@/lib/types";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "halls" });
  return buildMetadata(locale, { title: t("title"), description: t("subtitle"), path: "/halls" });
}

export default async function HallsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("halls");
  const halls = (await api.safeGet<Hall[]>("/public/halls", { revalidate: 60, locale })) ?? [];

  return (
    <>
      <PageHeaderBlock s={{ title: { [locale]: t("title") }, subtitle: { [locale]: t("subtitle") } }} locale={locale} />
      <div className="container-x section">
        <Crumbs items={[{ label: t("title") }]} />
        {halls.length === 0 ? (
          <EmptyState className="mt-8" icon={<Layers />} title={t("title")} />
        ) : (
          <div className="mt-10 space-y-10 md:space-y-16">
            {halls.map((hall, i) => {
              const name = tr(hall.name, locale);
              return (
                <article key={hall.id} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
                  <Link href={`/halls/${hall.slug}`} className={cn("group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-muted", i % 2 === 1 && "md:order-2")}>
                    <SmartImage src={hall.cover_image} alt={name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />
                  </Link>
                  <div>
                    <p className="eyebrow">
                      {hall.floor ? `${t("floor")}: ${hall.floor} · ` : ""}
                      {t("exhibitCount", { count: hall.exhibit_count ?? 0 })}
                    </p>
                    <h2 className="heading-lg mt-3 text-balance">
                      <Link href={`/halls/${hall.slug}`} className="transition-colors hover:text-primary">
                        {name}
                      </Link>
                    </h2>
                    <p className="mt-4 text-muted-foreground">{tr(hall.summary, locale)}</p>
                    <Link
                      href={`/halls/${hall.slug}`}
                      className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      {t("viewHall")}
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
