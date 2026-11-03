"use client";

import { useState } from "react";
import { Check, Link2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FacebookIcon } from "@/components/shared/brand-icons";
import { Button } from "@/components/ui/button";

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
