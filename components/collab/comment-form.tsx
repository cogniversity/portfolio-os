"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addCommentAction } from "./actions";
import type { WorkItemType } from "@prisma/client";

export function CommentForm({
  itemType,
  itemId,
  users,
}: {
  itemType: WorkItemType;
  itemId: string;
  users: Array<{ id: string; name: string | null; email: string }>;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [caret, setCaret] = useState(0);

  const filtered = users
    .filter((u) => {
      const n = (u.name ?? u.email).toLowerCase();
      return mentionQuery.length === 0 || n.includes(mentionQuery.toLowerCase());
    })
    .slice(0, 5);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setBody(val);
    setCaret(pos);
    const upto = val.slice(0, pos);
    const m = upto.match(/@([\w.-]*)$/);
    if (m) {
      setMentionQuery(m[1]);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(user: { name: string | null; email: string }) {
    const handle = (user.name ?? user.email).split(" ")[0].toLowerCase();
    const before = body.slice(0, caret);
    const after = body.slice(caret);
    const newBefore = before.replace(/@([\w.-]*)$/, `@${handle} `);
    setBody(newBefore + after);
    setMentionOpen(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const mentions = Array.from(text.matchAll(/@([\w.-]+)/g)).map((m) => m[1]);
    start(async () => {
      const res = await addCommentAction({
        itemType,
        itemId,
        body: text,
        mentions,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="relative space-y-2">
      <Textarea
        value={body}
        onChange={handleChange}
        rows={3}
        placeholder="Write a comment... Use @ to mention"
      />
      {mentionOpen && filtered.length > 0 && (
        <div className="absolute z-10 w-56 rounded-md border bg-popover p-1 shadow">
          {filtered.map((u) => (
            <button
              type="button"
              key={u.id}
              onClick={() => insertMention(u)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
            >
              @{(u.name ?? u.email).split(" ")[0].toLowerCase()}{" "}
              <span className="text-xs text-muted-foreground">{u.name ?? u.email}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? "Posting..." : "Post comment"}
        </Button>
      </div>
    </form>
  );
}
