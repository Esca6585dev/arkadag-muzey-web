"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function NewsletterForm({ className, dark = true }: { className?: string; dark?: boolean }) {
  const t = useTranslations("footer");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("loading");
    try {
      await api.post("/public/subscribe", { email, locale });
      setState("done");
      toast.success(t("subscribed"));
    } catch (err) {
      setState("idle");
      toast.error(errorMessage(err).message);
    }
  }

  if (state === "done") {
    return (
      <p className={cn("flex items-center gap-2 text-sm", dark ? "text-sidebar-foreground" : "text-foreground", className)}>
        <Check className="size-4 text-accent" /> {t("subscribed")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn("flex gap-2", className)}>
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        className={cn("h-11 rounded-full px-4", dark && "border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:ring-accent")}
        aria-label={t("emailPlaceholder")}
      />
      <Button type="submit" disabled={state === "loading"} size="icon" className="size-11 shrink-0 rounded-full bg-accent text-accent-foreground hover:bg-accent/90" aria-label={t("subscribe")}>
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
