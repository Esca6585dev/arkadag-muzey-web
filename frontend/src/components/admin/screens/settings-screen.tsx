"use client";
// Site settings grouped in tabs. Each setting is edited by its `type`; Save sends only changed
// values (PUT /admin/settings, admin role). Editors can view but not save.

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { PageHeader } from "../page-header";
import { TranslatableField, type TranslatableValue } from "../translatable-field";
import { ImageField } from "../image-field";
import { useUnsavedChangesWarning } from "../resource-form-layout";

interface Setting {
  id: number;
  key: string;
  value: unknown;
  group: string;
  type: string;
  label: string;
  options: { label: string; value: string }[] | null;
  is_public: boolean;
}
interface Group {
  group: string;
  settings: Setting[];
}

type Stat = { value?: string | number; suffix?: string; label?: TranslatableValue };

function StatsEditor({ value, onChange }: { value: Stat[]; onChange: (v: Stat[]) => void }) {
  const t = useTranslations("admin");
  const set = (i: number, patch: Partial<Stat>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-3">
      {value.map((s, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-border/70 p-3 sm:grid-cols-[110px_90px_minmax(0,1fr)_auto] sm:items-start">
          <Input value={String(s.value ?? "")} onChange={(e) => set(i, { value: e.target.value })} placeholder="352" aria-label={t("form.value")} />
          <Input value={s.suffix ?? ""} onChange={(e) => set(i, { suffix: e.target.value })} placeholder="+" aria-label="suffix" />
          <TranslatableField kind="input" value={s.label} onChange={(v) => set(i, { label: v })} />
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={t("form.removeBlock")}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { value: "", suffix: "", label: {} }])}>
        <Plus className="size-4" /> {t("form.addItem")}
      </Button>
    </div>
  );
}

function JsonEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [error, setError] = useState(false);
  return (
    <Textarea
      rows={8}
      className={`font-mono text-xs ${error ? "border-destructive" : ""}`}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        try {
          onChange(JSON.parse(e.target.value));
          setError(false);
        } catch {
          setError(true);
        }
      }}
    />
  );
}

function SettingInput({ s, value, onChange, disabled }: { s: Setting; value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  switch (s.type) {
    case "translatable":
      return <TranslatableField kind="input" value={value as TranslatableValue} onChange={onChange} disabled={disabled} />;
    case "translatable_textarea":
      return <TranslatableField kind="textarea" rows={4} value={value as TranslatableValue} onChange={onChange} disabled={disabled} />;
    case "textarea":
      return <Textarea rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
    case "bool":
      return <Switch checked={!!value} onCheckedChange={onChange} disabled={disabled} />;
    case "number":
      return <Input type="number" className="max-w-40" value={String(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} />;
    case "image":
      return <ImageField value={String(value ?? "")} onChange={onChange} aspect="3/1" allowUrl folder="settings" disabled={disabled} />;
    case "color":
      return (
        <div className="flex items-center gap-2">
          <input type="color" className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent" value={String(value ?? "#000000")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
          <Input className="max-w-32 font-mono" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
        </div>
      );
    case "select":
      return (
        <Select value={String(value ?? "")} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(s.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "json":
      if (s.key === "home.stats" && Array.isArray(value)) return <StatsEditor value={value as Stat[]} onChange={onChange} />;
      return <JsonEditor value={value} onChange={onChange} />;
    default:
      return <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
  }
}

export function SettingsScreen() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api.get<Group[]>("/admin/settings") });
  if (q.isLoading || !q.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  return <SettingsForm key={q.dataUpdatedAt} groups={q.data} />;
}

function SettingsForm({ groups }: { groups: Group[] }) {
  const t = useTranslations("admin");
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const initial = useMemo(() => Object.fromEntries(groups.flatMap((g) => g.settings.map((s) => [s.key, s.value]))), [groups]);
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [saving, setSaving] = useState(false);
  const changed = Object.keys(values).filter((k) => JSON.stringify(values[k]) !== JSON.stringify(initial[k]));
  useUnsavedChangesWarning(changed.length > 0);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/admin/settings", { values: Object.fromEntries(changed.map((k) => [k, values[k]])) });
      toast.success(t("form.saved"));
      await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const groupLabel = (g: string) => (t.has(`settingsGroups.${g}`) ? t(`settingsGroups.${g}`) : g);

  return (
    <>
      <PageHeader
        title={t("settings")}
        actions={
          <Button onClick={save} disabled={!isAdmin || saving || changed.length === 0} className="rounded-full">
            <Save className="size-4" /> {t("kit.save")}
            {changed.length > 0 && <span className="rounded-full bg-primary-foreground/20 px-1.5 text-xs">{changed.length}</span>}
          </Button>
        }
      />
      <Tabs defaultValue={groups[0]?.group}>
        <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {groups.map((g) => (
            <TabsTrigger key={g.group} value={g.group} className="flex-none">
              {groupLabel(g.group)}
            </TabsTrigger>
          ))}
        </TabsList>
        {groups.map((g) => (
          <TabsContent key={g.group} value={g.group}>
            <div className="divide-y divide-border/70 rounded-2xl border border-border/70 bg-card shadow-sm">
              {g.settings.map((s) => (
                <div key={s.key} className="grid gap-3 p-5 md:grid-cols-[260px_minmax(0,1fr)]">
                  <div>
                    <Label className="text-sm font-medium">{s.label || s.key}</Label>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{s.key}</p>
                  </div>
                  <SettingInput s={s} value={values[s.key]} onChange={(v) => setValues((prev) => ({ ...prev, [s.key]: v }))} disabled={!isAdmin} />
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
