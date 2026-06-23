// lib/tiptap/SocialEmbed.ts

import { Node, CommandProps, NodeConfig, RawCommands } from "@tiptap/core";
import { DOMOutputSpec } from "prosemirror-model";

export interface SocialEmbedAttrs {
  platform: string | null;
  url: string | null;
}

export const SocialEmbed = Node.create<NodeConfig, SocialEmbedAttrs>({
  name: "socialEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      platform: { default: null },
      url: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-social-embed="true"]',
        getAttrs: (dom: HTMLElement | string) => {
          if (!(dom instanceof HTMLElement)) return false;
          return {
            platform: dom.getAttribute("data-platform"),
            url: dom.getAttribute("data-url"),
          };
        },
      },
    ] as const;
  },
  renderHTML({ node }): DOMOutputSpec {
    const attrs = node.attrs as SocialEmbedAttrs;
    return [
      "div",
      {
        "data-social-embed": "true",
        "data-platform": attrs.platform,
        "data-url": attrs.url,
        class:
          "social-embed-marker p-4 bg-muted text-center rounded-lg border border-dashed my-4",
      },
      `[${(attrs.platform || "").toUpperCase()} EMBED: ${attrs.url}]`,
    ];
  },
  addCommands(): any {
    return {
      setSocialEmbed:
        (attrs: SocialEmbedAttrs) =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

export default SocialEmbed;
