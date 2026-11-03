"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useLocale } from "next-intl";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/shared/smart-image";
import { cn, isExternal, t as tr } from "@/lib/utils";
import type { Slide } from "@/lib/types";

function CtaLink({ href, children, variant }: { href: string; children: React.ReactNode; variant: "primary" | "ghost" }) {
  const cls =
    variant === "primary"
      ? "rounded-full bg-accent px-7 text-accent-foreground hover:bg-accent/90"
      : "rounded-full border border-white/40 bg-white/10 px-7 text-white backdrop-blur hover:bg-white/20 hover:text-white";
  if (isExternal(href)) {
    return (
      <Button asChild size="lg" variant={variant === "primary" ? "default" : "outline"} className={cls}>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" variant={variant === "primary" ? "default" : "outline"} className={cls}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function HeroSlider({ slides, height = "full" }: { slides: Slide[]; height?: "full" | "large" | "medium" }) {
  const locale = useLocale();
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, duration: 40 }, [Autoplay({ delay: 7000, stopOnInteraction: false })]);
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap());
  }, [embla]);
  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, onSelect]);

  if (!slides.length) return null;
  const h = height === "full" ? "h-[calc(100svh-var(--header-height))] min-h-[560px] max-h-[900px]" : height === "large" ? "h-[70vh] min-h-[520px]" : "h-[55vh] min-h-[420px]";

  return (
    <section className={cn("relative -mt-[var(--header-height)] overflow-hidden bg-sidebar text-white", h, "pt-[var(--header-height)]")} aria-roledescription="carousel">
      <div className="absolute inset-0" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((s, i) => (
            <div key={s.id} className="relative h-full min-w-0 flex-[0_0_100%]">
              <SmartImage
                src={s.image}
                alt={tr(s.title, locale)}
                fill
                priority={i === 0}
                sizes="100vw"
                className={cn("object-cover", i === selected && "animate-ken-burns")}
                fallbackClassName="bg-sidebar-accent"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            </div>
          ))}
        </div>
      </div>

      <div className="container-x relative grid h-full content-center pb-24 pt-10">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "max-w-3xl transition-all duration-700 [grid-area:1/1]",
              i === selected ? "translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
            )}
            aria-hidden={i !== selected}
          >
            <span className="eyebrow text-accent">{tr(s.subtitle, locale) ? tr(s.subtitle, locale) : ""}</span>
            <h1 className="heading-xl text-balance text-white drop-shadow-lg">{tr(s.title, locale)}</h1>
            <div className="mt-8 flex flex-wrap gap-3">
              {s.button_url && tr(s.button_text, locale) && (
                <CtaLink href={s.button_url} variant="primary">
                  {tr(s.button_text, locale)}
                </CtaLink>
              )}
              {s.button2_url && tr(s.button2_text, locale) && (
                <CtaLink href={s.button2_url} variant="ghost">
                  {tr(s.button2_text, locale)}
                </CtaLink>
              )}
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="container-x absolute inset-x-0 bottom-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {slides.map((s, i) => (
              <button key={s.id} type="button" aria-label={`Slide ${i + 1}`} onClick={() => embla?.scrollTo(i)} className={cn("h-1.5 rounded-full bg-white/40 transition-all", i === selected ? "w-10 bg-accent" : "w-4 hover:bg-white/70")} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous" onClick={() => embla?.scrollPrev()} className="flex size-11 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/25">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" aria-label="Next" onClick={() => embla?.scrollNext()} className="flex size-11 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur transition hover:bg-white/25">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 animate-bounce text-white/60 md:block">
        <ChevronDown className="size-5" />
      </div>
    </section>
  );
}
