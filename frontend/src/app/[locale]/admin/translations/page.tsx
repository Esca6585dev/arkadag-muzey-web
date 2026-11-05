import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TranslationsScreen } from "@/components/admin/screens/translations-screen";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("translations") };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TranslationsScreen />;
}
