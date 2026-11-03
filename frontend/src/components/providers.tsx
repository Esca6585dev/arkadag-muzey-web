"use client";

import { useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import type { User } from "@/lib/types";

export function Providers({
  children,
  initialUser,
  defaultTheme = "system",
}: {
  children: ReactNode;
  initialUser?: User | null;
  defaultTheme?: string;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={initialUser ?? null}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
