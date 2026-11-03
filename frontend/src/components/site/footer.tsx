import { getLocale, getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FacebookIcon, InstagramIcon, TelegramIcon, TiktokIcon, YoutubeIcon } from "@/components/shared/brand-icons";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { getBootstrap, settingBool, settingText } from "@/lib/site";
import { isExternal, t as tr } from "@/lib/utils";

export async function SiteFooter() {
  const locale = await getLocale();
  const t = await getTranslations();
  const boot = await getBootstrap(locale);
  const s = boot.settings;
  const footerMenu = boot.menus.footer ?? [];
  const siteName = settingText(s, "site.name", locale);
  const shortName = settingText(s, "site.short_name", locale, siteName);
  const about = settingText(s, "footer.about", locale) || settingText(s, "site.description", locale);
  const phone = settingText(s, "contact.phone", locale);
  const email = settingText(s, "contact.email", locale);
  const address = settingText(s, "contact.address", locale);
  const hours = settingText(s, "contact.working_hours", locale);
  const logo = settingText(s, "site.logo_dark", locale) || settingText(s, "site.logo", locale) || "/logo.png";
  const copyright = settingText(s, "footer.copyright", locale).replace("{year}", String(new Date().getFullYear()));
  const newsletter = settingBool(s, "features.newsletter", true);
  const socials = [
    { key: "social.facebook", icon: FacebookIcon, label: "Facebook" },
    { key: "social.instagram", icon: InstagramIcon, label: "Instagram" },
    { key: "social.youtube", icon: YoutubeIcon, label: "YouTube" },
    { key: "social.telegram", icon: TelegramIcon, label: "Telegram" },
    { key: "social.tiktok", icon: TiktokIcon, label: "TikTok" },
  ]
    .map((x) => ({ ...x, href: settingText(s, x.key, locale) }))
    .filter((x) => x.href);

  return (
    <footer className="relative mt-auto bg-sidebar text-sidebar-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
      <div className="container-x grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="size-8 object-contain" />
            </span>
            <span className="font-display text-lg font-semibold leading-tight">{shortName}</span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-sidebar-foreground/75">{about}</p>
          {socials.length > 0 && (
            <div className="mt-6 flex gap-2">
              {socials.map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex size-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 transition hover:bg-accent hover:text-accent-foreground">
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">{t("footer.quickLinks")}</h3>
          <ul className="space-y-2.5 text-sm">
            {footerMenu.map((item) => (
              <li key={item.id}>
                {item.type === "external" || isExternal(item.url) ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sidebar-foreground/80 transition hover:text-white">
                    {tr(item.title, locale)}
                  </a>
                ) : (
                  <Link href={item.url || "/"} className="text-sidebar-foreground/80 transition hover:text-white">
                    {tr(item.title, locale)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">{t("footer.contacts")}</h3>
          <ul className="space-y-3.5 text-sm text-sidebar-foreground/80">
            {address && (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>{address}</span>
              </li>
            )}
            {phone && (
              <li className="flex gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-accent" />
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-white">
                  {phone}
                </a>
              </li>
            )}
            {email && (
              <li className="flex gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-accent" />
                <a href={`mailto:${email}`} className="hover:text-white">
                  {email}
                </a>
              </li>
            )}
            {hours && (
              <li className="flex gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-accent" />
                <span className="whitespace-pre-line">{hours}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-3">
          {newsletter && (
            <>
              <h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-accent">{t("footer.newsletter")}</h3>
              <p className="mb-4 text-sm text-sidebar-foreground/75">{t("footer.newsletterText")}</p>
              <NewsletterForm />
            </>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-5 text-xs text-sidebar-foreground/60 md:flex-row">
          <p>{copyright || `© ${new Date().getFullYear()} ${siteName}. ${t("footer.rights")}`}</p>
          <p className="flex items-center gap-1">
            <Link href="/visit" className="hover:text-white">
              {t("nav.visit")}
            </Link>
            <span className="mx-2 opacity-40">•</span>
            <Link href="/contact" className="hover:text-white">
              {t("nav.contact")}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
