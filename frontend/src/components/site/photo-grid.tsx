"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import { SmartImage } from "@/components/shared/smart-image";
import { cn } from "@/lib/utils";

export interface PhotoItem {
  src: string;
  caption?: string;
}

export function PhotoGrid({ images, variant = "grid", alt = "", className }: { images: PhotoItem[]; variant?: "masonry" | "grid"; alt?: string; className?: string }) {
  const [index, setIndex] = useState(-1);
  if (!images.length) return null;

  return (
    <>
      <ul className={cn(variant === "masonry" ? "columns-2 gap-3 sm:gap-4 lg:columns-3 xl:columns-4" : "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3", className)}>
        {images.map((img, i) => (
          <li key={`${img.src}-${i}`} className={cn(variant === "masonry" && "mb-3 break-inside-avoid sm:mb-4")}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={img.caption || `${alt} ${i + 1}`}
              className="group relative block w-full overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              {variant === "masonry" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.src} alt={img.caption || alt} loading="lazy" className="h-auto w-full transition duration-500 group-hover:scale-[1.03]" />
              ) : (
                <SmartImage src={img.src} alt={img.caption || alt} fill wrapperClassName="relative aspect-[4/3]" className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width: 768px) 50vw, 33vw" />
              )}
              <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={images.map((i) => ({ src: i.src, alt: i.caption || alt, description: i.caption }))}
        plugins={[Zoom, Captions]}
        controller={{ closeOnBackdropClick: true }}
      />
    </>
  );
}
