import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { RegisterForm } from "@/components/account/register-form";
import { buildMetadata, getCurrentUser } from "@/lib/site";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { ...(await buildMetadata(locale, { title: t("register"), path: "/register" })), robots: { index: false } };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect({ href: "/account", locale });
  const t = await getTranslations("auth");
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{t("registerTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("registerSubtitle")}</p>
      </div>
      <RegisterForm />
    </>
  );
}
