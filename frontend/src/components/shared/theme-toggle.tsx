"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, variant = "ghost" }: { className?: string; variant?: "ghost" | "outline" }) {
  const t = useTranslations("common");
  const { theme, setTheme, resolvedTheme } = useTheme();
  // false during SSR and hydration, true afterwards (the resolved theme is only known on the client)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const Icon = !mounted ? Sun : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="icon" className={cn("rounded-full", className)} aria-label={t("theme")}>
          <Icon className="size-[1.1rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {(
          [
            ["light", Sun, t("light")],
            ["dark", Moon, t("dark")],
            ["system", Monitor, t("system")],
          ] as const
        ).map(([value, I, label]) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)} className={cn(theme === value && "bg-accent-soft text-foreground")}>
            <I className="size-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
