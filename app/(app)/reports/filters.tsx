"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };

export function ReportFilters({
  products,
  types,
  owners,
  statuses,
  productId,
  typeId,
  ownerId,
  status,
}: {
  products?: Option[];
  types?: Option[];
  owners?: Option[];
  statuses?: string[];
  productId?: string;
  typeId?: string;
  ownerId?: string;
  status?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  function setParam(name: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "all") params.set(name, value);
    else params.delete(name);
    router.push(`${path}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {products && (
        <Select
          value={productId || "all"}
          onValueChange={(v) => setParam("productId", v)}
        >
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {types && (
        <Select
          value={typeId || "all"}
          onValueChange={(v) => setParam("typeId", v)}
        >
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {owners && (
        <Select
          value={ownerId || "all"}
          onValueChange={(v) => setParam("ownerId", v)}
        >
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {statuses && (
        <Select value={status || "all"} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
