import type { ReactNode } from "react";
import { getLocale, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { getBootstrap, getCurrentUser, settingText } from "@/lib/site";

export const metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login?next=/account", locale });
  const boot = await getBootstrap(locale);
  const s = boot.settings;
  const siteName = settingText(s, "site.short_name", locale, settingText(s, "site.name", locale, "Arkadag Museum"));
  return (
    <AccountShell languages={boot.languages} siteName={siteName} logo={settingText(s, "site.logo", locale, "/logo.png")}>
      {children}
    </AccountShell>
  );
}
