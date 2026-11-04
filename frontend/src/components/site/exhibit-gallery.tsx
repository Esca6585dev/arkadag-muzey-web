"use client";

import { useState } from "react";
import { Expand } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { SmartImage } from "@/components/shared/smart-image";
import { cn } from "@/lib/utils";

/** Main image + thumbnails with a zoomable lightbox. */
export function ExhibitGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const current = images[active];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt}
        className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <SmartImage src={current} alt={alt} fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" />
        {current && (
          <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <Expand className="size-4" />
          </span>
        )}
      </button>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${alt} ${i + 1}`}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-lg border-2 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring sm:size-20",
                  i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                <SmartImage src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {images.length > 0 && (
        <Lightbox
          open={open}
          index={active}
          close={() => setOpen(false)}
          slides={images.map((src) => ({ src, alt }))}
          plugins={[Zoom]}
          controller={{ closeOnBackdropClick: true }}
          on={{ view: ({ index }) => setActive(index) }}
        />
      )}
    </div>
  );
}
