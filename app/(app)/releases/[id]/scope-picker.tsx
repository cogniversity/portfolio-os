"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toggleEpicInRelease, toggleStoryInRelease } from "../actions";

export function ReleaseScopePicker({
  releaseId,
  epics,
  stories,
}: {
  releaseId: string;
  epics: Array<{ id: string; name: string; initiative: string; selected: boolean }>;
  stories: Array<{ id: string; name: string; epic: string; selected: boolean }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [epicFilter, setEpicFilter] = useState("");
  const [storyFilter, setStoryFilter] = useState("");

  function toggleEpic(id: string, add: boolean) {
    start(async () => {
      const res = await toggleEpicInRelease(releaseId, id, add);
      if (!res.ok) toast.error("Failed");
      router.refresh();
    });
  }
  function toggleStory(id: string, add: boolean) {
    start(async () => {
      const res = await toggleStoryInRelease(releaseId, id, add);
      if (!res.ok) toast.error("Failed");
      router.refresh();
    });
  }

  const filteredEpics = epics.filter(
    (e) =>
      !epicFilter ||
      e.name.toLowerCase().includes(epicFilter.toLowerCase()) ||
      e.initiative.toLowerCase().includes(epicFilter.toLowerCase()),
  );
  const filteredStories = stories.filter(
    (s) =>
      !storyFilter ||
      s.name.toLowerCase().includes(storyFilter.toLowerCase()) ||
      s.epic.toLowerCase().includes(storyFilter.toLowerCase()),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Epics</h3>
        <Input
          value={epicFilter}
          onChange={(e) => setEpicFilter(e.target.value)}
          placeholder="Filter epics..."
          className="mb-2"
        />
        <div className="max-h-96 divide-y overflow-auto rounded-md border bg-card">
          {filteredEpics.map((e) => (
            <label
              key={e.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent/40"
            >
              <Checkbox
                checked={e.selected}
                disabled={pending}
                onCheckedChange={(v) => toggleEpic(e.id, !!v)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate">{e.name}</div>
                <div className="truncate text-xs text-muted-foreground">{e.initiative}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Stories (cherry-pick)</h3>
        <Input
          value={storyFilter}
          onChange={(e) => setStoryFilter(e.target.value)}
          placeholder="Filter stories..."
          className="mb-2"
        />
        <div className="max-h-96 divide-y overflow-auto rounded-md border bg-card">
          {filteredStories.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent/40"
            >
              <Checkbox
                checked={s.selected}
                disabled={pending}
                onCheckedChange={(v) => toggleStory(s.id, !!v)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground">{s.epic}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
