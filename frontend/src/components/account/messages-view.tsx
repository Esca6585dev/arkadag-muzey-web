"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CornerDownRight, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { ContactMessage } from "@/lib/types";

const STATUS_CLASS: Record<ContactMessage["status"], string> = {
  new: "border-accent/40 bg-accent/10 text-accent",
  read: "border-border text-muted-foreground",
  replied: "border-primary/30 bg-primary-soft text-primary",
  archived: "border-border text-muted-foreground",
};

export function MessagesView() {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const locale = useLocale();
  const q = useQuery({ queryKey: ["user", "messages"], queryFn: () => api.get<ContactMessage[]>("/user/messages") });

  if (q.isLoading)
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  if (q.isError)
    return (
      <EmptyState
        title={t("loadError")}
        action={
          <Button variant="outline" className="rounded-full" onClick={() => void q.refetch()}>
            {tc("retry")}
          </Button>
        }
      />
    );
  const items = q.data ?? [];
  if (items.length === 0)
    return (
      <EmptyState
        icon={<Mail />}
        title={t("noMessages")}
        description={t("noMessagesText")}
        action={
          <Button asChild className="rounded-full">
            <Link href="/contact">{t("writeUs")}</Link>
          </Button>
        }
      />
    );

  return (
    <ul className="space-y-4">
      {items.map((m) => (
        <li key={m.id}>
          <article className="rounded-2xl border border-border/70 bg-card p-5">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="min-w-0 break-words font-display text-lg font-semibold">{m.subject || t("noSubject")}</h2>
              <Badge variant="outline" className={cn("shrink-0", STATUS_CLASS[m.status])}>
                {t(`status.${m.status}`)}
              </Badge>
            </header>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("sentOn")}: <time dateTime={m.created_at}>{formatDate(m.created_at, locale)}</time>
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{m.message}</p>
            {m.reply && (
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary-soft p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <CornerDownRight className="size-4" /> {t("reply")}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{m.reply}</p>
              </div>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
