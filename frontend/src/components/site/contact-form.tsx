"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(5),
});
type Values = z.infer<typeof schema>;

export function ContactForm({ className }: { className?: string }) {
  const t = useTranslations("contact.form");
  const locale = useLocale();
  const { user } = useAuth();
  const [done, setDone] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", subject: "", message: "" },
  });

  async function onSubmit(values: Values) {
    try {
      await api.post("/public/contact", values, { locale });
      setDone(true);
      toast.success(t("success"));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 429) toast.error(t("tooMany"));
      else if (e instanceof ApiRequestError && e.fields) {
        for (const [k, v] of Object.entries(e.fields)) form.setError(k as keyof Values, { message: v });
      } else toast.error(t("error"));
    }
  }

  if (done) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-card p-10 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <p className="mt-4 text-lg font-medium">{t("success")}</p>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={className} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("name")} *</FormLabel>
                <FormControl>
                  <Input {...field} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")} *</FormLabel>
                <FormControl>
                  <Input type="email" {...field} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("phone")}</FormLabel>
                <FormControl>
                  <Input {...field} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("subject")}</FormLabel>
                <FormControl>
                  <Input {...field} className="h-11" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>{t("message")} *</FormLabel>
                <FormControl>
                  <Textarea rows={6} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="mt-6 rounded-full px-8">
          <Send className="size-4" />
          {form.formState.isSubmitting ? t("sending") : t("send")}
        </Button>
      </form>
    </Form>
  );
}
