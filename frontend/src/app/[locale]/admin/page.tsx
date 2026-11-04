import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminDashboard } from "@/components/admin/dashboard";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("dashboard") };
}

export default async function AdminHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminDashboard />;
}
