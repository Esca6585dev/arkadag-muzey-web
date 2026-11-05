"use client";
// Page block editor: ordered list of blocks ({id, type, settings}) with add / move / duplicate /
// remove, and a settings form per block type driven by block-schemas.ts.

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, t as tr } from "@/lib/utils";
import { TranslatableField, type TranslatableValue } from "../translatable-field";
import { ImageField } from "../image-field";
import { ImagesField } from "../images-field";
import { useConfirm } from "../confirm-dialog";
import { BLOCK_SCHEMAS, BLOCK_TYPES, knownKeys, type BlockField } from "./block-schemas";

export interface Block {
  id: string;
  type: string;
  settings: Record<string, unknown>;
}

type Settings = Record<string, unknown>;
const newId = (type: string) => `${type}-${Math.random().toString(36).slice(2, 8)}`;

function FieldInput({ f, value, onChange }: { f: BlockField; value: unknown; onChange: (v: unknown) => void }) {
  const t = useTranslations("admin");
  const label = <Label className="text-xs font-medium text-muted-foreground">{t(f.label)}</Label>;
  switch (f.t) {
    case "tr":
    case "trText":
    case "trRich":
      return (
        <div className="space-y-1.5 sm:col-span-2">
          {label}
          <TranslatableField kind={f.t === "tr" ? "input" : f.t === "trText" ? "textarea" : "rich"} rows={3} value={value as TranslatableValue} onChange={onChange} />
        </div>
      );
    case "bool":
      return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
          {label}
          <Switch checked={!!value} onCheckedChange={onChange} />
        </div>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          {label}
          <Input type="number" min={0} value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
        </div>
      );
    case "image":
      return (
        <div className="space-y-1.5">
          {label}
          <ImageField value={String(value ?? "")} onChange={onChange} allowUrl folder="pages" />
        </div>
      );
    case "images":
      return (
        <div className="space-y-1.5 sm:col-span-2">
          {label}
          <ImagesField value={(value as string[]) ?? []} onChange={onChange} folder="pages" />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1.5">
          {label}
          <Select value={String(value ?? f.options[0])} onValueChange={onChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "items":
      return <ItemsInput f={f} value={(value as Settings[]) ?? []} onChange={onChange} />;
    default:
      return (
        <div className="space-y-1.5">
          {label}
          <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
  }
}

function ItemsInput({ f, value, onChange }: { f: Extract<BlockField, { t: "items" }>; value: Settings[]; onChange: (v: Settings[]) => void }) {
  const t = useTranslations("admin");
  const set = (i: number, patch: Settings) => onChange(value.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const swap = (i: number, j: number) => {
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label className="text-xs font-medium text-muted-foreground">{t(f.label)}</Label>
      {value.map((item, i) => (
        <div key={i} className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
            <div className="flex">
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => swap(i, i - 1)} aria-label={t("form.moveUp")}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === value.length - 1} onClick={() => swap(i, i + 1)} aria-label={t("form.moveDown")}>
                <ArrowDown className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={t("form.removeBlock")}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {f.fields.map((sub) => (
              <FieldInput key={sub.k} f={sub} value={item[sub.k]} onChange={(v) => set(i, { [sub.k]: v })} />
            ))}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, {}])}>
        <Plus className="size-4" /> {t("form.addItem")}
      </Button>
    </div>
  );
}

/** Settings not covered by the schema, edited as JSON so nothing is lost. */
function ExtraJson({ block, onChange }: { block: Block; onChange: (s: Settings) => void }) {
  const t = useTranslations("admin");
  const known = knownKeys(block.type);
  const extra = Object.fromEntries(Object.entries(block.settings ?? {}).filter(([k]) => !known.has(k)));
  const [text, setText] = useState(() => JSON.stringify(extra, null, 2));
  const [bad, setBad] = useState(false);
  if (!Object.keys(extra).length && BLOCK_SCHEMAS[block.type]) return null;
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label className="text-xs font-medium text-muted-foreground">{t("blockFields.json")}</Label>
      <Textarea
        rows={4}
        className={cn("font-mono text-xs", bad && "border-destructive")}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value || "{}");
            const kept = Object.fromEntries(Object.entries(block.settings ?? {}).filter(([k]) => known.has(k)));
            onChange({ ...kept, ...parsed });
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
      />
    </div>
  );
}

export function BlockEditor({ value, onChange }: { value: Block[] | null | undefined; onChange: (v: Block[]) => void }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const blocks = value ?? [];
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const { confirm, dialog } = useConfirm();

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const update = (i: number, settings: Settings) => onChange(blocks.map((b, j) => (j === i ? { ...b, settings } : b)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = (type: string) => {
    const b: Block = { id: newId(type), type, settings: structuredClone(BLOCK_SCHEMAS[type]?.defaults ?? {}) };
    onChange([...blocks, b]);
    setOpen((prev) => new Set(prev).add(b.id));
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {dialog}
      {blocks.length === 0 && <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{t("blockFields.empty")}</p>}
      {blocks.map((b, i) => {
        const schema = BLOCK_SCHEMAS[b.type];
        const Icon = schema?.icon ?? Plus;
        const isOpen = open.has(b.id);
        const summary = tr(b.settings?.title as Record<string, string>, locale) || tr(b.settings?.label as Record<string, string>, locale);
        return (
          <div key={b.id} className="overflow-hidden rounded-xl border border-border/70 bg-background">
            <div className="flex items-center gap-2 p-2 pl-3">
              <button type="button" onClick={() => toggle(b.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t.has(`blocks.${b.type}`) ? t(`blocks.${b.type}`) : b.type}</span>
                  {summary && <span className="block truncate text-xs text-muted-foreground">{summary}</span>}
                </span>
                <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>
              <div className="flex shrink-0">
                <Button type="button" variant="ghost" size="icon" className="size-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("form.moveUp")}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} aria-label={t("form.moveDown")}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onChange([...blocks.slice(0, i + 1), { ...structuredClone(b), id: newId(b.type) }, ...blocks.slice(i + 1)])} aria-label={t("blockFields.duplicate")} title={t("blockFields.duplicate")}>
                  <Copy className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={async () => {
                    if (await confirm()) onChange(blocks.filter((_, j) => j !== i));
                  }}
                  aria-label={t("form.removeBlock")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            {isOpen && (
              <div className="grid gap-4 border-t border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
                {schema && schema.fields.length === 0 && <p className="text-sm text-muted-foreground sm:col-span-2">{t("blockFields.noSettings")}</p>}
                {schema?.fields.map((f) => (
                  <FieldInput key={f.k} f={f} value={b.settings?.[f.k]} onChange={(v) => update(i, { ...b.settings, [f.k]: v })} />
                ))}
                <ExtraJson block={b} onChange={(s) => update(i, s)} />
              </div>
            )}
          </div>
        );
      })}
      <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setAdding(true)}>
        <Plus className="size-4" /> {t("blockFields.addBlock")}
      </Button>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("blockFields.chooseBlock")}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {BLOCK_TYPES.map((type) => {
              const Icon = BLOCK_SCHEMAS[type].icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => add(type)}
                  className="flex items-center gap-3 rounded-xl border border-border/70 p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
                >
                  <Icon className="size-5 shrink-0 text-primary" />
                  {t(`blocks.${type}`)}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
