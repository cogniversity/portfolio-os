"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KANBAN_COLUMNS, STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { PriorityBadge } from "@/components/work/priority-badge";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { moveCardAction } from "./actions";
import type { WorkStatus } from "@prisma/client";

type Person = { name: string | null; image: string | null } | null;

type StoryCard = {
  id: string;
  name: string;
  status: string;
  priority: string;
  epicId: string;
  epicName: string;
  assignee: Person;
  owner: Person;
};

type EpicCard = {
  id: string;
  name: string;
  status: string;
  priority: string;
  owner: Person;
};

type TaskCard = {
  id: string;
  name: string;
  status: string;
  priority: string;
  storyId: string;
  storyName: string;
  assignee: Person;
  owner: Person;
};

type AnyCard =
  | ({ _kind: "story" } & StoryCard)
  | ({ _kind: "epic" } & EpicCard)
  | ({ _kind: "task" } & TaskCard);

export function KanbanBoard({
  scope,
  kind,
  productId,
  releaseId,
  products,
  releases,
  stories,
  epics,
  tasks,
}: {
  scope: "product" | "release";
  kind: "story" | "epic" | "task";
  productId: string | null;
  releaseId: string | null;
  products: Array<{ id: string; name: string }>;
  releases: Array<{ id: string; name: string; version: string | null; productId: string }>;
  stories: StoryCard[];
  epics: EpicCard[];
  tasks: TaskCard[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [optim, setOptim] = useState<Record<string, WorkStatus>>({});
  const [pending, setPending] = useState(false);

  const baseCards: AnyCard[] = useMemo(() => {
    if (kind === "epic") return epics.map((e) => ({ _kind: "epic" as const, ...e }));
    if (kind === "task") return tasks.map((t) => ({ _kind: "task" as const, ...t }));
    return stories.map((s) => ({ _kind: "story" as const, ...s }));
  }, [kind, stories, epics, tasks]);

  const cards = useMemo(
    () =>
      baseCards.map((c) => ({
        ...c,
        status: (optim[c.id] as string | undefined) ?? c.status,
      })),
    [baseCards, optim],
  );

  const byColumn = useMemo(() => {
    const map: Record<string, AnyCard[]> = {};
    for (const col of KANBAN_COLUMNS) map[col] = [];
    for (const c of cards) {
      if (map[c.status]) map[c.status].push(c);
      else map[KANBAN_COLUMNS[0]].push(c);
    }
    return map;
  }, [cards]);

  const active = cards.find((c) => c.id === activeId) ?? null;

  function setParam(name: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    router.push(`/kanban?${params.toString()}`);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const to = e.over?.id ? String(e.over.id) : null;
    if (!to) return;
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    if (card.status === to) return;
    setOptim((m) => ({ ...m, [id]: to as WorkStatus }));
    setPending(true);
    const res = await moveCardAction({
      kind: card._kind,
      id,
      status: to as WorkStatus,
    });
    setPending(false);
    if (!res.ok) {
      toast.error("error" in res ? String(res.error) : "Failed to move");
      setOptim((m) => {
        const { [id]: _, ...rest } = m;
        return rest;
      });
      return;
    }
    router.refresh();
  }

  const filteredReleases = releases.filter(
    (r) => !productId || r.productId === productId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border bg-card/80 p-2 backdrop-blur">
        <Select value={scope} onValueChange={(v) => setParam("scope", v)}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="product">By Product</SelectItem>
            <SelectItem value="release">By Release</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={productId ?? undefined}
          onValueChange={(v) => setParam("productId", v)}
        >
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {scope === "release" && (
          <Select
            value={releaseId ?? undefined}
            onValueChange={(v) => setParam("releaseId", v)}
          >
            <SelectTrigger className="h-8 w-[220px]">
              <SelectValue placeholder="Release" />
            </SelectTrigger>
            <SelectContent>
              {filteredReleases.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                  {r.version ? ` ${r.version}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="mx-2 h-5 w-px bg-border" />

        <Select value={kind} onValueChange={(v) => setParam("kind", v)}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="story">Stories</SelectItem>
            <SelectItem value="epic">Epics</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
          </SelectContent>
        </Select>

        {pending && (
          <span className="text-xs text-muted-foreground">Saving…</span>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(240px, 1fr))` }}>
          {KANBAN_COLUMNS.map((col) => (
            <Column key={col} id={col} count={byColumn[col].length}>
              {byColumn[col].map((c) => (
                <CardItem key={c.id} card={c} />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay>
          {active && <CardItem card={active} overlay />}
        </DragOverlay>
      </DndContext>

      {cards.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No items for this scope.
        </div>
      )}
    </div>
  );
}

function Column({
  id,
  count,
  children,
}: {
  id: WorkStatus;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-[calc(100vh-240px)] min-h-[400px] flex-col rounded-md border bg-muted/30 p-2 transition",
        isOver && "ring-2 ring-primary/60",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
              STATUS_COLORS[id],
            )}
          >
            {STATUS_LABELS[id]}
          </span>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function CardItem({ card, overlay }: { card: AnyCard; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
  });
  const href =
    card._kind === "story"
      ? `/stories/${card.id}`
      : card._kind === "epic"
        ? `/epics/${card.id}`
        : `/stories/${(card as TaskCard).storyId}`;
  const parentLabel =
    card._kind === "story"
      ? (card as StoryCard).epicName
      : card._kind === "task"
        ? (card as TaskCard).storyName
        : null;
  const person: Person =
    card._kind === "epic"
      ? (card as EpicCard).owner
      : (card as StoryCard | TaskCard).assignee ?? (card as StoryCard | TaskCard).owner;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group cursor-grab rounded-md border bg-card p-2.5 shadow-sm transition hover:border-primary/40 hover:shadow",
        (isDragging || overlay) && "opacity-90 ring-2 ring-primary/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={href}
          className="line-clamp-2 text-sm font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {card.name}
        </Link>
        <PriorityBadge priority={card.priority as "P0" | "P1" | "P2" | "P3"} />
      </div>
      {parentLabel && (
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          {parentLabel}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {card._kind}
        </span>
        {person && <OwnerAvatar name={person.name} image={person.image} />}
      </div>
    </div>
  );
}
