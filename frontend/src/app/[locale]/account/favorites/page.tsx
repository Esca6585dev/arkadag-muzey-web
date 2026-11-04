import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildMetadata } from "@/lib/site";
import { AccountPageHeader } from "@/components/account/page-header";
import { FavoritesView } from "@/components/account/favorites-view";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { ...(await buildMetadata(locale, { title: t("favorites"), path: "/account/favorites" })), robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  return (
    <>
      <AccountPageHeader title={t("favorites")} description={t("favoritesSubtitle")} />
      <FavoritesView />
    </>
  );
}
