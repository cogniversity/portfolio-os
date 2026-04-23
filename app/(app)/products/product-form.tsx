"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkItemForm, type BaseItemInitial } from "@/components/work/work-item-form";

type Owner = { id: string; name: string | null; email: string };
type Portfolio = { id: string; name: string };

export function ProductForm({
  action,
  owners,
  portfolios,
  initial,
  initialPortfolioId,
  submitLabel,
}: {
  action: (input: any) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  owners: Owner[];
  portfolios: Portfolio[];
  initial?: Partial<BaseItemInitial> & { portfolioId?: string | null; color?: string | null };
  initialPortfolioId?: string;
  submitLabel?: string;
}) {
  const [portfolioId, setPortfolioId] = useState<string>(
    initial?.portfolioId ?? initialPortfolioId ?? "__none",
  );
  const [color, setColor] = useState(initial?.color ?? "#6366f1");

  const wrapped = async (base: any) => {
    return action({
      ...base,
      portfolioId: portfolioId === "__none" ? null : portfolioId,
      color,
    });
  };

  return (
    <WorkItemForm
      action={wrapped}
      owners={owners}
      initial={initial}
      submitLabel={submitLabel}
      onSuccessHref={(id) => `/products/${id}`}
      extraFields={
        <>
          <div className="space-y-2">
            <Label>Portfolio</Label>
            <Select value={portfolioId} onValueChange={setPortfolioId}>
              <SelectTrigger>
                <SelectValue placeholder="No portfolio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No portfolio</SelectItem>
                {portfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </>
      }
    />
  );
}
