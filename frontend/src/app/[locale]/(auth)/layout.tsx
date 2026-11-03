import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SmartImage } from "@/components/shared/smart-image";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { getBootstrap, settingText } from "@/lib/site";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("auth");
  const boot = await getBootstrap(locale);
  const s = boot.settings;
  const siteName = settingText(s, "site.name", locale, "Arkadag Museum");
  const shortName = settingText(s, "site.short_name", locale, siteName);
  const tagline = settingText(s, "site.tagline", locale);

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative isolate overflow-hidden bg-sidebar text-white lg:min-h-screen">
        <SmartImage src="/uploads/seed/hero-1.jpg" alt="" fill priority sizes="(min-width: 1024px) 52vw, 100vw" className="object-cover" wrapperClassName="absolute inset-0 -z-10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/50 to-black/35 lg:bg-gradient-to-tr lg:from-black/85 lg:via-black/45 lg:to-black/20" />
        <div className="flex h-full flex-col justify-between gap-10 p-5 sm:p-8 lg:p-12">
          <Link href="/" className="flex items-center gap-3" aria-label={siteName}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur lg:size-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="size-8 object-contain lg:size-10" />
            </span>
            <span className="font-display text-lg font-semibold leading-tight lg:hidden">{shortName}</span>
          </Link>
          <div className="hidden max-w-lg lg:block">
            <p className="eyebrow !text-accent">{t("welcomeBack")}</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight xl:text-5xl">{shortName}</h2>
            {tagline && <p className="mt-4 text-lg leading-relaxed text-white/80">{tagline}</p>}
            <div className="mt-8 h-1 w-16 rounded-full bg-accent" />
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 flex-col bg-background">
        <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="size-4" />
            {t("backToSite")}
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher languages={boot.languages} compact />
          </div>
        </div>
        <main className="flex flex-1 items-center justify-center px-4 pb-12 pt-4 sm:px-8">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
