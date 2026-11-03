import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { BackToTop } from "@/components/site/back-to-top";
import { getBootstrap, settingBool, settingText } from "@/lib/site";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  const boot = await getBootstrap(locale);
  const s = boot.settings;
  const siteName = settingText(s, "site.name", locale, "Arkadag Museum");

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        {t("skipToContent")}
      </a>
      <SiteHeader
        menu={boot.menus.header ?? []}
        languages={boot.languages}
        siteName={siteName}
        shortName={settingText(s, "site.short_name", locale, siteName)}
        logo={settingText(s, "site.logo", locale, "/logo.png")}
        phone={settingText(s, "contact.phone", locale)}
        email={settingText(s, "contact.email", locale)}
        hours={settingText(s, "contact.working_hours", locale).split("\n")[0]}
        showTopBar={settingBool(s, "theme.show_top_bar", true)}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}
