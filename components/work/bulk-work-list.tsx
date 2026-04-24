"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { bulkUpdateEpics } from "@/app/(app)/epics/actions";
import { bulkUpdateStories } from "@/app/(app)/stories/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OwnerAvatar } from "./owner-avatar";
import { PriorityBadge } from "./priority-badge";
import { StatusBadge } from "./status-badge";
import { formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_ORDER, PRIORITY_LABELS, PRIORITY_ORDER } from "@/lib/constants";
import type { WorkItemRowData } from "./work-item-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Priority, WorkStatus } from "@prisma/client";

type UserOpt = { id: string; name: string | null; email: string };

export function BulkWorkList(
  props:
    | (
        | { kind: "story"; epicId: string; items: WorkItemRowData[]; users: UserOpt[]; canBulk: boolean }
        | { kind: "story"; initiativeId: string; items: WorkItemRowData[]; users: UserOpt[]; canBulk: boolean }
      )
    | {
        kind: "epic";
        items: WorkItemRowData[];
        users: UserOpt[];
        canBulk: boolean;
        initiativeId?: string;
        productId?: string;
      },
) {
  if (!props.canBulk || props.items.length === 0) {
    return <PlainList items={props.items} />;
  }

  return props.kind === "story" ? (
    <BulkListInner
      kind="story"
      items={props.items}
      users={props.users}
      {...("epicId" in props ? { epicId: props.epicId } : { initiativeId: props.initiativeId })}
    />
  ) : (
    <BulkListInner
      kind="epic"
      items={props.items}
      users={props.users}
      initiativeId={props.initiativeId}
      productId={props.productId}
    />
  );
}

function PlainList({ items }: { items: WorkItemRowData[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className="divide-y rounded-md border bg-card">
      {items.map((i) => (
        <WorkRow key={i.id} item={i} />
      ))}
    </div>
  );
}

function WorkRow({ item, checkbox }: { item: WorkItemRowData; checkbox?: React.ReactNode }) {
  return (
    <div className="group flex items-center gap-2 border-b px-2 py-2.5 last:border-b-0 hover:bg-accent/40 sm:gap-3 sm:px-4">
      {checkbox}
      <Link
        href={item.href}
        className="flex min-w-0 flex-1 items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <PriorityBadge priority={item.priority} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.name}</div>
          {item.meta && (
            <div className="mt-0.5 text-xs text-muted-foreground">{item.meta}</div>
          )}
        </div>
        <StatusBadge status={item.status} />
        <div className="hidden w-24 text-xs text-muted-foreground sm:block">
          {formatDate(item.targetDate)}
        </div>
        <OwnerAvatar name={item.owner?.name} image={item.owner?.image} />
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </div>
  );
}

function BulkListInner(
  props:
    | { kind: "story"; epicId: string; items: WorkItemRowData[]; users: UserOpt[] }
    | { kind: "story"; initiativeId: string; items: WorkItemRowData[]; users: UserOpt[] }
    | {
        kind: "epic";
        items: WorkItemRowData[];
        users: UserOpt[];
        initiativeId?: string;
        productId?: string;
      },
) {
  const { items, users } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const [applyOwner, setApplyOwner] = useState(false);
  const [ownerId, setOwnerId] = useState<string>("__no_change__");
  const [applyAssignee, setApplyAssignee] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string>("__no_change__");
  const [applyStart, setApplyStart] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [applyTarget, setApplyTarget] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [applyStatus, setApplyStatus] = useState(false);
  const [workStatus, setWorkStatus] = useState<WorkStatus>("PLANNED");
  const [applyPriority, setApplyPriority] = useState(false);
  const [workPriority, setWorkPriority] = useState<Priority>("P2");

  const n = selected.size;
  const allSelected = items.length > 0 && n === items.length;

  function setAllSelected(checked: boolean) {
    if (checked) setSelected(new Set(items.map((i) => i.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function userLabel(u: UserOpt) {
    return u.name?.trim() || u.email;
  }

  function closeDialog() {
    setOpen(false);
  }

  function apply() {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error("Select at least one item");
      return;
    }
    const hasField =
      props.kind === "epic"
        ? applyOwner || applyStart || applyTarget || applyStatus || applyPriority
        : applyOwner || applyAssignee || applyStart || applyTarget || applyStatus || applyPriority;
    if (!hasField) {
      toast.error("Choose at least one field to update");
      return;
    }
    if (applyOwner && ownerId === "__no_change__") {
      toast.error("Choose an owner, or Unassigned");
      return;
    }
    if (applyAssignee && assigneeId === "__no_change__") {
      toast.error("Choose an assignee, or Unassigned");
      return;
    }
    start(async () => {
      if (props.kind === "story") {
        const patch = {
          ...(applyOwner ? { ownerId: (ownerId === "__unassign__" ? null : ownerId) as string | null } : {}),
          ...(applyAssignee ? { assigneeId: (assigneeId === "__unassign__" ? null : assigneeId) as string | null } : {}),
          ...(applyStart ? { startDate: startDate ? new Date(startDate + "T12:00:00") : null } : {}),
          ...(applyTarget ? { targetDate: targetDate ? new Date(targetDate + "T12:00:00") : null } : {}),
          ...(applyStatus ? { status: workStatus } : {}),
          ...(applyPriority ? { priority: workPriority } : {}),
        };
        const res =
          "epicId" in props
            ? await bulkUpdateStories({ storyIds: ids, epicId: props.epicId, ...patch })
            : await bulkUpdateStories({ storyIds: ids, initiativeId: props.initiativeId, ...patch });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(`Updated ${res.count} stor${res.count === 1 ? "y" : "ies"}`);
        setOpen(false);
        setSelected(new Set());
        router.refresh();
        return;
      }

      const raw: {
        epicIds: string[];
        initiativeId?: string;
        productId?: string;
        ownerId?: string | null;
        startDate?: Date | null;
        targetDate?: Date | null;
        status?: WorkStatus;
        priority?: Priority;
      } = { epicIds: ids };
      if (props.initiativeId !== undefined) raw.initiativeId = props.initiativeId;
      if (props.productId !== undefined) raw.productId = props.productId;
      if (applyOwner) raw.ownerId = ownerId === "__unassign__" ? null : ownerId;
      if (applyStart) raw.startDate = startDate ? new Date(startDate + "T12:00:00") : null;
      if (applyTarget) raw.targetDate = targetDate ? new Date(targetDate + "T12:00:00") : null;
      if (applyStatus) raw.status = workStatus;
      if (applyPriority) raw.priority = workPriority;
      const res = await bulkUpdateEpics(raw);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Updated ${res.count} epic${res.count === 1 ? "" : "s"}`);
      setOpen(false);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            id="bulk-select-all"
            checked={allSelected}
            onCheckedChange={(c) => setAllSelected(c === true)}
            aria-label="Select all"
          />
          <label htmlFor="bulk-select-all" className="cursor-pointer">
            {allSelected ? "Deselect all" : "Select all"}
          </label>
        </div>
        {n > 0 && (
          <span className="text-sm text-muted-foreground">
            {n} selected
          </span>
        )}
        <Button type="button" size="sm" variant="secondary" disabled={n === 0} onClick={() => setOpen(true)}>
          Bulk update…
        </Button>
      </div>
      <div className="divide-y rounded-md border bg-card">
        {items.map((i) => (
          <WorkRow
            key={i.id}
            item={i}
            checkbox={
              <Checkbox
                className="shrink-0"
                checked={selected.has(i.id)}
                onCheckedChange={() => toggleOne(i.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${i.name}`}
              />
            }
          />
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Bulk update {n} {props.kind === "story" ? (n === 1 ? "story" : "stories") : n === 1 ? "epic" : "epics"}
            </DialogTitle>
            <DialogDescription>
              Enable each field you want to change, then set the new value. Unchanged fields are left as they are.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FieldToggle
              id="b-owner"
              label="Owner"
              checked={applyOwner}
              onCheckedChange={setApplyOwner}
            >
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__no_change__">(choose user)</SelectItem>
                  <SelectItem value="__unassign__">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {userLabel(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldToggle>
            {props.kind === "story" ? (
              <FieldToggle
                id="b-assignee"
                label="Assignee"
                checked={applyAssignee}
                onCheckedChange={setApplyAssignee}
              >
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__no_change__">(choose user)</SelectItem>
                    <SelectItem value="__unassign__">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {userLabel(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldToggle>
            ) : null}
            <FieldToggle id="b-start" label="Start date" checked={applyStart} onCheckedChange={setApplyStart}>
              <div className="space-y-1 text-xs text-muted-foreground">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                Clear the date and save to remove the start date.
              </div>
            </FieldToggle>
            <FieldToggle id="b-target" label="Target date" checked={applyTarget} onCheckedChange={setApplyTarget}>
              <div className="space-y-1 text-xs text-muted-foreground">
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                Clear the date and save to remove the target date.
              </div>
            </FieldToggle>
            <FieldToggle
              id="b-status"
              label="Status"
              checked={applyStatus}
              onCheckedChange={setApplyStatus}
            >
              <Select value={workStatus} onValueChange={(v) => setWorkStatus(v as WorkStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldToggle>
            <FieldToggle
              id="b-priority"
              label="Priority"
              checked={applyPriority}
              onCheckedChange={setApplyPriority}
            >
              <Select value={workPriority} onValueChange={(v) => setWorkPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldToggle>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={apply} disabled={pending || n === 0}>
              {pending ? "Saving…" : "Apply to selected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldToggle({
  id,
  label,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={(c) => onCheckedChange(!!c)} />
        <Label htmlFor={id} className="text-sm font-medium">
          Update {label}
        </Label>
      </div>
      <div className={checked ? "opacity-100" : "pointer-events-none opacity-50"}>{children}</div>
    </div>
  );
}

