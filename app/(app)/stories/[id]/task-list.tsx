"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/work/status-badge";
import { OwnerAvatar } from "@/components/work/owner-avatar";
import { STATUS_LABELS, STATUS_ORDER, PRIORITY_ORDER } from "@/lib/constants";
import { createTask, updateTask, deleteTask } from "../../tasks/actions";
import type { Priority, Task, User, WorkStatus } from "@prisma/client";

type TaskView = Task & {
  owner: User | null;
  assignee: User | null;
};

export function TaskList({
  storyId,
  tasks,
  users,
  canEdit,
}: {
  storyId: string;
  tasks: TaskView[];
  users: Array<{ id: string; name: string | null; email: string; image: string | null }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newTitle, setNewTitle] = useState("");

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const name = newTitle.trim();
    if (!name) return;
    start(async () => {
      const res = await createTask({
        storyId,
        name,
        status: "PLANNED",
        priority: "P2",
        description: null,
        ownerId: null,
        startDate: null,
        targetDate: null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNewTitle("");
      router.refresh();
    });
  }

  function changeStatus(task: TaskView, status: WorkStatus) {
    start(async () => {
      const res = await updateTask(task.id, {
        storyId,
        name: task.name,
        description: task.description,
        ownerId: task.ownerId,
        assigneeId: task.assigneeId,
        status,
        priority: task.priority,
        startDate: task.startDate,
        targetDate: task.targetDate,
      });
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  function changeAssignee(task: TaskView, assigneeId: string) {
    start(async () => {
      const res = await updateTask(task.id, {
        storyId,
        name: task.name,
        description: task.description,
        ownerId: task.ownerId,
        assigneeId: assigneeId === "__none" ? null : assigneeId,
        status: task.status,
        priority: task.priority,
        startDate: task.startDate,
        targetDate: task.targetDate,
      });
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  function remove(task: TaskView) {
    if (!confirm(`Delete task "${task.name}"?`)) return;
    start(async () => {
      const res = await deleteTask(task.id);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="divide-y rounded-md border bg-card">
        {tasks.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No tasks yet.</div>
        )}
        {tasks.map((t) => (
          <div key={t.id} id={`task-${t.id}`} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1 text-sm">{t.name}</div>
            {canEdit ? (
              <Select
                value={t.status}
                onValueChange={(v) => changeStatus(t, v as WorkStatus)}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <StatusBadge status={t.status} />
            )}
            {canEdit ? (
              <Select
                value={t.assigneeId ?? "__none"}
                onValueChange={(v) => changeAssignee(t, v)}
              >
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <OwnerAvatar name={t.assignee?.name} image={t.assignee?.image} />
            )}
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => remove(t)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <form onSubmit={addTask} className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task..."
          />
          <Button type="submit" size="sm" disabled={pending || !newTitle.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
      )}
    </div>
  );
}
