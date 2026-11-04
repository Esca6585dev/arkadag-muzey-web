import { getTranslations } from "next-intl/server";
import { Clock, Mail, MapPin, Phone, Ticket, Users, ScrollText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { getBootstrap, settingText } from "@/lib/site";
import { t as tr } from "@/lib/utils";
import type { Article, Event, Exhibit, Gallery, Hall, Slide } from "@/lib/types";
import { SectionHeading } from "@/components/shared/section-heading";
import { SmartImage } from "@/components/shared/smart-image";
import { ArticleCard, EventCard, ExhibitCard, HallCard } from "@/components/site/cards";
import { ContactForm } from "@/components/site/contact-form";
import { HeroSlider } from "./hero";
import { CtaButton, ImageTextBlock, StatsRow, num, plain, str, bool, type S, type StatItem } from "./content-blocks";

const REV = 60;

export async function settingsStats(locale: string): Promise<StatItem[]> {
  const boot = await getBootstrap(locale);
  const raw = boot.settings["home.stats"];
  return Array.isArray(raw) ? (raw as StatItem[]) : [];
}

/* hero ------------------------------------------------------------------ */

export async function HeroBlock({ s }: { s: S; locale: string }) {
  if (plain(s, "source", "slides") === "custom") {
    const custom: Slide = {
      id: 0,
      created_at: "",
      updated_at: "",
      title: (s.title as Record<string, string>) ?? {},
      subtitle: (s.subtitle as Record<string, string>) ?? {},
      image: plain(s, "image"),
      mobile_image: "",
      button_text: (s.button_text as Record<string, string>) ?? {},
      button_url: plain(s, "button_url"),
      button2_text: (s.button2_text as Record<string, string>) ?? {},
      button2_url: plain(s, "button2_url"),
      position: "custom",
      sort_order: 0,
      is_active: true,
    };
    return <HeroSlider slides={[custom]} height={(plain(s, "height", "large") as "full" | "large" | "medium") || "large"} />;
  }
  const slides = await api.safeGet<Slide[]>("/public/slides", { params: { position: plain(s, "position", "home") }, revalidate: REV, tags: ["slides"] });
  return <HeroSlider slides={slides ?? []} height={(plain(s, "height", "full") as "full" | "large" | "medium") || "full"} />;
}

/* about_intro ----------------------------------------------------------- */

export async function AboutIntroBlock({ s, locale }: { s: S; locale: string }) {
  const stats = bool(s, "show_stats", true) ? await settingsStats(locale) : [];
  return <ImageTextBlock s={{ ...s, image_position: plain(s, "image_position", "left") }} locale={locale} stats={stats.length ? <StatsRow items={stats} locale={locale} compact /> : undefined} />;
}

/* halls_grid ------------------------------------------------------------ */

/** 6-column grid spans so any count fills complete rows (5 → 2 wide + 3 regular). */
function hallSpan(i: number, n: number): string {
  const wide = "lg:col-span-3 lg:aspect-[16/10]";
  const normal = "lg:col-span-2";
  if (n % 3 === 0) return normal;
  if (n % 3 === 2) return i < 2 ? wide : normal; // 2,5,8…
  return i === 0 ? "sm:col-span-2 lg:col-span-6 lg:aspect-[21/9]" : normal; // 1,4,7…
}

export async function HallsGridBlock({ s, locale }: { s: S; locale: string }) {
  const t = await getTranslations();
  const halls = (await api.safeGet<Hall[]>("/public/halls", { params: { locale }, revalidate: REV, tags: ["halls"] })) ?? [];
  const limit = num(s, "limit", 6);
  if (!halls.length) return null;
  return (
    <section className="section">
      <div className="container-x">
        <SectionHeading eyebrow={str(s, "label", locale)} title={str(s, "title", locale) || t("home.halls")} action={str(s, "button_text", locale) || t("home.allHalls")} actionHref={plain(s, "button_url", "/halls")} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {halls.slice(0, limit).map((h, i, list) => (
            <HallCard key={h.id} hall={h} locale={locale} countLabel={h.exhibit_count ? t("halls.exhibitCount", { count: h.exhibit_count }) : undefined} className={hallSpan(i, list.length)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* exhibits_featured ----------------------------------------------------- */

export async function ExhibitsFeaturedBlock({ s, locale }: { s: S; locale: string }) {
  const t = await getTranslations();
  const limit = num(s, "limit", 6);
  const res = await api.safeList<Exhibit>("/public/exhibits", { params: { featured: true, limit, locale }, revalidate: REV, tags: ["exhibits"] });
  let items = res.data;
  if (!items.length) items = (await api.safeList<Exhibit>("/public/exhibits", { params: { limit, locale }, revalidate: REV })).data;
  if (!items.length) return null;
  return (
    <section className="section bg-muted/40">
      <div className="container-x">
        <SectionHeading eyebrow={str(s, "label", locale)} title={str(s, "title", locale) || t("home.featuredExhibits")} action={str(s, "button_text", locale) || t("home.allExhibits")} actionHref={plain(s, "button_url", "/exhibits")} />
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
          {items.slice(0, limit).map((e) => (
            <ExhibitCard key={e.id} exhibit={e} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* latest_news ----------------------------------------------------------- */

export async function LatestNewsBlock({ s, locale }: { s: S; locale: string }) {
  const t = await getTranslations();
  const limit = num(s, "limit", 4);
  const res = await api.safeList<Article>("/public/articles", { params: { limit, locale, category: plain(s, "category") || undefined }, revalidate: REV, tags: ["articles"] });
  if (!res.data.length) return null;
  const [first, ...rest] = res.data;
  return (
    <section className="section">
      <div className="container-x">
        <SectionHeading eyebrow={str(s, "label", locale)} title={str(s, "title", locale) || t("home.latestNews")} action={str(s, "button_text", locale) || t("home.allNews")} actionHref={plain(s, "button_url", "/news")} />
        <div className="grid gap-6 lg:grid-cols-5">
          <ArticleCard article={first} locale={locale} variant="featured" className="lg:col-span-3" />
          <div className="flex flex-col gap-4 lg:col-span-2">
            {rest.slice(0, limit - 1).map((a) => (
              <ArticleCard key={a.id} article={a} locale={locale} variant="horizontal" className="rounded-2xl border border-border/70 bg-card p-3" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* events_upcoming ------------------------------------------------------- */

export async function EventsUpcomingBlock({ s, locale }: { s: S; locale: string }) {
  const t = await getTranslations();
  const limit = num(s, "limit", 3);
  const res = await api.safeList<Event>("/public/events", { params: { upcoming: true, limit, locale }, revalidate: REV, tags: ["events"] });
  if (!res.data.length) return null;
  return (
    <section className="section">
      <div className="container-x">
        <SectionHeading eyebrow={str(s, "label", locale)} title={str(s, "title", locale) || t("home.upcomingEvents")} action={t("home.allEvents")} actionHref={plain(s, "button_url", "/events")} />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {res.data.map((e) => (
            <EventCard key={e.id} event={e} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* gallery_strip / gallery ---------------------------------------------- */

export async function GalleryStripBlock({ s, locale }: { s: S; locale: string }) {
  const t = await getTranslations();
  const slug = plain(s, "gallery_slug");
  const limit = num(s, "limit", 8);
  let gallery: Gallery | null = null;
  if (slug) gallery = await api.safeGet<Gallery>(`/public/galleries/${slug}`, { revalidate: REV, tags: ["galleries"] });
  if (!gallery) {
    const list = (await api.safeGet<Gallery[]>("/public/galleries", { revalidate: REV })) ?? [];
    if (list[0]) gallery = await api.safeGet<Gallery>(`/public/galleries/${list[0].slug}`, { revalidate: REV });
  }
  const items = gallery?.items?.slice(0, limit) ?? [];
  if (!items.length) return null;
  return (
    <section className="section bg-muted/40">
      <div className="container-x">
        <SectionHeading eyebrow={str(s, "label", locale)} title={str(s, "title", locale) || t("home.gallery")} action={t("common.viewAll")} actionHref={plain(s, "button_url", "/gallery")} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {items.map((it, i) => (
            <Link key={it.id} href={`/gallery/${gallery!.slug}`} className={`group relative overflow-hidden rounded-xl bg-muted ${i % 5 === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}>
              <SmartImage src={it.image} alt={tr(it.caption, locale)} fill className="object-cover transition duration-700 group-hover:scale-105" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* visit_cta ------------------------------------------------------------- */

export async function VisitCtaBlock({ s, locale }: { s: S; locale: string }) {
  const t = await getTranslations();
  const boot = await getBootstrap(locale);
  const st = boot.settings;
  const map = settingText(st, "contact.map_embed", locale);
  const rows = [
    { icon: MapPin, label: t("contact.address"), value: settingText(st, "contact.address", locale) },
    { icon: Clock, label: t("contact.workingHours"), value: settingText(st, "contact.working_hours", locale) },
    { icon: Phone, label: t("contact.phone"), value: settingText(st, "contact.phone", locale), href: `tel:${settingText(st, "contact.phone", locale).replace(/\s+/g, "")}` },
    { icon: Mail, label: t("contact.email"), value: settingText(st, "contact.email", locale), href: `mailto:${settingText(st, "contact.email", locale)}` },
  ].filter((r) => r.value);
  return (
    <section className="section">
      <div className="container-x grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="eyebrow">{str(s, "label", locale) || t("home.visitUs")}</span>
          <h2 className="heading-lg">{str(s, "title", locale) || t("home.visitUs")}</h2>
          {str(s, "text", locale) && <p className="mt-4 text-lg text-muted-foreground">{str(s, "text", locale)}</p>}
          <dl className="mt-8 grid gap-5 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <r.icon className="size-5" />
                </span>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-sm font-medium">{r.href ? <a href={r.href} className="hover:text-primary">{r.value}</a> : r.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaButton href={plain(s, "button_url", "/contact")}>{str(s, "button_text", locale) || t("nav.contact")}</CtaButton>
            <CtaButton href="/visit" variant="outline">
              {t("nav.visit")}
            </CtaButton>
          </div>
        </div>
        {bool(s, "show_map", true) && map && (
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border/70 shadow-lg lg:aspect-auto lg:h-[460px]">
            <iframe src={map} title={t("contact.map")} className="size-full grayscale-[30%] transition hover:grayscale-0 dark:invert-[0.9] dark:hue-rotate-180" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        )}
      </div>
    </section>
  );
}

/* visit_info ------------------------------------------------------------ */

export async function VisitInfoBlock({ locale }: { s: S; locale: string }) {
  const t = await getTranslations();
  const boot = await getBootstrap(locale);
  const st = boot.settings;
  const cards = [
    { icon: Clock, title: t("visit.hours"), text: settingText(st, "contact.working_hours", locale) },
    { icon: Ticket, title: t("visit.tickets"), text: settingText(st, "visit.tickets", locale) },
    { icon: Users, title: t("visit.tours"), text: settingText(st, "visit.guided_tours", locale) },
    { icon: ScrollText, title: t("visit.rules"), text: settingText(st, "visit.rules", locale) },
  ].filter((c) => c.text);
  const address = settingText(st, "contact.address", locale);
  const map = settingText(st, "contact.map_embed", locale);
  return (
    <section className="section">
      <div className="container-x">
        <div className="grid gap-6 md:grid-cols-2">
          {cards.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border/70 bg-card p-7">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <c.icon className="size-6" />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold">{c.title}</h3>
              <p className="mt-3 whitespace-pre-line text-muted-foreground">{c.text}</p>
            </div>
          ))}
        </div>
        {(address || map) && (
          <div className="mt-12 grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <h3 className="heading-md">{t("visit.address")}</h3>
              <p className="mt-3 flex gap-3 text-muted-foreground">
                <MapPin className="mt-1 size-5 shrink-0 text-accent" /> {address}
              </p>
            </div>
            {map && (
              <div className="aspect-video overflow-hidden rounded-2xl border border-border/70 lg:col-span-3">
                <iframe src={map} title={t("contact.map")} className="size-full dark:invert-[0.9] dark:hue-rotate-180" loading="lazy" />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* contact --------------------------------------------------------------- */

export async function ContactBlock({ s, locale }: { s: S; locale: string }) {
  const t = await getTranslations();
  const boot = await getBootstrap(locale);
  const st = boot.settings;
  const map = settingText(st, "contact.map_embed", locale);
  const info = [
    { icon: MapPin, label: t("contact.address"), value: settingText(st, "contact.address", locale) },
    { icon: Phone, label: t("contact.phone"), value: [settingText(st, "contact.phone", locale), settingText(st, "contact.phone2", locale)].filter(Boolean).join("\n") },
    { icon: Mail, label: t("contact.email"), value: settingText(st, "contact.email", locale) },
    { icon: Clock, label: t("contact.workingHours"), value: settingText(st, "contact.working_hours", locale) },
  ].filter((r) => r.value);
  return (
    <section className="section">
      <div className="container-x grid gap-12 lg:grid-cols-5">
        {bool(s, "show_info", true) && (
          <aside className="lg:col-span-2">
            <ul className="space-y-6">
              {info.map((r) => (
                <li key={r.label} className="flex gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <r.icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</p>
                    <p className="mt-1 whitespace-pre-line font-medium">{r.value}</p>
                  </div>
                </li>
              ))}
            </ul>
            {bool(s, "show_map", true) && map && (
              <div className="mt-8 aspect-[4/3] overflow-hidden rounded-2xl border border-border/70">
                <iframe src={map} title={t("contact.map")} className="size-full dark:invert-[0.9] dark:hue-rotate-180" loading="lazy" />
              </div>
            )}
          </aside>
        )}
        {bool(s, "show_form", true) && (
          <div className="rounded-2xl border border-border/70 bg-card p-6 md:p-8 lg:col-span-3">
            <h2 className="heading-md mb-6">{t("contact.form.title")}</h2>
            <ContactForm />
          </div>
        )}
      </div>
    </section>
  );
}
