import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DynamicPage, pageMetadata } from "@/components/site/dynamic-page";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return pageMetadata(slug, locale, `/p/${slug}`);
}

export default async function CustomPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <DynamicPage slug={slug} locale={locale} />;
}
