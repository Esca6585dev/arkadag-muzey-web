"use client";
// Small shared helpers for the museum admin screens (halls, exhibits, events, slides).
import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { ImageIcon } from "lucide-react";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mediaUrl } from "@/lib/utils";

export function Thumb({ src, className = "h-10 w-14" }: { src?: string | null; className?: string }) {
  return (
    <div className={`${className} flex items-center justify-center overflow-hidden rounded-md border border-border/70 bg-muted text-muted-foreground`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(src)} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon className="size-4" />
      )}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}

export function SwitchField<T extends FieldValues>({ control, name, label, description }: { control: Control<T>; name: FieldPath<T>; label: ReactNode; description?: ReactNode }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between gap-4 space-y-0 rounded-xl border border-border/70 p-3">
          <div className="space-y-0.5">
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function SelectField<T extends FieldValues>({ control, name, label, options, placeholder }: {
  control: Control<T>; name: FieldPath<T>; label: ReactNode; options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={(field.value as string) ?? ""} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}


