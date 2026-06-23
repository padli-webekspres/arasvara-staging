import TiktokFlatIcon from "@/components/tiktokIcon";
import { UrlInputDialog } from "@/components/ui/UrlInputDialog";
import { ReadAlsoPickerDialog } from "@/components/ui/ReadAlsoPickerDialog";
import { EditorContent } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Youtube as YoutubeIcon,
  Highlighter,
  SeparatorHorizontal,
  BookOpen,
} from "lucide-react";
import { Instagram, Facebook, Twitter } from "lucide-react";

import { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ToolbarButtonProps {
  onClick?: () => void;
  isActive?: boolean;
  icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
  title: string;
}

function ToolbarButton({
  onClick,
  isActive,
  icon: Icon,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 p-2 rounded hover:bg-muted transition-colors ${
        isActive ? "bg-muted text-hijauSawah" : ""
      }`}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

import type {
  ImagePickerResult,
  MultiImagePickerResult,
} from "@/components/ui/ImagePickerModal";

interface ToolbarArticleProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any; // Editor | null; --- IGNORE ---
  setPickerOpen: (open: boolean) => void;
  setPickerContext: React.Dispatch<
    React.SetStateAction<"featured" | "editor" | "gallery">
  >;
  pickerOpen: boolean;
  pickerContext: "featured" | "editor" | "gallery";
  handlePickerSelect: (result: ImagePickerResult) => void;
  handlePickerSelectMultiple?: (result: MultiImagePickerResult) => void;
  galleryMediaIds?: string[];
}
const ToolbarArticle: React.FC<ToolbarArticleProps> = ({
  setPickerOpen,
  setPickerContext,
  editor,
  pickerOpen,
  pickerContext,
  handlePickerSelect,
  handlePickerSelectMultiple,
  galleryMediaIds = [],
}) => {
  // Social embed: simpan platform aktif bersamaan dengan state open
  const [socialDialogOpen, setSocialDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [readAlsoDialogOpen, setReadAlsoDialogOpen] = useState(false);
  const [socialDialogPlatform, setSocialDialogPlatform] = useState("");
  const addLink = () => {
    setLinkDialogOpen(true);
  };
  const addYoutube = () => {
    setYoutubeDialogOpen(true);
  };
  const addSocialEmbed = (platform: string) => {
    setSocialDialogPlatform(platform);
    setSocialDialogOpen(true);
  };
  const insertPageBreak = () => {
    editor?.chain().focus().setPageBreak().run();
  };
  const insertReadAlso = () => {
    setReadAlsoDialogOpen(true);
  };
  const handleReadAlsoSelect = (article: {
    _id: string;
    title: string;
    slug: string;
    publicPath?: string | null;
  }) => {
    editor
      ?.chain()
      .focus()
      .setReadAlso({
        articleId: article._id,
        slug: article.slug,
        title: article.title,
        publicPath: article.publicPath ?? null,
      })
      .run();
  };
  const addImage = () => {
    setPickerContext("editor");
    setPickerOpen(true);
  };

  const [contentCharCount, setContentCharCount] = useState(0);

  useEffect(() => {
    if (!editor) {
      setContentCharCount(0);
      return;
    }

    const updateCount = () => {
      setContentCharCount(editor.getText().length);
    };

    updateCount();
    editor.on("update", updateCount);

    return () => {
      editor.off("update", updateCount);
    };
  }, [editor]);
  const handleLinkConfirm = ({
    linkText,
    url,
  }: {
    linkText: string;
    url: string;
  }) => {
    const href = url.trim();
    if (!href || !editor) return;
    const text = linkText.trim() || href;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text,
        marks: [{ type: "link", attrs: { href } }],
      })
      .run();
  };
  const handleYoutubeConfirm = (url: string) => {
    editor?.chain().focus().setYoutubeVideo({ src: url }).run();
  };
  const handleSocialEmbedConfirm = (url: string) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .setSocialEmbed({ platform: socialDialogPlatform, url })
      .run();
  };

  return (
    <>
      <div className="relative min-w-0">
        <div
          className="flex flex-wrap items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 bg-muted rounded-lg z-40 sticky top-14 md:top-16 xl:top-[4.5rem] border-b border-border shadow-sm min-w-0"
        >
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            isActive={editor?.isActive("bold")}
            icon={Bold}
            title="Bold"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            isActive={editor?.isActive("italic")}
            icon={Italic}
            title="Italic"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            isActive={editor?.isActive("underline")}
            icon={UnderlineIcon}
            title="Underline"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            isActive={editor?.isActive("strike")}
            icon={Strikethrough}
            title="Strikethrough"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHighlight().run()}
            isActive={editor?.isActive("highlight")}
            icon={Highlighter}
            title="Highlight"
          />
          <div className="w-px h-6 bg-border mx-0.5 sm:mx-1 shrink-0" />
          <ToolbarButton
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
            isActive={editor?.isActive("heading", { level: 1 })}
            icon={Heading1}
            title="Heading 1"
          />
          <ToolbarButton
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
            isActive={editor?.isActive("heading", { level: 2 })}
            icon={Heading2}
            title="Heading 2"
          />
          <ToolbarButton
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
            isActive={editor?.isActive("heading", { level: 3 })}
            icon={Heading3}
            title="Heading 3"
          />
          <div className="w-px h-6 bg-border mx-0.5 sm:mx-1 shrink-0" />
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
            isActive={editor?.isActive({ textAlign: "left" })}
            icon={AlignLeft}
            title="Align Left"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
            isActive={editor?.isActive({ textAlign: "center" })}
            icon={AlignCenter}
            title="Align Center"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
            isActive={editor?.isActive({ textAlign: "right" })}
            icon={AlignRight}
            title="Align Right"
          />
          <div className="w-px h-6 bg-border mx-0.5 sm:mx-1 shrink-0" />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            isActive={editor?.isActive("bulletList")}
            icon={List}
            title="Bullet List"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            isActive={editor?.isActive("orderedList")}
            icon={ListOrdered}
            title="Numbered List"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            isActive={editor?.isActive("blockquote")}
            icon={Quote}
            title="Quote"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleCode().run()}
            isActive={editor?.isActive("code")}
            icon={Code}
            title="Code"
          />
          <div className="w-px h-6 bg-border mx-0.5 sm:mx-1 shrink-0" />
          <ToolbarButton onClick={addLink} icon={LinkIcon} title="Add Link" />
          <ToolbarButton
            onClick={addImage}
            icon={ImageIcon}
            title="Add Image"
          />
          <ToolbarButton
            onClick={addYoutube}
            icon={YoutubeIcon}
            title="Add YouTube"
          />
          <ToolbarButton
            onClick={() => addSocialEmbed("twitter")}
            icon={Twitter}
            title="Embed Twitter"
          />
          <ToolbarButton
            onClick={() => addSocialEmbed("instagram")}
            icon={Instagram}
            title="Embed Instagram"
          />
          <ToolbarButton
            onClick={() => addSocialEmbed("facebook")}
            icon={Facebook}
            title="Embed Facebook"
          />
          <ToolbarButton
            onClick={() => addSocialEmbed("tiktok")}
            icon={TiktokFlatIcon}
            title="Embed TikTok"
          />
          <div className="w-px h-6 bg-border mx-0.5 sm:mx-1 shrink-0" />
          {/* <ToolbarButton
            onClick={insertPageBreak}
            icon={SeparatorHorizontal}
            title="Insert Page Break"
          /> */}
          <ToolbarButton
            onClick={insertReadAlso}
            icon={BookOpen}
            title="Baca Juga"
          />
          <div className="w-px h-6 bg-border mx-0.5 sm:mx-1 shrink-0" />
          <ToolbarButton
            onClick={() => editor?.chain().focus().undo().run()}
            icon={Undo}
            title="Undo"
          />
          <ToolbarButton
            onClick={() => editor?.chain().focus().redo().run()}
            icon={Redo}
            title="Redo"
          />
        </div>
        <div className="article-editor-prose min-w-0 max-w-full bg-card border border-border rounded-lg p-3 sm:p-4 min-h-80 sm:min-h-125 mt-4 sm:mt-6 overflow-x-auto">
          <EditorContent editor={editor} />
        </div>
        <div className="flex justify-end mt-2">
          <p
            className="text-sm text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {contentCharCount.toLocaleString("id-ID")} karakter
          </p>
        </div>
      </div>

      {/* Toolbar dialogs — menggantikan window.prompt */}
      <UrlInputDialog
        mode="link"
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        title="Sisipkan tautan"
        description="Isi teks yang tampil di artikel lalu alamat URL tujuannya."
        linkTextLabel="Teks tampilan"
        urlLabel="URL"
        linkTextPlaceholder="Teks yang terlihat di artikel"
        urlPlaceholder="https://..."
        onConfirm={handleLinkConfirm}
      />
      <UrlInputDialog
        open={youtubeDialogOpen}
        onOpenChange={setYoutubeDialogOpen}
        title="Embed YouTube"
        description="Masukkan URL video YouTube."
        label="YouTube URL"
        placeholder="https://www.youtube.com/watch?v=..."
        onConfirm={handleYoutubeConfirm}
      />
      <UrlInputDialog
        open={socialDialogOpen}
        onOpenChange={setSocialDialogOpen}
        title={`Embed ${socialDialogPlatform ? socialDialogPlatform.charAt(0).toUpperCase() + socialDialogPlatform.slice(1) : "Social"}`}
        description={`Masukkan URL postingan ${socialDialogPlatform}.`}
        label="Post URL"
        placeholder="https://..."
        onConfirm={handleSocialEmbedConfirm}
      />
      <ReadAlsoPickerDialog
        open={readAlsoDialogOpen}
        onOpenChange={setReadAlsoDialogOpen}
        onSelect={handleReadAlsoSelect}
      />
    </>
  );
};

export default ToolbarArticle;
