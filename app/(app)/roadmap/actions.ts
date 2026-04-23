"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertCanWrite } from "@/lib/rbac";
import { computeShiftImpact, applyShiftImpact, type ShiftImpact } from "@/lib/timeline";

const previewSchema = z.object({
  kind: z.enum(["initiative", "epic", "story"]),
  id: z.string(),
  newStart: z.union([z.string(), z.null()]),
  newEnd: z.union([z.string(), z.null()]),
});

export async function previewShiftAction(input: z.input<typeof previewSchema>) {
  await assertCanWrite();
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const d = parsed.data;
  const impact = await computeShiftImpact(
    { kind: d.kind, id: d.id },
    d.newStart ? new Date(d.newStart) : null,
    d.newEnd ? new Date(d.newEnd) : null,
  );
  return {
    ok: true as const,
    impact: serialize(impact),
  };
}

export async function applyShiftAction(
  raw: ReturnType<typeof serialize>,
  alsoPushReleases: boolean,
) {
  const user = await assertCanWrite();
  const impact = deserialize(raw);
  await applyShiftImpact(impact, user.id, alsoPushReleases);
  revalidatePath("/roadmap");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

function serialize(i: ShiftImpact) {
  return {
    moved: i.moved.map((m) => ({
      ...m,
      fromStart: m.fromStart?.toISOString() ?? null,
      fromEnd: m.fromEnd?.toISOString() ?? null,
      toStart: m.toStart?.toISOString() ?? null,
      toEnd: m.toEnd?.toISOString() ?? null,
    })),
    releaseImpacts: i.releaseImpacts.map((r) => ({
      ...r,
      plannedDate: r.plannedDate?.toISOString() ?? null,
      suggestedDate: r.suggestedDate?.toISOString() ?? null,
    })),
    summary: i.summary,
  };
}

function deserialize(raw: ReturnType<typeof serialize>): ShiftImpact {
  return {
    moved: raw.moved.map((m) => ({
      ...m,
      fromStart: m.fromStart ? new Date(m.fromStart) : null,
      fromEnd: m.fromEnd ? new Date(m.fromEnd) : null,
      toStart: m.toStart ? new Date(m.toStart) : null,
      toEnd: m.toEnd ? new Date(m.toEnd) : null,
    })),
    releaseImpacts: raw.releaseImpacts.map((r) => ({
      ...r,
      plannedDate: r.plannedDate ? new Date(r.plannedDate) : null,
      suggestedDate: r.suggestedDate ? new Date(r.suggestedDate) : null,
    })),
    summary: raw.summary,
  };
}

export type SerializedImpact = ReturnType<typeof serialize>;
