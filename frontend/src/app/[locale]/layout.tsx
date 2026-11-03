import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/playfair-display";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import { getBootstrap, getCurrentUser, settingText, siteUrl } from "@/lib/site";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const boot = await getBootstrap(locale);
  const siteName = settingText(boot.settings, "site.name", locale, "Arkadag Museum");
  const favicon = settingText(boot.settings, "site.favicon", locale, "/logo.png");
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: settingText(boot.settings, "seo.title", locale, siteName), template: `%s · ${settingText(boot.settings, "site.short_name", locale, siteName)}` },
    description: settingText(boot.settings, "seo.description", locale, ""),
    icons: { icon: favicon || "/logo.png" },
    applicationName: siteName,
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [boot, user] = await Promise.all([getBootstrap(locale), getCurrentUser()]);
  const defaultTheme = settingText(boot.settings, "theme.default_mode", locale, "system");
  const primary = settingText(boot.settings, "theme.primary", locale, "");
  const accent = settingText(boot.settings, "theme.accent", locale, "");
  const themeVars = [primary && `--primary:${primary};--ring:${primary};`, accent && `--accent:${accent};`].filter(Boolean).join("");

  return (
    <html lang={locale} suppressHydrationWarning className="h-full">
      <body className="min-h-full flex flex-col">
        {themeVars ? <style dangerouslySetInnerHTML={{ __html: `:root{${themeVars}}` }} /> : null}
        <NextIntlClientProvider>
          <Providers initialUser={user} defaultTheme={defaultTheme}>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
