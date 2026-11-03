"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  alt?: string;
  /** Wrapper class (position relative is applied automatically when `fill`). */
  wrapperClassName?: string;
  /** Placeholder style when no image is available. */
  fallbackClassName?: string;
  iconClassName?: string;
};

/**
 * Image with graceful fallback (ornamental placeholder) for missing/broken media.
 * Relative `/uploads/...` paths are served through the Next.js rewrite, so no host prefix is needed.
 */
export function SmartImage({ src, alt = "", className, wrapperClassName, fallbackClassName, iconClassName, fill, sizes, ...rest }: Props) {
  const [failed, setFailed] = useState(false);
  const show = !!src && !failed;

  if (!show) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-ornament bg-muted text-muted-foreground/50",
          fill ? "absolute inset-0" : "w-full",
          fallbackClassName,
          wrapperClassName,
        )}
        aria-hidden
      >
        <Landmark className={cn("size-10 opacity-60", iconClassName)} strokeWidth={1.2} />
      </div>
    );
  }

  const img = (
    <Image
      src={src as string}
      alt={alt}
      fill={fill}
      sizes={sizes ?? (fill ? "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" : undefined)}
      className={className}
      onError={() => setFailed(true)}
      unoptimized={(src as string).startsWith("http") && !(src as string).includes("localhost")}
      {...rest}
    />
  );
  if (wrapperClassName) {
    return <div className={cn(fill && "relative", wrapperClassName)}>{img}</div>;
  }
  return img;
}
