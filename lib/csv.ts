import Papa from "papaparse";

export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns?: Array<keyof T | { key: keyof T; header: string }>,
): string {
  if (rows.length === 0 && !columns) return "";
  const resolved =
    columns?.map((c) =>
      typeof c === "object" && c !== null && "key" in c
        ? { key: c.key as string, header: c.header }
        : { key: c as string, header: String(c) },
    ) ?? Object.keys(rows[0] ?? {}).map((k) => ({ key: k, header: k }));

  const fields = resolved.map((c) => c.header);
  const data = rows.map((r) => resolved.map((c) => formatCell(r[c.key as keyof T])));

  return Papa.unparse({ fields, data });
}

function formatCell(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
