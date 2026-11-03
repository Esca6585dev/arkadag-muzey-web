"use client";

import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

function ics(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function AddToCalendar({ title, description, location, startsAt, endsAt, url, label }: { title: string; description?: string; location?: string; startsAt: string; endsAt?: string | null; url?: string; label: string }) {
  function download() {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 2 * 3600 * 1000);
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Arkadag Museum//Events//EN",
      "BEGIN:VEVENT",
      `UID:${start.getTime()}-${Math.random().toString(36).slice(2)}@arkadag-museum`,
      `DTSTAMP:${ics(new Date())}`,
      `DTSTART:${ics(start)}`,
      `DTEND:${ics(end)}`,
      `SUMMARY:${esc(title)}`,
      description ? `DESCRIPTION:${esc(description)}` : "",
      location ? `LOCATION:${esc(location)}` : "",
      url ? `URL:${url}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
    const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "event.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
  return (
    <Button type="button" onClick={download} className="rounded-full">
      <CalendarPlus className="size-4" />
      {label}
    </Button>
  );
}
