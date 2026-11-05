import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MenusList } from "@/components/admin/screens/menus-screen";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("menus.title") };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MenusList />;
}
