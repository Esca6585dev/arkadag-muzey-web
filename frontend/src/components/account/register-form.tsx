"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/account/password-input";
import { ApiRequestError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const schema = z
  .object({
    name: z.string().min(2, "nameRequired"),
    email: z.string().email("emailInvalid"),
    phone: z.string().optional(),
    password: z.string().min(8, "passwordMin"),
    confirm: z.string(),
    locale: z.enum(["tk", "ru", "en"]),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "passwordMismatch" });
type Values = z.infer<typeof schema>;

export const LOCALE_NAMES: Record<string, string> = { tk: "Türkmençe", ru: "Русский", en: "English" };

export function RegisterForm() {
  const t = useTranslations("auth");
  const ta = useTranslations("account");
  const locale = useLocale() as Values["locale"];
  const router = useRouter();
  const { register } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirm: "", locale },
  });
  const msg = (m?: string) => (m ? t(m as "emailInvalid") : undefined);

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const user = await register({ name: values.name, email: values.email, password: values.password, phone: values.phone || undefined, locale: values.locale });
      toast.success(t("welcome", { name: user.name }));
      router.push("/account");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        if (e.status === 403) setFormError(t("registrationDisabled"));
        else if (e.fields && Object.keys(e.fields).length) {
          for (const [k, v] of Object.entries(e.fields)) if (k in values) form.setError(k as keyof Values, { message: v });
        } else setFormError(e.message || t("error"));
      } else setFormError(t("error"));
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {formError && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {formError}
          </div>
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("name")}</FormLabel>
              <FormControl>
                <Input autoComplete="name" className="h-11" {...field} />
              </FormControl>
              <FormMessage>{msg(form.formState.errors.name?.message)}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" className="h-11" {...field} />
              </FormControl>
              <FormMessage>{msg(form.formState.errors.email?.message)}</FormMessage>
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("phone")} <span className="font-normal text-muted-foreground">({ta("phoneHelp").toLowerCase()})</span>
                </FormLabel>
                <FormControl>
                  <Input type="tel" autoComplete="tel" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{ta("language")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(LOCALE_NAMES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("password")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage>{msg(form.formState.errors.password?.message)}</FormMessage>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("confirmPassword")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage>{msg(form.formState.errors.confirm?.message)}</FormMessage>
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="mt-2 h-11 w-full rounded-full">
          {form.formState.isSubmitting ? <Spinner size="sm" /> : <UserPlus className="size-4" />}
          {form.formState.isSubmitting ? t("registering") : t("register")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("orSignIn")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
