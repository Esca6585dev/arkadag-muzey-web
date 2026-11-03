import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildMetadata, getCurrentUser } from "@/lib/site";
import { AccountOverview } from "@/components/account/account-overview";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { ...(await buildMetadata(locale, { title: t("title"), path: "/account" })), robots: { index: false } };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  return <AccountOverview memberSinceFallback={user?.created_at ?? null} />;
}
