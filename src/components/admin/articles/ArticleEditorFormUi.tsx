"use client";

import Link from "next/link";
import {
  Save,
  Eye,
  ArrowLeft,
  Loader2,
  X,
  EyeIcon,
  Ban,
  ImageIcon,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchableSelect from "@/components/ui/SearchableSelect";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roundDatetimeLocalTo5Minutes } from "@/lib/datetime-jakarta";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import ToolbarArticle from "./ToolbarArticle";
import GallerySorting from "./GallerySorting";
import ArticleTagsInput from "./ArticleTagsInput";
import { ArticleStatus, CategoryOption } from "@/types/article";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import type { Editor } from "@tiptap/react";
import {
  useEffect,
  useMemo,
  type FormEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Media } from "@/types/media";
import {
  ImagePickerResult,
  MultiImagePickerResult,
} from "@/components/ui/ImagePickerModal";
import ImagePickerModal from "@/components/ui/ImagePickerModal";
import { adminPanelHref } from "@/lib/admin-panel-path";
import { cn } from "@/lib/utils";
import type { option } from "@/types/general";
import { SectionArticleItem } from "@/types/articleSection";
import { SortableSidebarArticleItem } from "./SortableSidebarArticleItem";
import { RelatedArticleSearchModal } from "./RelatedArticleSearchModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useState } from "react";

/** Batas karakter meta description (SEO) di UI */
const META_DESCRIPTION_MAX = 200;

export type ArticleStatusSelectOption = {
  status: ArticleStatus;
  label: string;
};

export type AttributionUserOption = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

interface ArticleEditorFormUiProps {
  handleSubmit?: (e?: React.FormEvent) => void;
  handleSubmitDraft: (e?: React.FormEvent) => void;
  handleSubmitPublish: (e?: React.FormEvent) => void;
  /** Tombol Save Draft di header — disembunyikan untuk editor+/admin dalam mode edit. */
  showSaveDraftHeader?: boolean;
  /** Teks tombol utama samping Save Draft — "Publish" (create / penulis) atau "Save changes" (editor edit). */
  secondarySubmitLabel?: string;
  isEditing: boolean;
  lastSaved: Date | null;
  previewArticle: () => void;
  clearForm: () => void;
  takeDownDialogOpen: boolean;
  setTakeDownDialogOpen: (open: boolean) => void;
  handleTakeDown: () => Promise<void>;
  isPublishing: boolean;
  formData: {
    title: string;
    excerpt?: string;
    content?: string;
    categoryId: string;
    tags: string;
    featuredImage: Media | string;
    /** Atribusi gambar unggulan khusus artikel (diisi via dialog saat picking). */
    featuredImageAttribution?: { caption: string; credit: string };
    status?: ArticleStatus;
    scheduledAt?: string;
    reason?: string;
    authorId?: string;
    editorId?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: any;
  handlePickerSelect: (result: ImagePickerResult) => void;
  handlePickerSelectMultiple?: (result: MultiImagePickerResult) => void;
  setPickerContext: Dispatch<SetStateAction<"featured" | "editor" | "gallery">>;
  pickerContext?: "featured" | "editor" | "gallery";
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  editor: Editor | null;
  featuredImagePreview: string | null;
  removeFeaturedImage: () => void;
  categories: CategoryOption[];
  allowedStatus: ArticleStatusSelectOption[];
  format?: "STANDARD" | "GALLERY";
  // Gallery items untuk GALLERY format
  galleryItems?: any[];
  galleryMediaIds?: string[];
  onGalleryItemCaption?: (id: string, caption: string) => void;
  onGalleryItemCredit?: (id: string, credit: string) => void;
  onGalleryItemRemove?: (id: string) => void;
  onGalleryReorder?: (items: any[]) => void;
  onAddGalleryImage?: () => void;
  /** Editor+, managing editor, pemred, admin: pilih penulis/editor. */
  canPickAttribution?: boolean;
  attributionAuthors?: AttributionUserOption[];
  attributionEditors?: AttributionUserOption[];
  attributionLoading?: boolean;
  relatedArticles?: SectionArticleItem[];
  setRelatedArticles?: Dispatch<SetStateAction<SectionArticleItem[]>>;
  idArticle?: string;
  /** publicPath artikel saat ini (jika sudah structured). */
  currentPublicPath?: string | null;
  /** True jika edit artikel PUBLISHED-structured dan kategori berubah → URL akan berubah. */
  urlWillChange?: boolean;
}

/** Tombol aksi header — ikon saja di mobile, label muncul dari `sm`. */
function HeaderActionButton({
  onClick,
  variant = "outline",
  icon: Icon,
  label,
  disabled,
  className,
  type = "button",
}: {
  onClick?: () => void;
  variant?: "outline" | "default" | "destructive";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <Button
      type={type}
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      className={cn("h-9 shrink-0 px-2.5 sm:px-3", className)}
      aria-label={label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline sm:ml-2">{label}</span>
    </Button>
  );
}

const ArticleEditorFormUi: React.FC<ArticleEditorFormUiProps> = ({
  isEditing,
  lastSaved,
  previewArticle,
  clearForm,
  idArticle,
  takeDownDialogOpen,
  setTakeDownDialogOpen,
  handleTakeDown,
  isPublishing,
  formData,
  setFormData,
  handlePickerSelect,
  handlePickerSelectMultiple,
  setPickerContext,
  pickerContext = "featured",
  pickerOpen,
  setPickerOpen,
  editor,
  featuredImagePreview,
  removeFeaturedImage,
  categories,
  allowedStatus,
  handleSubmitDraft,
  handleSubmitPublish,
  showSaveDraftHeader = true,
  secondarySubmitLabel = "Publish",
  format = "STANDARD",
  galleryItems,
  galleryMediaIds,
  onGalleryItemCaption,
  onGalleryItemCredit,
  onGalleryItemRemove,
  onGalleryReorder,
  onAddGalleryImage,
  canPickAttribution = false,
  attributionAuthors = [],
  attributionEditors = [],
  attributionLoading = false,
  relatedArticles = [],
  setRelatedArticles,
  currentPublicPath,
  urlWillChange = false,
}) => {
  const { data: currentUser } = useCurrentUser();
  const excerptRaw = formData.excerpt ?? "";
  const excerptLen = excerptRaw.length;
  const atMetaLimit = excerptLen >= META_DESCRIPTION_MAX;

  /** Potong excerpt dari API/draft jika lebih panjang dari batas */
  useEffect(() => {
    if (excerptRaw.length <= META_DESCRIPTION_MAX) return;
    setFormData((prev: ArticleEditorFormUiProps["formData"]) => ({
      ...prev,
      excerpt: (prev.excerpt ?? "").slice(0, META_DESCRIPTION_MAX),
    }));
  }, [excerptRaw, setFormData]);

  /** Otomatis pilih user yang sedang login jika mode NEW dan belum ada authorId */
  useEffect(() => {
    if (!isEditing && currentUser?._id && !formData.authorId) {
      setFormData((prev: any) => ({
        ...prev,
        authorId: currentUser._id,
      }));
    }
  }, [isEditing, currentUser, formData.authorId, setFormData]);

  // Siapkan conditional rendering untuk format (future-proof)
  const isStandardFormat = format === "STANDARD";
  const showStatusPicker = allowedStatus.length > 0;

  const formatUserLabel = (u: AttributionUserOption) => u.name || u.email;

  const authorAttributionOptions = useMemo<option[]>(() => {
    const base = [
      {
        id: "none",
        value: "__none__",
        label: "Default (akun yang menyimpan)",
      },
      ...attributionAuthors.map((u) => ({
        id: u._id,
        value: u._id,
        label: formatUserLabel(u),
      })),
    ];

    // Memastikan user yang sedang login masuk ke dalam daftar opsi agar dropdown dapat melakukan pencocokan & checklist visual
    if (
      currentUser?._id &&
      !attributionAuthors.some((u) => u._id === currentUser._id)
    ) {
      base.push({
        id: currentUser._id,
        value: currentUser._id,
        label: currentUser.name
          ? `${currentUser.name}`
          : currentUser.name || "Anda",
      });
    }

    return base;
  }, [attributionAuthors, currentUser]);

  const editorAttributionOptions = useMemo<option[]>(
    () => [
      { id: "none", value: "__none__", label: "Tidak ada" },
      ...attributionEditors.map((u) => ({
        id: u._id,
        value: u._id,
        label: formatUserLabel(u),
      })),
    ],
    [attributionEditors],
  );

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && setRelatedArticles) {
      const oldIndex = relatedArticles.findIndex((item) => {
        const id =
          item.article_id ?? (item.article ? item.article._id : item._id);
        return id === active.id;
      });
      const newIndex = relatedArticles.findIndex((item) => {
        const id =
          item.article_id ?? (item.article ? item.article._id : item._id);
        return id === over.id;
      });

      setRelatedArticles(arrayMove(relatedArticles, oldIndex, newIndex));
    }
  };

  const handleRemoveRelatedArticle = (id: string) => {
    if (setRelatedArticles) {
      setRelatedArticles(
        relatedArticles.filter((item) => {
          const itemId =
            item.article_id ?? (item.article ? item.article._id : item._id);
          return itemId !== id;
        }),
      );
    }
  };

  const handleAddRelatedArticle = (article: any) => {
    if (setRelatedArticles) {
      const newItem: SectionArticleItem = {
        _id: article._id,
        article_id: article._id,
        order: relatedArticles.length,
        article: article,
        createdAt: new Date(),
        createdBy: "",
      };
      setRelatedArticles([...relatedArticles, newItem]);
    }
  };

  const currentArticleId = idArticle;

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6 overflow-x-clip">
      {/* Header */}
      <div className="space-y-3 xl:space-y-0 xl:flex xl:items-start xl:justify-between xl:gap-4">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0">
          <Link href={adminPanelHref("articles")} className="shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words">
              {isEditing ? "Edit Article" : "New Article"}
            </h1>
            {lastSaved && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Last saved: {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end xl:max-w-[min(100%,42rem)] xl:shrink-0">
          {!isEditing && (
            <>
              <HeaderActionButton
                onClick={previewArticle}
                icon={EyeIcon}
                label="Preview"
              />
              <HeaderActionButton
                onClick={clearForm}
                icon={X}
                label="Clear Draft"
              />
            </>
          )}
          {isEditing && (
            <AlertDialog
              open={takeDownDialogOpen}
              onOpenChange={setTakeDownDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  type="button"
                  className="h-9 shrink-0 bg-orange-600 hover:bg-orange-700 text-white px-2.5 sm:px-3"
                  disabled={formData.status === ArticleStatus.TAKEN_DOWN}
                  aria-label="Take Down Article"
                >
                  <Ban className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline md:ml-2">
                    Take Down Article
                  </span>
                  <span className="hidden sm:inline md:hidden sm:ml-2">
                    Take Down
                  </span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Take down artikel ini?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini akan mengubah status artikel menjadi Taken
                    Down. Artikel tidak lagi muncul di publik, tetapi datanya
                    tetap aman di database dan Anda dapat mengaktifkannya
                    kembali nanti.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
                  <AlertDialogCancel className="w-full sm:w-auto">
                    Batal
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleTakeDown}
                    className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Ya, Take Down
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {showSaveDraftHeader && (
            <HeaderActionButton
              onClick={handleSubmitDraft}
              icon={Save}
              label="Save Draft"
            />
          )}
          <Button
            onClick={handleSubmitPublish}
            disabled={isPublishing}
            type="button"
            className="h-9 shrink-0 px-2.5 sm:px-3"
            aria-label={isPublishing ? "Publishing" : secondarySubmitLabel}
          >
            {isPublishing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 shrink-0" />
            )}
            <span className="ml-2 truncate max-w-[6.5rem] sm:max-w-none">
              {isPublishing ? "Publishing..." : secondarySubmitLabel}
            </span>
          </Button>
        </div>
      </div>

      {/* Editor + Sidebar — layout 2 kolom hanya di xl (desktop lebar) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 min-w-0">
        {/* Main Editor */}
        <div className="xl:col-span-2 min-w-0 space-y-4 sm:space-y-6 order-1">
          <Input
            placeholder="Article title..."
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            className="w-full min-w-0 text-xl sm:text-2xl font-bold border-0 border-b border-border rounded-none focus-visible:ring-0 focus-visible:border-hijauSawah"
          />

          {/* Conditional Rendering: STANDARD vs GALLERY Format */}
          {isStandardFormat ? (
            // ─── STANDARD Format: Rich Text Editor ─────────────────────────────
            <ToolbarArticle
              handlePickerSelect={handlePickerSelect}
              handlePickerSelectMultiple={handlePickerSelectMultiple}
              setPickerContext={setPickerContext}
              pickerContext={pickerContext}
              pickerOpen={pickerOpen}
              setPickerOpen={setPickerOpen}
              editor={editor}
              galleryMediaIds={galleryMediaIds}
            />
          ) : (
            // ─── GALLERY Format: Gallery Description + Gallery Items ──────────
            <div className="space-y-4">
              <Textarea
                placeholder="Write your gallery description here..."
                value={formData.content ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                rows={3}
                className="w-full min-w-0 resize-y focus-visible:border-hijauSawah focus-visible:ring-hijauSawah/25"
              />

              {/* Gallery Sorting & Management Component */}
              <GallerySorting
                items={galleryItems}
                onItemCaption={onGalleryItemCaption}
                onItemCredit={onGalleryItemCredit}
                onItemRemove={onGalleryItemRemove}
                onReorder={onGalleryReorder}
                onAddImage={onAddGalleryImage}
              />
            </div>
          )}
        </div>

        {/* Sidebar — di tablet/mobile tampil di bawah editor */}
        <div className="min-w-0 space-y-4 sm:space-y-6 order-2">
          {/* Featured Image */}
          <div className="bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
            <div className="space-y-1 min-w-0">
              <Label>Featured Image</Label>
              <p className="text-xs text-muted-foreground break-words">
                Setelah memilih gambar, Anda akan memotongnya ke ukuran tetap{" "}
                <span className="whitespace-nowrap">1280 × 800 px</span> dan
                dikompresi WebP di peramban.
              </p>
            </div>
            {featuredImagePreview ? (
              <div className="space-y-2">
                <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                  <Image
                    unoptimized
                    src={featuredImagePreview}
                    alt="Featured Preview"
                    className="object-cover w-full h-full rounded-lg"
                    width={400}
                    height={225}
                  />
                  <button
                    type="button"
                    onClick={removeFeaturedImage}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                    title="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="featured-image-caption"
                    className="text-xs text-muted-foreground"
                  >
                    Caption Gambar Unggulan
                  </Label>
                  <Input
                    id="featured-image-caption"
                    placeholder="Keterangan gambar..."
                    value={formData.featuredImageAttribution?.caption || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        featuredImageAttribution: {
                          ...formData.featuredImageAttribution,
                          caption: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-xs focus-visible:ring-hijauSawah/25 focus-visible:border-hijauSawah"
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPickerContext("featured");
                  setPickerOpen(true);
                }}
                className="w-full aspect-video border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-muted-foreground transition-colors cursor-pointer"
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Choose Image
                </span>
              </button>
            )}
          </div>

          {canPickAttribution && (
            <div className="bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 min-w-0">
              {attributionLoading ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Memuat daftar pengguna…
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="article-author-pick">Penulis</Label>
                    <SearchableSelect
                      id="article-author-pick"
                      options={authorAttributionOptions}
                      value={
                        formData.authorId?.trim()
                          ? formData.authorId
                          : "__none__"
                      }
                      onChange={(v) =>
                        setFormData({
                          ...formData,
                          authorId:
                            typeof v === "string" && v !== "__none__" ? v : "",
                        })
                      }
                      placeholder="Penanggung jawab teks"
                    />
                    <p className="text-xs text-muted-foreground">
                      Default mengikuti akun login jika tidak memilih nama.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="article-editor-pick">Editor</Label>
                    <SearchableSelect
                      id="article-editor-pick"
                      options={editorAttributionOptions}
                      value={
                        formData.editorId?.trim()
                          ? formData.editorId
                          : "__none__"
                      }
                      onChange={(v) =>
                        setFormData({
                          ...formData,
                          editorId:
                            typeof v === "string" && v !== "__none__" ? v : "",
                        })
                      }
                      placeholder="Opsional"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Meta description (SEO) — maks. 200 karakter */}
          <div
            className={cn(
              "bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3 min-w-0 transition-[outline-color]",
              atMetaLimit &&
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#c65d45]",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="article-meta-description" className="mb-0">
                Meta Description
              </Label>
              <span
                className={cn(
                  "text-xs tabular-nums shrink-0",
                  atMetaLimit
                    ? "font-medium text-[#c65d45]"
                    : "text-muted-foreground",
                )}
                aria-live="polite"
              >
                {excerptLen}/{META_DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id="article-meta-description"
              placeholder="Brief summary of the article..."
              value={excerptRaw}
              maxLength={META_DESCRIPTION_MAX}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  excerpt: e.target.value.slice(0, META_DESCRIPTION_MAX),
                })
              }
              rows={3}
              className="min-h-18 w-full min-w-0 resize-y"
              aria-describedby={
                atMetaLimit ? "article-meta-desc-limit-msg" : undefined
              }
            />
            {atMetaLimit ? (
              <p
                id="article-meta-desc-limit-msg"
                className="text-xs font-medium text-[#c65d45]"
              >
                Batas {META_DESCRIPTION_MAX} karakter tercapai — tidak dapat
                menambah teks lagi.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Maksimal {META_DESCRIPTION_MAX} karakter
              </p>
            )}
          </div>

          {/* Category */}
          <div className="bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 min-w-0">
            <Label>Channel</Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) =>
                setFormData({ ...formData, categoryId: value })
              }
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat: CategoryOption) => (
                  <SelectItem key={cat._id} value={cat._id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Related Articles */}
          <div className="bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 min-w-0 flex flex-col max-h-[350px]">
            <div className="flex items-center justify-between">
              <Label>Related Articles</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSearchModalOpen(true)}
              >
                + Tambah
              </Button>
            </div>

            {relatedArticles.length > 0 ? (
              <div className="flex-1 overflow-y-auto pr-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={relatedArticles.map((item) => {
                      return String(
                        item.article_id ??
                          (item.article ? item.article._id : item._id),
                      );
                    })}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {relatedArticles.map((item) => {
                        const id = String(
                          item.article_id ??
                            (item.article ? item.article._id : item._id),
                        );
                        return (
                          <SortableSidebarArticleItem
                            key={id}
                            id={id}
                            item={item}
                            onRemove={handleRemoveRelatedArticle}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                Belum ada artikel terkait.
              </div>
            )}
          </div>

          {/* URL Artikel (preview publicPath structured) */}
          {currentPublicPath && (
            <div className={cn(
              "bg-card border rounded-lg p-3 sm:p-4 space-y-2 min-w-0",
              urlWillChange ? "border-amber-400" : "border-border",
            )}>
              <div className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground font-normal">URL Artikel (publik)</Label>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Format: /{"{kategori}"}/{"{tahun}"}/{"{bulan}"}/{"{tanggal}"}/{"{slug}"} — tanggal mengikuti WIB.
              </p>
              <p className="text-xs break-all font-mono text-foreground/80 select-all bg-muted/50 rounded px-2 py-1.5">
                {currentPublicPath}
              </p>
              {urlWillChange && (
                <div className="flex items-start gap-1.5 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p className="text-xs leading-snug">
                    URL akan berubah setelah disimpan. Link lama tidak bisa diakses lagi.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 min-w-0">
            <Label>Tags</Label>
            <ArticleTagsInput
              value={formData.tags ?? ""}
              onChange={(tags) => setFormData({ ...formData, tags })}
            />
            <p className="text-xs text-muted-foreground break-words">
              Pisahkan tag dengan koma. Tag yang sudah ditambahkan tampil dengan
              outline; gunakan tombol × atau Backspace untuk menghapus seluruh
              tag.
            </p>
          </div>

          {/* Status & jadwal — hanya editor / pemred / admin */}
          <div className="bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 min-w-0">
            <Label>Opsi publikasi</Label>
            {showStatusPicker ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="status" className="font-normal">
                    Status
                  </Label>
                  <Select
                    value={formData.status ?? "DRAFT"}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        status: value as ArticleStatus,
                      })
                    }
                  >
                    <SelectTrigger id="status" className="w-full min-w-0">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedStatus.map((s) => (
                        <SelectItem key={s.status} value={s.status}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.status === ArticleStatus.SCHEDULED && (
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="schedule-publish">Schedule Publish</Label>
                    <Input
                      id="schedule-publish"
                      type="datetime-local"
                      step={300}
                      value={formData.scheduledAt || ""}
                      className="w-full min-w-0 max-w-full"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setFormData({ ...formData, scheduledAt: "" });
                          return;
                        }
                        setFormData({
                          ...formData,
                          scheduledAt: roundDatetimeLocalTo5Minutes(val),
                        });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Waktu publish hanya bisa kelipatan 5 menit (misal: 10:00,
                      10:05, dst)
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">
                Sebagai penulis: gunakan <strong>Save Draft</strong> untuk
                menyimpan draf, atau <strong>{secondarySubmitLabel}</strong>{" "}
                untuk mengajukan ke peninjauan editor.
              </p>
            )}
          </div>

          {/* Reason field - only shown in edit mode */}
          {isEditing && (
            <div className="bg-card border border-border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 min-w-0">
              <Label>Alasan Revisi</Label>
              <Textarea
                placeholder="Jelaskan mengapa Anda membuat perubahan ini (berguna bagi editor untuk memahami revisi Anda)"
                value={formData.reason ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                rows={3}
                className="w-full min-w-0 resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Berikan konteks untuk editan Anda agar anggota tim lainnya
                memahami perubahan
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image Picker Modal - Available untuk kedua format (STANDARD & GALLERY) */}
      <ImagePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        onSelectMultiple={handlePickerSelectMultiple}
        isMultiSelect={pickerContext === "gallery"}
        galleryMediaIds={galleryMediaIds}
        // jika featured berikan true
        cropForFeatured={pickerContext === "featured"}
      />

      <RelatedArticleSearchModal
        isOpen={isSearchModalOpen}
        onOpenChange={setIsSearchModalOpen}
        onSelectArticle={handleAddRelatedArticle}
        currentArticleId={currentArticleId}
        selectedArticleIds={relatedArticles.map((item) =>
          String(
            item.article_id ?? (item.article ? item.article._id : item._id),
          ),
        )}
      />
    </div>
  );
};
export default ArticleEditorFormUi;
