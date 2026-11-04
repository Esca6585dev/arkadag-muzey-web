"use client";
// Contact message detail: sender info, message, reply + status (the reply is shown to the sender
// in their account area; no e-mail is sent).

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Mail, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "../page-header";
import { StatusBadge } from "../status-badge";
import { useConfirm } from "../confirm-dialog";
import { useDeleteResource, resourceKeys } from "../use-resource";
import { FormSkeleton } from "../crud/resource-form";

interface Message {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  reply: string;
  ip: string;
  locale: string;
  created_at: string;
}

export function MessageDetail({ id }: { id: number }) {
  const q = useQuery({ queryKey: resourceKeys.item("messages", id), queryFn: () => api.get<Message>(`/admin/messages/${id}`) });
  if (q.isLoading) return <FormSkeleton />;
  if (!q.data) return null;
  return <MessageView key={q.data.id} m={q.data} />;
}

function MessageView({ m }: { m: Message }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const [reply, setReply] = useState(m.reply ?? "");
  const [status, setStatus] = useState(m.status === "new" ? "read" : m.status);
  const [saving, setSaving] = useState(false);
  const del = useDeleteResource("messages");
  const { confirm, dialog } = useConfirm();

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/messages/${m.id}`, { reply, status: reply.trim() && status === "read" ? "replied" : status });
      toast.success(t("form.saved"));
      qc.invalidateQueries({ queryKey: resourceKeys.all("messages") });
      qc.invalidateQueries({ queryKey: ["admin", "messages", "unread-count"] });
      router.push("/admin/messages");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {dialog}
      <PageHeader
        title={m.subject || m.name}
        backHref="/admin/messages"
        backLabel={t("messages")}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-destructive"
            onClick={async () => {
              if (await confirm()) del.mutate(m.id, { onSuccess: () => router.push("/admin/messages") });
            }}
          >
            <Trash2 className="size-4" /> {tc("delete")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <StatusBadge status={m.status} />
              <span>{formatDate(m.created_at, locale, { dateStyle: "long", timeStyle: "short" })}</span>
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.message}</p>
          </section>
          <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <Label htmlFor="reply" className="mb-2 block">
              {t("form.reply")}
            </Label>
            <Textarea id="reply" rows={6} value={reply} onChange={(e) => setReply(e.target.value)} />
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40" aria-label={t("form.status")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["new", "read", "replied"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={save} disabled={saving} className="rounded-full">
                {t("kit.save")}
              </Button>
            </div>
          </section>
        </div>
        <aside className="h-fit space-y-3 rounded-2xl border border-border/70 bg-card p-5 text-sm shadow-sm">
          <p className="text-base font-semibold">{m.name}</p>
          <a href={`mailto:${m.email}`} className="flex items-center gap-2 text-primary hover:underline">
            <Mail className="size-4" /> {m.email}
          </a>
          {m.phone && (
            <a href={`tel:${m.phone}`} className="flex items-center gap-2 hover:underline">
              <Phone className="size-4" /> {m.phone}
            </a>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
            <dt>{t("form.language")}</dt>
            <dd className="uppercase">{m.locale || "—"}</dd>
            <dt>IP</dt>
            <dd className="font-mono">{m.ip || "—"}</dd>
          </dl>
        </aside>
      </div>
    </>
  );
}
