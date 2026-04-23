"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldKind } from "@prisma/client";

export type FieldDraft = {
  id?: string;
  key: string;
  label: string;
  kind: CustomFieldKind;
  options?: string[] | null;
  required: boolean;
};

export function TypeForm({
  action,
  initial,
}: {
  action: (input: {
    name: string;
    color: string;
    fields: FieldDraft[];
  }) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  initial?: { name: string; color: string; fields: FieldDraft[] };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [fields, setFields] = useState<FieldDraft[]>(initial?.fields ?? []);

  function addField() {
    setFields((f) => [
      ...f,
      { key: "", label: "", kind: "TEXT", required: false, options: null },
    ]);
  }

  function updateField(i: number, patch: Partial<FieldDraft>) {
    setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeField(i: number) {
    setFields((fs) => fs.filter((_, idx) => idx !== i));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await action({ name, color, fields });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved");
      router.push("/settings/initiative-types");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-16 p-1"
            />
            <span className="text-xs text-muted-foreground">{color}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Custom fields</Label>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="h-4 w-4" /> Add field
          </Button>
        </div>
        <div className="space-y-3">
          {fields.length === 0 && (
            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              No custom fields. Add one to capture type-specific data.
            </div>
          )}
          {fields.map((f, i) => (
            <div key={i} className="rounded-md border bg-card p-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4 space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={f.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    required
                  />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-xs">Key</Label>
                  <Input
                    value={f.key}
                    onChange={(e) => updateField(i, { key: e.target.value })}
                    placeholder="auto from label"
                  />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-xs">Kind</Label>
                  <Select
                    value={f.kind}
                    onValueChange={(v) => updateField(i, { kind: v as CustomFieldKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="TEXTAREA">Long text</SelectItem>
                      <SelectItem value="NUMBER">Number</SelectItem>
                      <SelectItem value="DATE">Date</SelectItem>
                      <SelectItem value="SELECT">Select</SelectItem>
                      <SelectItem value="CUSTOMER_LINK">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={f.required}
                      onCheckedChange={(v) => updateField(i, { required: !!v })}
                    />
                    Required
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {f.kind === "SELECT" && (
                <div className="mt-2 space-y-1.5">
                  <Label className="text-xs">Options (comma-separated)</Label>
                  <Input
                    value={(f.options ?? []).join(", ")}
                    onChange={(e) =>
                      updateField(i, {
                        options: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Option A, Option B, Option C"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save type"}
      </Button>
    </form>
  );
}
