"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, differenceInCalendarDays } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import {
  buildTimelineRange,
  ceilToGranularity,
  floorToGranularity,
  type Granularity,
} from "@/lib/timeline";
import type { Priority, WorkStatus } from "@prisma/client";

type Item = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  typeColor: string;
  typeName: string | null;
  status: WorkStatus;
  priority: Priority;
  owner: { name: string | null; image: string | null } | null;
  href: string;
};

type ReleaseMarker = {
  id: string;
  name: string;
  version: string | null;
  plannedDate: string | null;
  productName: string;
  color: string;
};

const COL_WIDTH: Record<Granularity, number> = {
  week: 40,
  month: 100,
  quarter: 160,
  year: 240,
};

const LABEL_FMT: Record<Granularity, string> = {
  week: "MMM d",
  month: "MMM yyyy",
  quarter: "'Q'Q yyyy",
  year: "yyyy",
};

export function DashboardTimeline({
  granularity,
  products,
  types,
  filters,
  items,
  upcomingReleases,
}: {
  granularity: Granularity;
  products: Array<{ id: string; name: string }>;
  types: Array<{ id: string; name: string; color: string }>;
  filters: { productId: string; typeId: string };
  items: Item[];
  upcomingReleases: ReleaseMarker[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const today = new Date();
  const { columns, rangeStart, rangeEnd } = useMemo(() => {
    const starts = items
      .map((i) => new Date(i.startDate))
      .filter((d) => !isNaN(d.getTime()));
    const ends = items
      .map((i) => new Date(i.endDate))
      .filter((d) => !isNaN(d.getTime()));
    let min = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : today;
    let max = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : today;
    if (min > today) min = today;
    const pad = new Date(today);
    pad.setMonth(pad.getMonth() + 3);
    if (max < pad) max = pad;
    const rs = floorToGranularity(min, granularity);
    const re = ceilToGranularity(max, granularity);
    return {
      columns: buildTimelineRange(rs, re, granularity),
      rangeStart: rs,
      rangeEnd: re,
    };
  }, [items, granularity, today]);

  const width = columns.length * COL_WIDTH[granularity];
  const dayPx = width / Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart));

  function xFor(d: Date) {
    return Math.max(0, differenceInCalendarDays(d, rangeStart)) * dayPx;
  }

  function setParam(name: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set(name, value);
    else params.delete(name);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={granularity}
          onValueChange={(v) => setParam("g", v)}
        >
          <SelectTrigger className="h-8 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.productId || "all"}
          onValueChange={(v) => setParam("productId", v)}
        >
          <SelectTrigger className="h-8 w-[170px]">
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
          onValueChange={(v) => setParam("typeId", v)}
        >
          <SelectTrigger className="h-8 w-[170px]">
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

      <div className="overflow-x-auto rounded-md border">
        <div className="relative" style={{ width }}>
          <div className="flex border-b bg-muted/40 text-xs">
            {columns.map((c, i) => (
              <div
                key={i}
                className="shrink-0 border-r px-2 py-1.5 text-muted-foreground"
                style={{ width: COL_WIDTH[granularity] }}
              >
                {format(c, LABEL_FMT[granularity])}
              </div>
            ))}
          </div>

          <div
            className="pointer-events-none absolute top-0 z-10 border-l-2 border-primary/70"
            style={{ left: xFor(today), bottom: 0 }}
          >
            <div className="absolute left-0 top-0 -translate-x-1/2 rounded-sm bg-primary px-1 py-0.5 text-[9px] font-medium text-primary-foreground">
              Today
            </div>
          </div>

          {upcomingReleases.map((r) => {
            if (!r.plannedDate) return null;
            const d = new Date(r.plannedDate);
            return (
              <div
                key={r.id}
                className="pointer-events-none absolute top-7 z-[5] border-l-2"
                style={{
                  left: xFor(d),
                  bottom: 0,
                  borderColor: r.color,
                }}
                title={`${r.name}${r.version ? ` ${r.version}` : ""} — ${r.productName}`}
              />
            );
          })}

          <div className="relative py-2">
            {items.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No scheduled initiatives match these filters.
              </div>
            ) : (
              <div className="space-y-1.5 px-1">
                {items.map((it) => {
                  const start = new Date(it.startDate);
                  const end = new Date(it.endDate);
                  const left = xFor(start);
                  const rightX = Math.max(xFor(end) + dayPx, left + 24);
                  const w = Math.max(24, rightX - left);
                  return (
                    <Link
                      key={it.id}
                      href={it.href}
                      className="relative block h-7 rounded-md border text-[11px] shadow-sm transition hover:ring-2 hover:ring-ring"
                      style={{
                        marginLeft: left,
                        width: w,
                        backgroundColor: `${it.typeColor}22`,
                        borderColor: `${it.typeColor}80`,
                      }}
                      title={`${it.name} · ${STATUS_LABELS[it.status]}`}
                    >
                      <div className="flex h-full items-center gap-2 px-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: it.typeColor }}
                        />
                        <span className="truncate font-medium">{it.name}</span>
                        <span
                          className={cn(
                            "ml-auto shrink-0 rounded border px-1 py-px text-[9px]",
                            STATUS_COLORS[it.status],
                          )}
                        >
                          {STATUS_LABELS[it.status]}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
