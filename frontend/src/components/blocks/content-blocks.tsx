import { ArrowRight, BookOpen, Globe, Shield, Sparkles, Star, Landmark, Users, Heart, Award, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SmartImage } from "@/components/shared/smart-image";
import { SectionHeading } from "@/components/shared/section-heading";
import { cn, isExternal, t as tr, type Translatable } from "@/lib/utils";

/* Shared helpers --------------------------------------------------------- */

export type S = Record<string, unknown>;
export const str = (s: S, k: string, locale: string) => tr(s[k] as Translatable, locale);
export const plain = (s: S, k: string, d = "") => (typeof s[k] === "string" ? (s[k] as string) : d);
export const num = (s: S, k: string, d: number) => (typeof s[k] === "number" ? (s[k] as number) : Number(s[k]) || d);
export const bool = (s: S, k: string, d: boolean) => (typeof s[k] === "boolean" ? (s[k] as boolean) : d);
export const arr = <T,>(s: S, k: string): T[] => (Array.isArray(s[k]) ? (s[k] as T[]) : []);

const ICONS: Record<string, LucideIcon> = { shield: Shield, "book-open": BookOpen, globe: Globe, sparkles: Sparkles, star: Star, landmark: Landmark, users: Users, heart: Heart, award: Award };
export function iconByName(name?: string): LucideIcon {
  return (name && ICONS[name]) || Sparkles;
}

export function CtaButton({ href, children, className, variant = "default" }: { href: string; children: React.ReactNode; className?: string; variant?: "default" | "outline" | "secondary" }) {
  const cls = cn("group rounded-full", className);
  if (isExternal(href)) {
    return (
      <Button asChild size="lg" variant={variant} className={cls}>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" variant={variant} className={cls}>
      <Link href={href}>
        {children}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Button>
  );
}

/* page_header ------------------------------------------------------------ */

export function PageHeaderBlock({ s, locale, fallbackTitle }: { s: S; locale: string; fallbackTitle?: string }) {
  const title = str(s, "title", locale) || fallbackTitle || "";
  const subtitle = str(s, "subtitle", locale);
  // List pages pass no image; fall back to a museum interior photo instead of a blank band.
  const image = plain(s, "image") || "/uploads/seed/hero-2.jpg";
  return (
    <section className="relative -mt-[var(--header-height)] overflow-hidden bg-sidebar pt-[var(--header-height)] text-white">
      <div className="absolute inset-0">
        <SmartImage src={image} alt="" fill priority sizes="100vw" className="object-cover" fallbackClassName="bg-sidebar-accent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/75" />
      </div>
      <div className="container-x relative py-20 md:py-28">
        <h1 className="heading-xl max-w-3xl text-balance text-white drop-shadow-md">{title}</h1>
        {subtitle && <p className="mt-5 max-w-2xl text-lg text-white/80">{subtitle}</p>}
      </div>
    </section>
  );
}

/* rich_text ------------------------------------------------------------- */

export function RichTextBlock({ s, locale }: { s: S; locale: string }) {
  const html = str(s, "content", locale) || str(s, "text", locale);
  const title = str(s, "title", locale);
  if (!html && !title) return null;
  return (
    <section className="section">
      <div className="container-x">
        <div className={cn("mx-auto max-w-3xl", plain(s, "align") === "left" && "mx-0")}>
          {title && <h2 className="heading-lg mb-6">{title}</h2>}
          <div className="prose-museum" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </section>
  );
}

/* image_text / about_intro ---------------------------------------------- */

export function ImageTextBlock({ s, locale, stats }: { s: S; locale: string; stats?: React.ReactNode }) {
  const images = [plain(s, "image"), plain(s, "image2"), ...arr<string>(s, "images")].filter(Boolean);
  const right = plain(s, "image_position", "right") === "right";
  const label = str(s, "label", locale);
  const title = str(s, "title", locale);
  const text = str(s, "text", locale);
  const btnText = str(s, "button_text", locale);
  const btnUrl = plain(s, "button_url");
  return (
    <section className="section overflow-hidden">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className={cn("relative", right ? "lg:order-2" : "")}>
          {images.length > 1 ? (
            <div className="relative mx-auto aspect-[5/4] max-w-xl">
              <div className="absolute left-0 top-0 h-[78%] w-[68%] overflow-hidden rounded-2xl shadow-xl">
                <SmartImage src={images[0]} alt="" fill className="object-cover" />
              </div>
              <div className="absolute bottom-0 right-0 h-[62%] w-[52%] overflow-hidden rounded-2xl border-4 border-background shadow-2xl">
                <SmartImage src={images[1]} alt="" fill className="object-cover" />
              </div>
              <div className="absolute -left-6 -top-6 -z-10 size-40 rounded-full bg-accent/20 blur-2xl" />
              <div className="absolute -bottom-8 -right-8 -z-10 size-48 bg-ornament opacity-70" />
            </div>
          ) : (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl">
              <SmartImage src={images[0]} alt="" fill className="object-cover" />
            </div>
          )}
        </div>
        <div className={cn(right ? "lg:order-1" : "")}>
          {label && <span className="eyebrow">{label}</span>}
          {title && <h2 className="heading-lg text-balance">{title}</h2>}
          {text && <div className="prose-museum mt-6 text-muted-foreground" dangerouslySetInnerHTML={{ __html: text }} />}
          {btnUrl && btnText && (
            <div className="mt-8">
              <CtaButton href={btnUrl}>{btnText}</CtaButton>
            </div>
          )}
          {stats && <div className="mt-10">{stats}</div>}
        </div>
      </div>
    </section>
  );
}

/* stats ----------------------------------------------------------------- */

export interface StatItem {
  value: string | number;
  suffix?: string;
  label: Translatable | string;
}

export function StatsRow({ items, locale, compact = false }: { items: StatItem[]; locale: string; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <div className={cn("grid gap-6", compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 lg:grid-cols-4")}>
      {items.map((it, i) => (
        <div key={i} className={cn(compact ? "" : "rounded-2xl border border-border/70 bg-card p-6 text-center")}>
          <p className={cn("font-display font-semibold text-primary", compact ? "text-3xl" : "text-4xl md:text-5xl")}>
            {it.value}
            <span className="text-accent">{it.suffix ?? ""}</span>
          </p>
          <p className={cn("mt-1 text-sm text-muted-foreground", compact ? "" : "uppercase tracking-wider")}>{typeof it.label === "string" ? it.label : tr(it.label, locale)}</p>
        </div>
      ))}
    </div>
  );
}

export function StatsBlock({ s, locale, settingsStats, title }: { s: S; locale: string; settingsStats: StatItem[]; title?: string }) {
  const items = plain(s, "source", "settings") === "custom" ? arr<StatItem>(s, "items") : settingsStats;
  const heading = str(s, "title", locale) || title;
  if (!items.length) return null;
  return (
    <section className="section bg-muted/40">
      <div className="container-x">
        {heading && <SectionHeading title={heading} eyebrow={str(s, "label", locale)} align="center" className="mb-10" />}
        <StatsRow items={items} locale={locale} />
      </div>
    </section>
  );
}

/* features -------------------------------------------------------------- */

export function FeaturesBlock({ s, locale }: { s: S; locale: string }) {
  const items = arr<{ icon?: string; title: Translatable; text: Translatable }>(s, "items");
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="container-x">
        {(str(s, "title", locale) || str(s, "label", locale)) && <SectionHeading title={str(s, "title", locale)} eyebrow={str(s, "label", locale)} align="center" />}
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((it, i) => {
            const Icon = iconByName(it.icon);
            return (
              <div key={i} className="group rounded-2xl border border-border/70 bg-card p-7 card-hover">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold">{tr(it.title, locale)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tr(it.text, locale)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* faq ------------------------------------------------------------------- */

export function FaqBlock({ s, locale }: { s: S; locale: string }) {
  const items = arr<{ question: Translatable; answer: Translatable }>(s, "items");
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="container-x max-w-3xl">
        {str(s, "title", locale) && <SectionHeading title={str(s, "title", locale)} eyebrow={str(s, "label", locale)} align="center" />}
        <Accordion type="single" collapsible className="rounded-2xl border border-border/70 bg-card px-6">
          {items.map((it, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left font-medium hover:no-underline">{tr(it.question, locale)}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{tr(it.answer, locale)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* cta ------------------------------------------------------------------- */

export function CtaBlock({ s, locale }: { s: S; locale: string }) {
  const image = plain(s, "image");
  return (
    <section className="section">
      <div className="container-x">
        <div className="relative overflow-hidden rounded-3xl bg-sidebar px-8 py-14 text-white md:px-16 md:py-20">
          {image && (
            <>
              <SmartImage src={image} alt="" fill className="object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/80 to-transparent" />
            </>
          )}
          <div className="relative max-w-2xl">
            {str(s, "label", locale) && <span className="eyebrow">{str(s, "label", locale)}</span>}
            <h2 className="heading-lg text-white">{str(s, "title", locale)}</h2>
            {str(s, "text", locale) && <p className="mt-4 text-white/80">{str(s, "text", locale)}</p>}
            {plain(s, "button_url") && (
              <div className="mt-8">
                <CtaButton href={plain(s, "button_url")} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {str(s, "button_text", locale)}
                </CtaButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* video ----------------------------------------------------------------- */

function embedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

export function VideoBlock({ s, locale }: { s: S; locale: string }) {
  const url = plain(s, "url");
  if (!url) return null;
  return (
    <section className="section">
      <div className="container-x max-w-4xl">
        {str(s, "title", locale) && <SectionHeading title={str(s, "title", locale)} align="center" />}
        <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-xl">
          <iframe src={embedUrl(url)} title={str(s, "title", locale) || "video"} className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      </div>
    </section>
  );
}

/* spacer ---------------------------------------------------------------- */

export function SpacerBlock({ s }: { s: S }) {
  const size = plain(s, "size", "md");
  return <div className={cn(size === "sm" ? "h-8" : size === "lg" ? "h-32" : "h-16")} aria-hidden />;
}

/* timeline -------------------------------------------------------------- */

export function TimelineBlock({ s, locale }: { s: S; locale: string }) {
  const items = arr<{ year: string; title: Translatable; text: Translatable }>(s, "items");
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="container-x max-w-4xl">
        {str(s, "title", locale) && <SectionHeading title={str(s, "title", locale)} eyebrow={str(s, "label", locale)} align="center" />}
        <ol className="relative border-l-2 border-accent/40 pl-8">
          {items.map((it, i) => (
            <li key={i} className="relative mb-10 last:mb-0">
              <span className="absolute -left-[2.45rem] flex size-5 items-center justify-center rounded-full border-4 border-background bg-accent" />
              <p className="font-display text-2xl font-semibold text-primary">{it.year}</p>
              <h3 className="mt-1 text-lg font-semibold">{tr(it.title, locale)}</h3>
              <p className="mt-1 text-muted-foreground">{tr(it.text, locale)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* static gallery (images[]) --------------------------------------------- */

export function ImagesGridBlock({ images, title }: { images: string[]; title?: string }) {
  if (!images.length) return null;
  return (
    <section className="section">
      <div className="container-x">
        {title && <SectionHeading title={title} align="center" />}
        <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
          {images.map((img, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-full object-cover transition duration-500 hover:scale-105" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
