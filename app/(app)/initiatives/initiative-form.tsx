"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkItemForm, type BaseItemInitial } from "@/components/work/work-item-form";
import type { CustomFieldKind } from "@prisma/client";

type Owner = { id: string; name: string | null; email: string };
type Product = { id: string; name: string };
type FieldDef = {
  id: string;
  key: string;
  label: string;
  kind: CustomFieldKind;
  options: any;
  required: boolean;
};
type Type = { id: string; key: string; name: string; color: string; fields: FieldDef[] };

export function InitiativeForm({
  action,
  owners,
  products,
  types,
  initial,
  initialProductId,
  initialCustomFields,
  submitLabel,
}: {
  action: (input: any) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  owners: Owner[];
  products: Product[];
  types: Type[];
  initial?: Partial<BaseItemInitial> & {
    typeId?: string | null;
    productIds?: string[];
  };
  initialProductId?: string;
  initialCustomFields?: Record<string, any>;
  submitLabel?: string;
}) {
  const [typeId, setTypeId] = useState<string>(initial?.typeId ?? "__none");
  const [productIds, setProductIds] = useState<string[]>(
    initial?.productIds ?? (initialProductId ? [initialProductId] : []),
  );
  const [customFields, setCustomFields] = useState<Record<string, any>>(
    initialCustomFields ?? {},
  );

  const selectedType = useMemo(
    () => types.find((t) => t.id === typeId),
    [types, typeId],
  );

  const wrapped = async (base: any) => {
    return action({
      ...base,
      typeId: typeId === "__none" ? null : typeId,
      productIds,
      customFields,
    });
  };

  function toggleProduct(id: string) {
    setProductIds((ids) =>
      ids.includes(id) ? ids.filter((p) => p !== id) : [...ids, id],
    );
  }

  return (
    <WorkItemForm
      action={wrapped}
      owners={owners}
      initial={initial}
      submitLabel={submitLabel}
      onSuccessHref={(id) => `/initiatives/${id}`}
      aiContext={{ kind: "INITIATIVE" }}
      extraFields={
        <>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No type</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Products (select one or many)</Label>
            <div className="max-h-48 space-y-1.5 overflow-auto rounded-md border p-2">
              {products.length === 0 && (
                <div className="text-sm text-muted-foreground">No products yet.</div>
              )}
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={productIds.includes(p.id)}
                    onCheckedChange={() => toggleProduct(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          {selectedType && selectedType.fields.length > 0 && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {selectedType.name} fields
              </div>
              {selectedType.fields.map((f) => (
                <CustomFieldInput
                  key={f.id}
                  field={f}
                  value={customFields[f.key]}
                  onChange={(v) =>
                    setCustomFields((prev) => ({ ...prev, [f.key]: v }))
                  }
                />
              ))}
            </div>
          )}
        </>
      }
    />
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
}) {
  if (field.kind === "TEXT" || field.kind === "CUSTOMER_LINK") {
    return (
      <div className="space-y-1.5">
        <Label>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      </div>
    );
  }
  if (field.kind === "TEXTAREA") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <Textarea
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  if (field.kind === "NUMBER") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>
    );
  }
  if (field.kind === "DATE") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    );
  }
  if (field.kind === "SELECT") {
    const opts: string[] = Array.isArray(field.options) ? field.options : [];
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        <Select value={value ?? ""} onValueChange={(v) => onChange(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return null;
}
