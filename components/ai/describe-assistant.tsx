"use client";

import * as React from "react";
import { Loader2, RefreshCw, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { improveDescription } from "@/lib/ai/actions";
import type { AiDescribeKind } from "@/lib/ai/schemas";

export interface DescribeAssistantProps {
  kind: AiDescribeKind;
  name: string;
  currentDescription: string;
  onAccept: (text: string) => void;
  disabled?: boolean;
}

export function DescribeAssistant({
  kind,
  name,
  currentDescription,
  onAccept,
  disabled,
}: DescribeAssistantProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(() => {
    if (!name || !name.trim()) {
      toast.error("Enter a name first so AI has context.");
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await improveDescription({
        kind,
        name,
        currentDescription,
      });
      if (res.ok) {
        setSuggestion(res.data.suggestion);
      } else {
        setError(res.error);
        setSuggestion(null);
      }
    });
  }, [kind, name, currentDescription]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !suggestion && !pending) run();
    if (!next) {
      setSuggestion(null);
      setError(null);
    }
  }

  function handleAccept() {
    if (suggestion) {
      onAccept(suggestion);
      setOpen(false);
      setSuggestion(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 text-violet-600 hover:text-violet-700 dark:text-violet-300"
          title="Improve description with AI"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-xs">Improve with AI</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <div className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            AI description
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={run}
            disabled={pending}
            title="Regenerate"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <div className="p-3 max-h-[300px] overflow-y-auto text-sm">
          {pending && !suggestion ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : suggestion ? (
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              rows={10}
              className="w-full resize-y rounded-md border border-input bg-transparent p-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <div className="text-muted-foreground">No suggestion yet.</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAccept}
            disabled={!suggestion || pending}
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
