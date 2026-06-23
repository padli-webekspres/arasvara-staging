// lib/tiptap/PageBreak.ts

import { Node, CommandProps, NodeConfig } from "@tiptap/core";
import { DOMOutputSpec } from "prosemirror-model";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

export const PageBreak = Node.create<NodeConfig>({
  name: "pageBreak",
  group: "block",
  atom: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-page-break="true"]',
      },
    ] as const;
  },

  renderHTML(): DOMOutputSpec {
    return [
      "div",
      {
        "data-page-break": "true",
        class:
          "page-break-marker relative flex items-center my-6 gap-3 select-none",
      },
      [
        "div",
        { class: "flex-1 border-t-2 border-dashed border-muted-foreground/40" },
      ],
      [
        "span",
        {
          class:
            "shrink-0 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-2",
        },
        "Page Break",
      ],
      [
        "div",
        { class: "flex-1 border-t-2 border-dashed border-muted-foreground/40" },
      ],
    ];
  },

  addCommands(): any {
    return {
      setPageBreak:
        () =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

export default PageBreak;
