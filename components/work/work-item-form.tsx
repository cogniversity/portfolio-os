"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_LABELS, STATUS_ORDER, PRIORITY_ORDER, PRIORITY_LABELS } from "@/lib/constants";
import type { Priority, WorkStatus } from "@prisma/client";

export type BaseItemInitial = {
  name: string;
  description: string | null;
  status: WorkStatus;
  priority: Priority;
  startDate: Date | null;
  targetDate: Date | null;
  ownerId: string | null;
};

type Owner = { id: string; name: string | null; email: string };

function toInputDate(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function WorkItemForm({
  action,
  initial,
  owners,
  submitLabel = "Save",
  extraFields,
  onSuccessHref,
}: {
  action: (input: BaseItemInitial & Record<string, any>) => Promise<
    { ok: true; id: string } | { ok: false; error: string }
  >;
  initial?: Partial<BaseItemInitial>;
  owners: Owner[];
  submitLabel?: string;
  extraFields?: React.ReactNode;
  onSuccessHref?: (id: string) => string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<BaseItemInitial>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "PLANNED",
    priority: initial?.priority ?? "P2",
    startDate: initial?.startDate ?? null,
    targetDate: initial?.targetDate ?? null,
    ownerId: initial?.ownerId ?? null,
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const extra: Record<string, any> = {};
    for (const [k, v] of fd.entries()) {
      if (k.startsWith("extra.")) extra[k.slice(6)] = v === "" ? null : v;
    }
    start(async () => {
      const res = await action({ ...state, ...extra });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved");
      if (onSuccessHref) router.push(onSuccessHref(res.id));
      else router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Title</Label>
        <Input
          id="name"
          value={state.name}
          onChange={(e) => setState({ ...state, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          value={state.description ?? ""}
          onChange={(e) => setState({ ...state, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={state.status}
            onValueChange={(v) => setState({ ...state, status: v as WorkStatus })}
          >
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
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={state.priority}
            onValueChange={(v) => setState({ ...state, priority: v as Priority })}
          >
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
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            type="date"
            value={toInputDate(state.startDate)}
            onChange={(e) =>
              setState({
                ...state,
                startDate: e.target.value ? new Date(e.target.value) : null,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetDate">Target date</Label>
          <Input
            id="targetDate"
            type="date"
            value={toInputDate(state.targetDate)}
            onChange={(e) =>
              setState({
                ...state,
                targetDate: e.target.value ? new Date(e.target.value) : null,
              })
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Owner</Label>
        <Select
          value={state.ownerId ?? "__none"}
          onValueChange={(v) =>
            setState({ ...state, ownerId: v === "__none" ? null : v })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Unassigned</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name ?? o.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {extraFields}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
