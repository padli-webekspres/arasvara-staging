import type { ReactNode } from "react";

export function SocialEmbedLinkCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full max-w-[500px] items-start gap-3 rounded-lg border border-border bg-card p-4 text-left no-underline transition-colors hover:bg-muted/60"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
          {description}
        </span>
        <span className="mt-2 block truncate text-xs text-hijauSawah">
          {href}
        </span>
      </span>
    </a>
  );
}
