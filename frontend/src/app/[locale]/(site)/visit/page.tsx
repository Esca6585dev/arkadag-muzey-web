import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { DynamicPage, pageMetadata } from "@/components/site/dynamic-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("visit", locale);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DynamicPage slug="visit" locale={locale} />;
}
