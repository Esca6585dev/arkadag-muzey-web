"use client";

import { useState } from "react";
import { Check, Link2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// lucide-react no longer ships brand icons, so the Facebook mark is inlined.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8.2v3h2.5V21h2.8z" />
    </svg>
  );
}

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations("news");
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const ti = encodeURIComponent(title);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-muted-foreground">{t("shareArticle")}</span>
      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={copy} aria-label={t("copyLink")} title={t("copyLink")}>
        {copied ? <Check className="size-4 text-primary" /> : <Link2 className="size-4" />}
      </Button>
      <Button asChild variant="outline" size="icon" className="rounded-full">
        <a href={`https://t.me/share/url?url=${u}&text=${ti}`} target="_blank" rel="noopener noreferrer" aria-label={t("shareTelegram")} title={t("shareTelegram")}>
          <Send className="size-4" />
        </a>
      </Button>
      <Button asChild variant="outline" size="icon" className="rounded-full">
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noopener noreferrer" aria-label={t("shareFacebook")} title={t("shareFacebook")}>
          <FacebookIcon className="size-4" />
        </a>
      </Button>
    </div>
  );
}
