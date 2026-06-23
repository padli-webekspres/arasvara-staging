"use client";

import { useCallback, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function parseTagsFieldValue(raw: string): {
  committed: string[];
  draft: string;
} {
  if (!raw) return { committed: [], draft: "" };

  const segments = raw.split(",");
  const endsWithComma = raw.endsWith(",");

  if (endsWithComma) {
    return {
      committed: segments.map((s) => s.trim()).filter(Boolean),
      draft: "",
    };
  }

  if (segments.length <= 1) {
    return { committed: [], draft: raw };
  }

  const draft = segments[segments.length - 1] ?? "";
  const committed = segments
    .slice(0, -1)
    .map((s) => s.trim())
    .filter(Boolean);

  return { committed, draft };
}

export function buildTagsFieldValue(
  committed: string[],
  draft: string,
): string {
  const joined = committed.join(", ");
  if (!draft) {
    return joined ? `${joined}, ` : "";
  }
  return joined ? `${joined}, ${draft}` : draft;
}

/** Normalizes saved/API tags so every tag renders as a committed chip. */
export function formatTagsForInput(
  tags: string | string[] | Array<{ name?: string }> | undefined,
): string {
  let joined = "";
  if (Array.isArray(tags)) {
    joined = tags
      .map((t) => (typeof t === "string" ? t : String(t?.name ?? "")))
      .filter(Boolean)
      .join(", ");
  } else if (typeof tags === "string") {
    joined = tags.trim();
  }
  if (!joined) return "";
  return /,\s*$/.test(joined) ? joined : `${joined}, `;
}

interface ArticleTagsInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Tags input: committed tags (after comma) render as outlined chips;
 * removing a chip or backspacing on empty draft drops the whole tag.
 */
export default function ArticleTagsInput({
  value,
  onChange,
  placeholder = "Ketik tag, pisahkan dengan koma…",
  className,
}: ArticleTagsInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { committed, draft } = useMemo(() => parseTagsFieldValue(value), [value]);

  const applyTags = useCallback(
    (nextCommitted: string[], nextDraft: string) => {
      onChange(buildTagsFieldValue(nextCommitted, nextDraft));
    },
    [onChange],
  );

  const removeTag = (index: number) => {
    const next = committed.filter((_, i) => i !== index);
    applyTags(next, draft);
    inputRef.current?.focus();
  };

  const handleInputChange = (nextDraft: string) => {
    if (nextDraft.includes(",")) {
      const parts = nextDraft.split(",");
      const toCommit = parts
        .slice(0, -1)
        .map((p) => p.trim())
        .filter(Boolean);
      const remainder = parts[parts.length - 1] ?? "";
      applyTags([...committed, ...toCommit], remainder);
      return;
    }
    applyTags(committed, nextDraft);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace" || draft.length > 0 || committed.length === 0) {
      return;
    }
    e.preventDefault();
    applyTags(committed.slice(0, -1), "");
  };

  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2",
        "focus-within:ring-2 focus-within:ring-hijauSawah/25 focus-within:border-hijauSawah",
        className,
      )}
    >
      {committed.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md border-2 border-hijauSawah/60 bg-hijauSawah/10 px-2 py-0.5 text-sm font-medium text-foreground"
        >
          <span className="truncate">{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Hapus tag ${tag}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={committed.length === 0 ? placeholder : undefined}
        className="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
