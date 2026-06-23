// lib/tiptap/ReadAlsoNode.ts

import { Node, CommandProps, NodeConfig } from "@tiptap/core";
import { DOMOutputSpec } from "prosemirror-model";

export interface ReadAlsoAttrs {
  articleId: string | null;
  slug: string | null;
  title: string | null;
  publicPath: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    readAlso: {
      setReadAlso: (attrs: ReadAlsoAttrs) => ReturnType;
    };
  }
}

export const ReadAlsoNode = Node.create<NodeConfig, ReadAlsoAttrs>({
  name: "readAlso",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      articleId: { default: null },
      slug: { default: null },
      title: { default: null },
      publicPath: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-read-also="true"]',
        getAttrs: (dom: HTMLElement | string) => {
          if (!(dom instanceof HTMLElement)) return false;
          return {
            articleId: dom.getAttribute("data-article-id"),
            slug: dom.getAttribute("data-slug"),
            title: dom.getAttribute("data-title"),
            publicPath: dom.getAttribute("data-public-path"),
          };
        },
      },
    ] as const;
  },

  renderHTML({ node }): DOMOutputSpec {
    const attrs = node.attrs as ReadAlsoAttrs;
    return [
      "div",
      {
        "data-read-also": "true",
        "data-article-id": attrs.articleId,
        "data-slug": attrs.slug,
        "data-title": attrs.title,
        "data-public-path": attrs.publicPath,
        class:
          "read-also-marker relative flex w-full max-w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 my-6 select-none",
      },
      [
        "div",
        {
          class:
            "h-0 w-full shrink-0 border-t-2 border-dashed border-hijauSawah/40 sm:h-auto sm:min-w-0 sm:flex-1",
        },
      ],
      [
        "span",
        {
          class:
            "min-w-0 w-full max-w-full shrink break-words text-center text-xs font-semibold uppercase tracking-widest text-hijauSawah px-2",
        },
        `Baca Juga: ${attrs.title || "—"}`,
      ],
      [
        "div",
        {
          class:
            "h-0 w-full shrink-0 border-t-2 border-dashed border-hijauSawah/40 sm:h-auto sm:min-w-0 sm:flex-1",
        },
      ],
    ];
  },

  addCommands(): any {
    return {
      setReadAlso:
        (attrs: ReadAlsoAttrs) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

export default ReadAlsoNode;
