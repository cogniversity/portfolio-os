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

export function StoryForm({
  action,
  owners,
  initial,
  submitLabel,
  onSuccessHref,
}: {
  action: (input: any) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  owners: Owner[];
  initial?: Partial<BaseItemInitial> & { assigneeId?: string | null };
  submitLabel?: string;
  onSuccessHref?: (id: string) => string;
}) {
  const [assigneeId, setAssigneeId] = useState<string>(initial?.assigneeId ?? "__none");

  const wrapped = async (base: any) => {
    return action({ ...base, assigneeId: assigneeId === "__none" ? null : assigneeId });
  };

  return (
    <WorkItemForm
      action={wrapped}
      owners={owners}
      initial={initial}
      submitLabel={submitLabel}
      onSuccessHref={onSuccessHref ?? ((id) => `/stories/${id}`)}
      aiContext={{ kind: "STORY" }}
      extraFields={
        <div className="space-y-2">
          <Label>Assignee</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
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
      }
    />
  );
}
