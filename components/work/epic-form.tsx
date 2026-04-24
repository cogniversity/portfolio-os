"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkItemForm, type BaseItemInitial } from "@/components/work/work-item-form";

type Owner = { id: string; name: string | null; email: string };
type ParentOption = { id: string; name: string };

type EpicActionInput = BaseItemInitial & {
  initiativeId: string | null;
  productId: string | null;
};

type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export function EpicForm({
  action,
  owners,
  initiatives,
  products,
  initial,
  submitLabel = "Save",
  onSuccessHref,
}: {
  action: (input: EpicActionInput) => Promise<ActionResult>;
  owners: Owner[];
  initiatives: ParentOption[];
  products: ParentOption[];
  initial?: Partial<BaseItemInitial> & {
    initiativeId?: string | null;
    productId?: string | null;
  };
  submitLabel?: string;
  onSuccessHref?: string;
}) {
  const [initiativeId, setInitiativeId] = useState<string | null>(
    initial?.initiativeId ?? null,
  );
  const [productId, setProductId] = useState<string | null>(initial?.productId ?? null);

  async function wrapped(input: BaseItemInitial & Record<string, unknown>) {
    if (!initiativeId && !productId) {
      return {
        ok: false as const,
        error: "Select at least one parent: an initiative, a product, or both",
      };
    }
    return action({ ...(input as BaseItemInitial), initiativeId, productId });
  }

  return (
    <WorkItemForm
      action={wrapped}
      owners={owners}
      initial={initial}
      submitLabel={submitLabel}
      onSuccessHref={onSuccessHref}
      aiContext={{ kind: "EPIC" }}
      extraFields={
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Initiative</Label>
            <Select
              value={initiativeId ?? "__none"}
              onValueChange={(v) => setInitiativeId(v === "__none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {initiatives.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product</Label>
            <Select
              value={productId ?? "__none"}
              onValueChange={(v) => setProductId(v === "__none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    />
  );
}
