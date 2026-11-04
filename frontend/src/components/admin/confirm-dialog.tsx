"use client";
// Confirmation dialog. Use <ConfirmDialog> declaratively, or `const { confirm, dialog } = useConfirm()`
// and `if (await confirm({ title, description })) ...` imperatively (render `{dialog}` once).
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title?: ReactNode;
  description?: ReactNode;
  confirmText?: ReactNode;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText,
  destructive = true,
}: ConfirmOptions & { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  const t = useTranslations("admin.form");
  const tc = useTranslations("common");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("deleteConfirm")}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? t("deleteConfirmText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30")}
          >
            {confirmText ?? (destructive ? tc("delete") : tc("confirm"))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  const confirm = useCallback(
    (opts: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setState(opts);
      }),
    [],
  );

  const dialog = (
    <ConfirmDialog
      open={state !== null}
      onOpenChange={(o) => !o && close(false)}
      onConfirm={() => close(true)}
      {...(state ?? {})}
    />
  );
  return { confirm, dialog };
}
