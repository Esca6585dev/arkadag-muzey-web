import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MenuEditor } from "@/components/admin/screens/menus-screen";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("menus.title") };
}

export default async function Page({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return <MenuEditor id={n} />;
}
