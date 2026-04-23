"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  date: string;
  kind: "release" | "initiative-start" | "initiative-target" | "custom-date";
  label: string;
  href: string;
  color: string;
  secondary?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  year,
  month,
  products,
  types,
  filters,
  events,
}: {
  year: number;
  month: number;
  products: Array<{ id: string; name: string }>;
  types: Array<{ id: string; name: string; key: string; color: string }>;
  filters: { productId: string; typeId: string };
  events: Event[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const first = new Date(year, month, 1);
  const monthStart = startOfMonth(first);
  const monthEnd = endOfMonth(first);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, Event[]>();
    for (const e of events) {
      const d = new Date(e.date);
      const key = format(d, "yyyy-MM-dd");
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      m.set(k, arr);
    }
    return m;
  }, [events]);

  function setParams(patch: Record<string, string | number | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    router.push(`/calendar?${params.toString()}`);
  }

  function goto(delta: number) {
    const d = new Date(year, month + delta, 1);
    setParams({ y: d.getFullYear(), m: d.getMonth() });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-card/80 p-2 backdrop-blur">
        <Button variant="outline" size="sm" onClick={() => goto(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-[160px] text-center text-sm font-semibold">
          {format(first, "MMMM yyyy")}
        </div>
        <Button variant="outline" size="sm" onClick={() => goto(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const t = new Date();
            setParams({ y: t.getFullYear(), m: t.getMonth() });
          }}
        >
          Today
        </Button>

        <div className="mx-2 h-5 w-px bg-border" />

        <Select
          value={filters.productId || "all"}
          onValueChange={(v) => setParams({ productId: v === "all" ? null : v })}
        >
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.typeId || "all"}
          onValueChange={(v) => setParams({ typeId: v === "all" ? null : v })}
        >
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, first);
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={key}
                className={cn(
                  "min-h-[120px] border-b border-r p-1.5",
                  !inMonth && "bg-muted/20 text-muted-foreground",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday && "bg-primary text-primary-foreground font-semibold",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 4).map((e) => (
                    <Link
                      key={e.id}
                      href={e.href}
                      className="group block truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition hover:ring-1 hover:ring-ring"
                      style={{
                        backgroundColor: `${e.color}20`,
                        color: e.color,
                        borderLeft: `3px solid ${e.color}`,
                      }}
                      title={`${e.label}${e.secondary ? ` · ${e.secondary}` : ""}`}
                    >
                      {e.label}
                    </Link>
                  ))}
                  {dayEvents.length > 4 && (
                    <div className="px-1.5 text-[10px] text-muted-foreground">
                      +{dayEvents.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <LegendDot color="#6366f1" label="Release / Initiative" />
        <LegendDot color="#10b981" label="Released (actual)" />
        <LegendDot color="#8b5cf6" label="Custom date (demo / event / PoV)" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
