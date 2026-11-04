import { setRequestLocale, getTranslations } from "next-intl/server";
import { buildMetadata, getBootstrap } from "@/lib/site";
import { AccountPageHeader } from "@/components/account/page-header";
import { ProfileForm } from "@/components/account/profile-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { ...(await buildMetadata(locale, { title: t("profile"), path: "/account/profile" })), robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  const boot = await getBootstrap(locale);
  return (
    <>
      <AccountPageHeader title={t("profile")} description={t("profileSubtitle")} />
      <ProfileForm languages={boot.languages} />
    </>
  );
}
