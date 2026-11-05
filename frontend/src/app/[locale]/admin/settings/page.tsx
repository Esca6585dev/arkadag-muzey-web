import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsScreen } from "@/components/admin/screens/settings-screen";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("settings") };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsScreen />;
}
