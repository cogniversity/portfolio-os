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
import { RELEASE_STATUS_LABELS } from "@/lib/constants";
import type { ReleaseStatus } from "@prisma/client";
import { DescribeAssistant } from "@/components/ai/describe-assistant";

type Product = { id: string; name: string };

function toInputDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function ReleaseForm({
  action,
  products,
  initial,
  submitLabel = "Save",
}: {
  action: (input: any) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  products: Product[];
  initial?: {
    productId?: string;
    name?: string;
    version?: string | null;
    description?: string | null;
    status?: ReleaseStatus;
    plannedDate?: Date | null;
    actualDate?: Date | null;
  };
  submitLabel?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState({
    productId: initial?.productId ?? products[0]?.id ?? "",
    name: initial?.name ?? "",
    version: initial?.version ?? "",
    description: initial?.description ?? "",
    status: (initial?.status ?? "PLANNED") as ReleaseStatus,
    plannedDate: toInputDate(initial?.plannedDate),
    actualDate: toInputDate(initial?.actualDate),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await action({
        productId: state.productId,
        name: state.name,
        version: state.version || null,
        description: state.description || null,
        status: state.status,
        plannedDate: state.plannedDate ? new Date(state.plannedDate) : null,
        actualDate: state.actualDate ? new Date(state.actualDate) : null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved");
      router.push(`/releases/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Product</Label>
          <Select
            value={state.productId}
            onValueChange={(v) => setState({ ...state, productId: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={state.status}
            onValueChange={(v) => setState({ ...state, status: v as ReleaseStatus })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(RELEASE_STATUS_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            value={state.version}
            onChange={(e) => setState({ ...state, version: e.target.value })}
            placeholder="v2.3"
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Description</Label>
          <DescribeAssistant
            kind="RELEASE"
            name={state.name}
            currentDescription={state.description}
            onAccept={(text) => setState((s) => ({ ...s, description: text }))}
          />
        </div>
        <Textarea
          id="description"
          rows={3}
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="plannedDate">Planned date</Label>
          <Input
            id="plannedDate"
            type="date"
            value={state.plannedDate}
            onChange={(e) => setState({ ...state, plannedDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actualDate">Actual date</Label>
          <Input
            id="actualDate"
            type="date"
            value={state.actualDate}
            onChange={(e) => setState({ ...state, actualDate: e.target.value })}
          />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
