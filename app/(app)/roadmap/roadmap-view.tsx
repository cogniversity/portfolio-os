"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  addDays,
  addQuarters,
  differenceInCalendarDays,
  endOfQuarter,
  format,
  startOfQuarter,
} from "date-fns";
import { Rocket } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import { PriorityBadge } from "@/components/work/priority-badge";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import {
  advanceGranularity,
  buildTimelineRange,
  floorToGranularity,
  type Granularity,
} from "@/lib/timeline";
import type { Priority, ReleaseStatus, WorkStatus } from "@prisma/client";
import { TimelineShiftModal } from "./timeline-shift-modal";
import { previewShiftAction, type SerializedImpact } from "./actions";

type Product = { id: string; name: string; color: string | null };
type TypeDef = { id: string; key: string; name: string; color: string };

type EpicRow = {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  status: WorkStatus;
  priority: Priority;
  owner: { name: string | null; image: string | null } | null;
};

type InitiativeRow = {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  status: WorkStatus;
  priority: Priority;
  productIds: string[];
  typeColor: string;
  typeName: string | undefined;
  owner: { name: string | null; image: string | null } | null;
  epics: EpicRow[];
};

type ReleaseMarker = {
  id: string;
  name: string;
  version: string | null;
  plannedDate: Date | null;
  productId: string;
  productName: string;
  status: ReleaseStatus;
};

const COL_WIDTH: Record<Granularity, number> = {
  week: 48,
  month: 120,
  quarter: 200,
  year: 300,
};

const LABEL_FMT: Record<Granularity, string> = {
  week: "MMM d",
  month: "MMM yyyy",
  quarter: "'Q'Q yyyy",
  year: "yyyy",
};

export function RoadmapView({
  granularity,
  filters,
  products,
  types,
  owners,
  initiatives,
  releases,
  canEdit,
  embedPath,
  timeWindow = "auto",
  hideProductFilter = false,
}: {
  granularity: Granularity;
  filters: { productId: string; typeId: string; ownerId: string; status: string };
  products: Product[];
  types: TypeDef[];
  owners: Array<{ id: string; name: string | null }>;
  initiatives: InitiativeRow[];
  releases: ReleaseMarker[];
  canEdit: boolean;
  /** When set, filter/granularity changes navigate with this path’s query (e.g. /products/xyz). */
  embedPath?: string;
  /** auto: time span from data. threeQuarters: previous, current, and next calendar quarter (only when granularity is quarter). */
  timeWindow?: "auto" | "threeQuarters";
  /** Hide the product filter (e.g. product tab where scope is fixed). */
  hideProductFilter?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingImpact, setPendingImpact] = useState<{
    impact: SerializedImpact;
    proposed: {
      kind: "initiative" | "epic" | "story";
      id: string;
      newStart: string | null;
      newEnd: string | null;
    };
  } | null>(null);

  // Time range: three-quarters window, or earliest→latest from data with padding
  const { range, today } = useMemo(() => {
    const now = new Date();
    if (timeWindow === "threeQuarters" && granularity === "quarter") {
      const start = startOfQuarter(addQuarters(now, -1));
      const end = endOfQuarter(addQuarters(now, 1));
      return {
        range: buildTimelineRange(start, end, granularity),
        today: now,
      };
    }
    const all = [
      ...initiatives.flatMap((i) => [i.startDate, i.endDate]),
      ...initiatives.flatMap((i) => i.epics.flatMap((e) => [e.startDate, e.endDate])),
      ...releases.map((r) => r.plannedDate),
    ].filter(Boolean) as Date[];
    const min =
      all.length > 0
        ? new Date(Math.min(...all.map((d) => d.getTime())))
        : addDays(now, -14);
    const max =
      all.length > 0
        ? new Date(Math.max(...all.map((d) => d.getTime())))
        : addDays(now, 90);
    const padded = {
      start: addDays(min, -14),
      end: addDays(max, 14),
    };
    return {
      range: buildTimelineRange(padded.start, padded.end, granularity),
      today: now,
    };
  }, [initiatives, releases, granularity, timeWindow]);

  const totalWidth = range.length * COL_WIDTH[granularity];

  function xForDate(d: Date | null): number | null {
    if (!d || range.length === 0) return null;
    const first = range[0];
    const end = advanceGranularity(range[range.length - 1], granularity);
    const totalDays = differenceInCalendarDays(end, first);
    const dayOffset = differenceInCalendarDays(d, first);
    return (dayOffset / totalDays) * totalWidth;
  }

  function dateForX(x: number): Date {
    const first = range[0];
    const end = advanceGranularity(range[range.length - 1], granularity);
    const totalDays = differenceInCalendarDays(end, first);
    const pct = Math.max(0, Math.min(1, x / totalWidth));
    const days = Math.round(pct * totalDays);
    return addDays(first, days);
  }

  function updateFilter(k: string, v: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (v && v !== "__all") params.set(k, v);
    else params.delete(k);
    const base = embedPath ?? "/roadmap";
    router.push(`${base}?${params.toString()}`);
  }

  async function handleDragEnd(
    kind: "initiative" | "epic",
    id: string,
    origStart: Date | null,
    origEnd: Date | null,
    dx: number,
  ) {
    if (!canEdit || !origStart || !origEnd) return;
    const daysShift = Math.round((dx / totalWidth) * differenceInCalendarDays(
      advanceGranularity(range[range.length - 1], granularity),
      range[0],
    ));
    if (daysShift === 0) return;
    const newStart = addDays(origStart, daysShift);
    const newEnd = addDays(origEnd, daysShift);
    const snappedStart = floorToGranularity(newStart, granularity);
    const snappedEnd = addDays(snappedStart, differenceInCalendarDays(newEnd, newStart));
    const res = await previewShiftAction({
      kind,
      id,
      newStart: snappedStart.toISOString(),
      newEnd: snappedEnd.toISOString(),
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPendingImpact({
      impact: res.impact,
      proposed: {
        kind,
        id,
        newStart: snappedStart.toISOString(),
        newEnd: snappedEnd.toISOString(),
      },
    });
  }

  return (
    <>
      <div
        className={cn(
          "sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-background/95 py-3 backdrop-blur",
          embedPath ? "px-3" : "px-6",
        )}
      >
        {!hideProductFilter ? (
        <Filter
          label="Product"
          value={filters.productId}
          onChange={(v) => updateFilter("productId", v)}
          options={[
            { value: "__all", label: "All products" },
            ...products.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        ) : null}
        <Filter
          label="Type"
          value={filters.typeId}
          onChange={(v) => updateFilter("typeId", v)}
          options={[
            { value: "__all", label: "All types" },
            ...types.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        <Filter
          label="Owner"
          value={filters.ownerId}
          onChange={(v) => updateFilter("ownerId", v)}
          options={[
            { value: "__all", label: "All owners" },
            ...owners.map((o) => ({ value: o.id, label: o.name ?? "—" })),
          ]}
        />
        <Filter
          label="Status"
          value={filters.status}
          onChange={(v) => updateFilter("status", v)}
          options={[
            { value: "__all", label: "All statuses" },
            ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          ]}
        />
        <div className="ml-auto flex gap-1 rounded-md border p-0.5">
          {(["week", "month", "quarter", "year"] as const).map((g) => (
            <Button
              key={g}
              size="sm"
              variant={granularity === g ? "default" : "ghost"}
              className="h-7 px-3 text-xs capitalize"
              onClick={() => updateFilter("g", g)}
            >
              {g}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="flex">
          <div className="sticky left-0 z-10 w-72 shrink-0 border-r bg-card">
            <div className="h-10 border-b" />
            {groupByProduct(initiatives, products).map(({ product, initiatives }) => (
              <div key={product?.id ?? "no-product"}>
                <div className="sticky-product flex h-8 items-center gap-2 border-b bg-muted/40 px-3 text-xs font-medium">
                  {product?.color && (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: product.color }}
                    />
                  )}
                  {product?.name ?? "Unassigned"}
                </div>
                {initiatives.map((i) => (
                  <div key={i.id}>
                    <div className="flex h-10 items-center gap-2 border-b px-3 text-sm">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: i.typeColor }}
                      />
                      <PriorityBadge priority={i.priority} />
                      <Link
                        href={
                          i.id.startsWith("epic:")
                            ? `/epics/${i.id.slice("epic:".length)}`
                            : `/initiatives/${i.id}`
                        }
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {i.name}
                      </Link>
                      <OwnerAvatar name={i.owner?.name} image={i.owner?.image} />
                    </div>
                    {i.epics.map((e) => (
                      <div
                        key={e.id}
                        className="flex h-8 items-center gap-2 border-b bg-muted/10 pl-8 pr-3 text-xs text-muted-foreground"
                      >
                        <Link
                          href={`/epics/${e.id}`}
                          className="min-w-0 flex-1 truncate hover:underline"
                        >
                          {e.name}
                        </Link>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="relative" style={{ width: totalWidth }}>
            <div className="flex h-10 border-b bg-muted/30">
              {range.map((bucket) => (
                <div
                  key={bucket.toISOString()}
                  className="border-r px-2 text-xs font-medium text-muted-foreground"
                  style={{ width: COL_WIDTH[granularity] }}
                >
                  <div className="py-1">{format(bucket, LABEL_FMT[granularity])}</div>
                </div>
              ))}
            </div>
            <div className="relative">
              {groupByProduct(initiatives, products).map(({ product, initiatives }) => (
                <div key={product?.id ?? "no-product"}>
                  <div className="h-8 border-b bg-muted/10" />
                  {initiatives.map((i) => (
                    <div key={i.id}>
                      <div className="relative h-10 border-b">
                        <GridCells count={range.length} width={COL_WIDTH[granularity]} />
                        {i.startDate && i.endDate && (
                          <DraggableBar
                            x={xForDate(i.startDate)!}
                            width={Math.max(
                              6,
                              xForDate(i.endDate)! - xForDate(i.startDate)!,
                            )}
                            color={i.typeColor}
                            status={i.status}
                            label={i.name}
                            onDragEnd={(dx) =>
                              i.id.startsWith("epic:")
                                ? handleDragEnd(
                                    "epic",
                                    i.id.slice("epic:".length),
                                    i.startDate,
                                    i.endDate,
                                    dx,
                                  )
                                : handleDragEnd(
                                    "initiative",
                                    i.id,
                                    i.startDate,
                                    i.endDate,
                                    dx,
                                  )
                            }
                            canEdit={canEdit}
                          />
                        )}
                      </div>
                      {i.epics.map((e) => (
                        <div key={e.id} className="relative h-8 border-b bg-muted/5">
                          <GridCells count={range.length} width={COL_WIDTH[granularity]} />
                          {e.startDate && e.endDate && (
                            <DraggableBar
                              x={xForDate(e.startDate)!}
                              width={Math.max(
                                6,
                                xForDate(e.endDate)! - xForDate(e.startDate)!,
                              )}
                              color={i.typeColor}
                              status={e.status}
                              label={e.name}
                              height={18}
                              onDragEnd={(dx) =>
                                handleDragEnd("epic", e.id, e.startDate, e.endDate, dx)
                              }
                              canEdit={canEdit}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              {/* Today line */}
              {xForDate(today) !== null && (
                <div
                  className="pointer-events-none absolute top-0 h-full border-l-2 border-destructive/70"
                  style={{ left: xForDate(today)! }}
                >
                  <div className="absolute -top-0 -translate-x-1/2 rounded-b bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    today
                  </div>
                </div>
              )}
              {/* Release markers */}
              {releases
                .filter((r) => r.plannedDate)
                .map((r) => (
                  <div
                    key={r.id}
                    className="pointer-events-none absolute top-0 h-full"
                    style={{ left: xForDate(r.plannedDate) ?? 0 }}
                  >
                    <div className="h-full w-px bg-primary/50" />
                    <div className="pointer-events-auto absolute left-1 top-1 flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/25">
                      <Link href={`/releases/${r.id}`} className="flex items-center gap-1">
                        <Rocket className="h-3 w-3" />
                        {r.name}
                        {r.version && <span>{r.version}</span>}
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {pendingImpact && (
        <TimelineShiftModal
          impact={pendingImpact.impact}
          proposed={pendingImpact.proposed}
          onClose={() => setPendingImpact(null)}
          onApplied={() => {
            setPendingImpact(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value || "__all"} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function GridCells({ count, width }: { count: number; width: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-r border-border/50" style={{ width }} />
      ))}
    </div>
  );
}

function DraggableBar({
  x,
  width,
  color,
  status,
  label,
  height = 22,
  onDragEnd,
  canEdit,
}: {
  x: number;
  width: number;
  color: string;
  status: WorkStatus;
  label: string;
  height?: number;
  onDragEnd: (dx: number) => void;
  canEdit: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [dx, setDx] = useState(0);

  function onMouseDown(e: React.MouseEvent) {
    if (!canEdit) return;
    e.preventDefault();
    const startX = e.clientX;
    let currentDx = 0;
    const move = (ev: MouseEvent) => {
      currentDx = ev.clientX - startX;
      setDx(currentDx);
      setDragging(true);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (Math.abs(currentDx) > 2) {
        onDragEnd(currentDx);
      }
      setDragging(false);
      setDx(0);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "absolute top-1/2 flex -translate-y-1/2 select-none items-center gap-1 overflow-hidden rounded border-l-4 px-2 text-[11px] font-medium text-white shadow-sm transition-transform",
        dragging ? "cursor-grabbing ring-2 ring-primary" : canEdit ? "cursor-grab" : "cursor-default",
        STATUS_COLORS[status],
      )}
      style={{
        left: x + dx,
        width,
        height,
        borderLeftColor: color,
        background: `linear-gradient(90deg, ${color}cc, ${color}88)`,
      }}
      title={label}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}

function groupByProduct(initiatives: InitiativeRow[], products: Product[]) {
  const byId = new Map<string, { product: Product | null; initiatives: InitiativeRow[] }>();
  for (const p of products) byId.set(p.id, { product: p, initiatives: [] });
  byId.set("__none", { product: null, initiatives: [] });
  for (const i of initiatives) {
    const pid = i.productIds[0] ?? "__none";
    const g = byId.get(pid) ?? byId.get("__none")!;
    g.initiatives.push(i);
  }
  return Array.from(byId.values()).filter((g) => g.initiatives.length > 0);
}
