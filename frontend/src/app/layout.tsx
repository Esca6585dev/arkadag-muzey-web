import type { ReactNode } from "react";
import "./globals.css";

// The real <html>/<body> live in app/[locale]/layout.tsx so the lang attribute is correct.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
