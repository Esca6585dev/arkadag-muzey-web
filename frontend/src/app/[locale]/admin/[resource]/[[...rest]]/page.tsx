import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ResourceScreen } from "@/components/admin/crud/resource-screen";
import { isResourceName } from "@/components/admin/crud/resource-names";

type Props = { params: Promise<{ locale: string; resource: string; rest?: string[] }> };

const LABEL_KEYS: Record<string, string> = { "activity-logs": "activityLogs" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { resource } = await params;
  if (!isResourceName(resource)) return {};
  const t = await getTranslations("admin");
  return { title: t(LABEL_KEYS[resource] ?? resource) };
}

export default async function AdminResourcePage({ params }: Props) {
  const { locale, resource, rest } = await params;
  setRequestLocale(locale);
  if (!isResourceName(resource) || (rest && rest.length > 1)) notFound();

  const sub = rest?.[0];
  if (!sub) return <ResourceScreen resource={resource} mode="list" />;
  if (sub === "new") return <ResourceScreen resource={resource} mode="new" />;
  const id = Number(sub);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ResourceScreen resource={resource} mode="edit" id={id} />;
}
