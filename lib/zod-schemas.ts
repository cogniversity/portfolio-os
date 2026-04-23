import { z } from "zod";

export const nullableDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  });

export const workStatusEnum = z.enum([
  "DRAFT",
  "PLANNED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "RELEASED",
  "CANCELLED",
]);

export const priorityEnum = z.enum(["P0", "P1", "P2", "P3"]);

export const releaseStatusEnum = z.enum([
  "PLANNED",
  "IN_DEVELOPMENT",
  "RELEASED",
  "DEPRECATED",
]);

export const baseItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(10000).nullable().optional(),
  ownerId: z.string().nullable().optional(),
  status: workStatusEnum.default("PLANNED"),
  priority: priorityEnum.default("P2"),
  startDate: nullableDate,
  targetDate: nullableDate,
});
