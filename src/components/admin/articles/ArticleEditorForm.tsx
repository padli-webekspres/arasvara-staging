"use client";

import { getMediaPreviewUrl } from "@/lib/utils";
import { parseDatetimeLocalAsWib } from "@/lib/datetime-jakarta";
import {
  extractContentMediaFromEditor,
  autoInsertPageBreaks,
  resolveExistingFeaturedImageForSubmit,
} from "@/lib/article-editor-helpers";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { toast } from "sonner";
import {
  articleEditorCreateStatusChoices,
  articleEditorEditStatusChoices,
  canPickArticleAttribution,
  getWriterArticleActions,
  hasArticleFormStatusPickerAccess,
  isWriterRole,
  usesWriterArticleFormSubmit,
} from "@/lib/editorialPublicationAccess";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import SocialEmbed from "@/lib/tiptap/SocialEmbed";
import PageBreak from "@/lib/tiptap/PageBreak";
import ReadAlsoNode from "@/lib/tiptap/ReadAlsoNode";
import ImageFigure from "@/lib/tiptap/ImageFigure";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";
import { adminPanelHref } from "@/lib/admin-panel-path";
import type { ArticleEditorFormProps } from "@/types/article";
import { ArticleStatus } from "@/types/article";
import {
  buildArticlePublicPath,
  pathsEqual,
  resolveUrlFormatForNewArticle,
} from "@/lib/article-public-path";
import {
  type ImagePickerResult,
  type MultiImagePickerResult,
} from "@/components/ui/ImagePickerModal";
import type { Media, PendingMedia, TempMediaUploadResult } from "@/types/media";
import { SectionArticleItem } from "@/types/articleSection";
import ArticleEditorFormUi, {
  type AttributionUserOption,
} from "./ArticleEditorFormUi";
import { formatTagsForInput } from "./ArticleTagsInput";
import type { ArticlePresignedUploadScope } from "@/lib/media/articleUploadScopes";
import { buildTempMediaViewUrl } from "@/lib/media/tempMedia";
import { autosaveArticle, getArticleDraftStorageKey, persistArticleDraftSync, readArticleDraftRaw, removeArticleDraft } from "@/lib/autosave";
import type { DraftGalleryItem } from "@/types/article";
import CropImageModal from "@/components/media/CropImageModal";

/** Dimensi dan kualitas crop untuk gambar unggulan (tetap). */
const FEATURED_IMAGE_WIDTH = 1280;
const FEATURED_IMAGE_HEIGHT = 800;
const FEATURED_IMAGE_ASPECT = FEATURED_IMAGE_WIDTH / FEATURED_IMAGE_HEIGHT;
const FEATURED_WEBP_QUALITY = 0.82;

/** Timeout khusus presign / PUT S3 / finalize (jaringan seluler iPhone). */
const PENDING_MEDIA_UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Data media yang menunggu crop di ArticleEditorForm.
 * Hanya "existing" (dari galeri) — upload baru (PendingMedia) sudah
 * di-crop sebelumnya di ImagePickerModal.
 */
type FeaturedCropPick = { type: "existing"; media: Media };

/** Pastikan categoryId selalu string hex 24 karakter untuk POST/PATCH (hindari undefined → hilang dari JSON). */
function normalizeCategoryIdForSubmit(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") {
    const t = raw.trim();
    return /^[a-f\d]{24}$/i.test(t) ? t : "";
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "$oid" in raw &&
    typeof (raw as { $oid?: unknown }).$oid === "string"
  ) {
    const t = (raw as { $oid: string }).$oid.trim();
    return /^[a-f\d]{24}$/i.test(t) ? t : "";
  }
  return "";
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Sebuah item di gallery — bisa berasal dari media yang sudah ada atau pending. */
export interface GalleryItem {
  id: string;
  mediaId: string;
  imageUrl: string;
  caption: string;
  credit: string;
  order: number;
  tempMediaId?: string;
  isPending?: boolean;
}

function toDraftGalleryItems(items: GalleryItem[]): DraftGalleryItem[] {
  return items.map((item) => ({
    id: item.id,
    mediaId: item.mediaId,
    imageUrl: item.imageUrl,
    caption: item.caption,
    credit: item.credit,
    order: item.order,
    ...(item.tempMediaId ? { tempMediaId: item.tempMediaId } : {}),
    ...(item.isPending ? { isPending: true } : {}),
  }));
}

/** State form artikel + field atribusi untuk editor+. */
interface FormState {
  title: string;
  excerpt?: string;
  content?: string;
  categoryId: string;
  tags: string;
  featuredImage: Media | string;
  /** Atribusi gambar unggulan khusus untuk artikel ini (caption & credit). */
  featuredImageAttribution: { caption: string; credit: string };
  status?: ArticleStatus;
  scheduledAt?: string;
  reason?: string;
  /** Hanya dipakai jika `canPickArticleAttribution` — kosong = backend pakai aktor. */
  authorId: string;
  /** Kosong = tidak ada editor. */
  editorId: string;
  contributorIds: string[];
}

// ─── Helper: satu media temp → promote ke folder final ───────────────────────

interface UploadedMediaResult {
  mediaId: string;
  fileKey: string;
  filename: string;
  url: string;
}

const PROMOTE_MAX_RETRIES = 3;

/**
 * Promosikan satu media temp ke folder final + buat row media.
 * Dengan retry per gambar (H5: submit all-or-nothing tanpa retry sebelumnya
 * membuat satu kegagalan jaringan menggagalkan seluruh submit di iPad).
 */
async function promoteOneTempMedia(
  tempMediaId: string,
  meta: { caption?: string; credit?: string; watermark?: boolean },
  articleUploadScope: ArticlePresignedUploadScope,
): Promise<UploadedMediaResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PROMOTE_MAX_RETRIES; attempt++) {
    try {
      const res = await api.post<{ success: boolean; media: Media }>(
        "/media/promote-temp",
        {
          tempMediaId,
          scope: articleUploadScope,
          caption: meta.caption,
          credit: meta.credit,
          watermark: meta.watermark ?? false,
        },
        { timeout: PENDING_MEDIA_UPLOAD_TIMEOUT_MS },
      );
      const { media } = res.data;

      return {
        mediaId: media._id,
        fileKey: media.filename,
        filename: media.filename,
        url: media.url,
      };
    } catch (err) {
      lastError = err;

      // Hanya retry untuk kegagalan transient (network / 5xx).
      // 4xx (mis. 404 temp tidak ditemukan, 400 scope invalid) tidak perlu diulang.
      const errBody = err as { response?: { status?: number } };
      const status = errBody?.response?.status;
      const isTransient = status == null || status >= 500;

      if (isTransient && attempt < PROMOTE_MAX_RETRIES) {
        // Backoff singkat — jaringan seluler iPad kadang lambat/intermiten
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      } else {
        break;
      }
    }
  }

  throw Object.assign(
    new Error(
      `Gagal mempromosikan media temp (${tempMediaId}): ${
        (lastError as Error)?.message ?? String(lastError)
      }`,
    ),
    { uploadedFileKeys: [] },
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ArticleEditorFormPropsWithFormat extends ArticleEditorFormProps {
  format?: "STANDARD" | "GALLERY";
}

export default function ArticleEditorForm({
  mode,
  paramArticle,
  initialData,
  idArticle,
  categories,
  format = "STANDARD",
}: ArticleEditorFormPropsWithFormat) {
  const router = useRouter();

  const [takeDownDialogOpen, setTakeDownDialogOpen] = useState(false);

  const handleTakeDown = async () => {
    if (!idArticle) return;
    try {
      await api.patch(`/articles/${idArticle}`, { status: "TAKEN_DOWN" });
      toast.success("Article successfully taken down!");
      removeArticleDraft(getArticleDraftStorageKey(format));
      setTimeout(() => {
        router.replace(adminPanelHref("articles"));
      }, 1200);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Gagal menurunkan artikel"));
      console.error("Error taking down article:", error);
    } finally {
      setTakeDownDialogOpen(false);
    }
  };

  const isEditing = mode === "edit";

  const { data: currentUser } = useCurrentUser();

  const [activeParamArticle] = useState<string | null>(paramArticle ?? null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialContent, setInitialContent] = useState<string | null>(
    isEditing ? (initialData?.content ?? null) : null,
  );

  const [formData, setFormData] = useState<FormState>({
    title: initialData?.title ?? "",
    excerpt: initialData?.excerpt ?? "",
    content: initialData?.content ?? "",
    categoryId: initialData?.categoryId ?? "",
    tags: formatTagsForInput(
      initialData?.tags as string | string[] | Array<{ name?: string }> | undefined,
    ),
    // initialData.featuredImage bisa berupa ArticleMedia dari backend (objek penuh)
    // atau string ID (saat edit lama). Cast ke unknown dulu untuk menghindari konflik tipe.
    featuredImage: (initialData?.featuredImage ?? "") as Media | string,
    featuredImageAttribution: {
      caption: (initialData?.featuredImage as Record<string, unknown> | undefined)?.caption as string ?? "",
      credit: (initialData?.featuredImage as Record<string, unknown> | undefined)?.credit as string ?? "",
    },
    status: initialData?.status ?? ArticleStatus.DRAFT,
    scheduledAt: initialData?.scheduledAt ?? "",
    reason:
      isEditing &&
      typeof (initialData as Record<string, unknown> | undefined)?.reason ===
        "string"
        ? String((initialData as Record<string, unknown>).reason)
        : "",
    authorId: initialData?.authorId ?? "",
    editorId: initialData?.editorId ?? "",
    contributorIds: initialData?.contributorIds ?? [],
  });

  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  /** Naikkan saat submit dimulai / berhasil agar autosave in-flight tidak menulis ulang draft. */
  const draftPersistGenerationRef = useRef(0);
  /** Set true setelah artikel baru berhasil disimpan — blok autosave sampai unmount. */
  const suppressDraftPersistRef = useRef(false);

  const [attributionOptions, setAttributionOptions] = useState<{
    authors: AttributionUserOption[];
    editors: AttributionUserOption[];
    loading: boolean;
  }>({ authors: [], editors: [], loading: false });

  const canPick = canPickArticleAttribution(currentUser?.role);

  useEffect(() => {
    if (!canPick) return;
    if (!currentUser?._id || isEditing) return;
    setFormData((prev) => {
      if (prev.authorId) return prev;
      return { ...prev, authorId: String(currentUser._id) };
    });
  }, [canPick, currentUser?._id, isEditing]);

  useEffect(() => {
    if (!canPick) return;
    let cancelled = false;
    void (async () => {
      setAttributionOptions((s) => ({ ...s, loading: true }));
      try {
        const [aRes, uRes] = await Promise.all([
          api.get<{ users: Record<string, unknown>[] }>(
            "/users/author?limit=200",
          ),
          api.get<{ users: Record<string, unknown>[] }>("/users?limit=200"),
        ]);
        if (cancelled) return;
        const mapRow = (u: Record<string, unknown>): AttributionUserOption => ({
          _id: String(u._id ?? ""),
          name: String(u.name ?? ""),
          email: String(u.email ?? ""),
          role: String(u.role ?? "").toLowerCase(),
        });
        const authors = (aRes.data.users ?? []).map(mapRow);
        const editorialRoles = new Set([
          "admin",
          "editor-in-chief",
          "managing-editor",
          "head-of",
          "editor",
        ]);
        const editors = (uRes.data.users ?? [])
          .map(mapRow)
          .filter((u) => editorialRoles.has(u.role));
        setAttributionOptions({ authors, editors, loading: false });
      } catch {
        if (!cancelled)
          setAttributionOptions((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPick]);

  // ─── Gallery Items ─────────────────────────────────────────────────────────
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(() => {
    if (!isEditing || format !== "GALLERY") return [];
    const items = initialData?.galleryItems;
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.map((item, index): GalleryItem => {
      const mediaIdStr = item.mediaId != null ? String(item.mediaId) : "";
      const media = item.media;
      const imageUrl =
        (media?.filename
          ? `/api/media/view?key=${encodeURIComponent(media.filename)}`
          : media?.url ?? item.url ?? "") || "";
      return {
        id: `edit-${mediaIdStr || String(index)}-${index}`,
        mediaId: mediaIdStr,
        imageUrl,
        caption: item.caption ?? "",
        credit: item.credit ?? "",
        order: typeof item.order === "number" ? item.order : index,
      };
    });
  });

  // ─── Related Articles ──────────────────────────────────────────────────────
  const [relatedArticles, setRelatedArticles] = useState<SectionArticleItem[]>(() => {
    return initialData?.relatedArticles ?? [];
  });
  const relatedArticlesRef = useRef(relatedArticles);
  relatedArticlesRef.current = relatedArticles;

  // ─── Pending media tracking ────────────────────────────────────────────────
  /** Featured image yang belum diunggah (masih di IndexedDB). */
  const [pendingFeaturedMedia, setPendingFeaturedMedia] =
    useState<PendingMedia | null>(null);

  /** Pemetaan tempMediaId + metadata untuk gambar pending di body editor. */
  const [editorImageKeys, setEditorImageKeys] = useState<
    Array<{
      tempMediaId: string;
      meta: { caption?: string; credit?: string; watermark?: boolean };
    }>
  >([]);

  // ─── Featured image preview ────────────────────────────────────────────────
  const [featuredImagePreview, setFeaturedImagePreview] = useState<
    string | null
  >(
    isEditing && initialData?.featuredImage
      ? getMediaPreviewUrl(initialData.featuredImage)
      : null,
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerContext, setPickerContext] = useState<
    "featured" | "editor" | "gallery"
  >("featured");
  const featuredCropPickRef = useRef<FeaturedCropPick | null>(null);
  const [featuredCropOpen, setFeaturedCropOpen] = useState(false);
  const [featuredCropSrc, setFeaturedCropSrc] = useState<string | null>(null);
  const [isDraftHydrated, setIsDraftHydrated] = useState(isEditing);
  const [editorContentSnapshot, setEditorContentSnapshot] = useState(
    initialData?.content ?? "",
  );

  const galleryItemsRef = useRef(galleryItems);
  galleryItemsRef.current = galleryItems;
  const featuredImagePreviewRef = useRef(featuredImagePreview);
  featuredImagePreviewRef.current = featuredImagePreview;
  const pendingFeaturedMediaRef = useRef(pendingFeaturedMedia);
  pendingFeaturedMediaRef.current = pendingFeaturedMedia;
  const editorImageKeysRef = useRef(editorImageKeys);
  editorImageKeysRef.current = editorImageKeys;
  const editorContentSnapshotRef = useRef(editorContentSnapshot);
  editorContentSnapshotRef.current = editorContentSnapshot;
  const hasLoadedDraftRef = useRef(false);

  // Revoke pending featured blob URL on unmount or change
  const prevFeaturedBlobRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      featuredImagePreview &&
      featuredImagePreview.startsWith("blob:") &&
      featuredImagePreview !== prevFeaturedBlobRef.current
    ) {
      if (prevFeaturedBlobRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(prevFeaturedBlobRef.current);
      }
      prevFeaturedBlobRef.current = featuredImagePreview;
    }
    return () => {
      if (prevFeaturedBlobRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(prevFeaturedBlobRef.current);
        prevFeaturedBlobRef.current = null;
      }
    };
  }, [featuredImagePreview]);

  const abortFeaturedCrop = useCallback(() => {
    featuredCropPickRef.current = null;
    setFeaturedCropOpen(false);
    setFeaturedCropSrc(null);
  }, []);

  const handleFeaturedCropApply = useCallback(async (blob: Blob) => {
    const pick = featuredCropPickRef.current;
    if (!pick) {
      toast.error("Sesi crop habis. Pilih gambar unggulan lagi.");
      return;
    }

    if (!blob.size) {
      toast.error("Hasil crop kosong. Coba lagi atau pilih gambar lain.");
      return;
    }

    try {
      // Kirim hasil crop ke server — server proses ke WebP (1280×800 fit-inside)
      // lalu simpan ke /temp. Klien iPad tidak kompres sama sekali.
      const formData = new FormData();
      formData.append("file", blob, "featured.webp");
      formData.append("watermark", "false");
      formData.append("maxWidth", String(FEATURED_IMAGE_WIDTH));
      formData.append("maxHeight", String(FEATURED_IMAGE_HEIGHT));

      const res = await api.post<TempMediaUploadResult>(
        "/media/process-temp",
        formData,
        { timeout: 120_000 },
      );
      const { tempMediaId, tempUrl, filename, size } = res.data;

      featuredCropPickRef.current = null;

      setPendingFeaturedMedia({
        _id: null,
        tempMediaId,
        tempUrl,
        filename,
        size,
        mimetype: "image/webp",
        url: tempUrl,
      });
      setFeaturedImagePreview(tempUrl);
      setFormData((prev) => ({ ...prev, featuredImage: "" }));

      setFeaturedCropOpen(false);
      setFeaturedCropSrc(null);

      toast.success("Gambar unggulan dipotong 1280×800 dan diproses.");
    } catch (err) {
      console.error("[featured crop apply]", err);
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Gagal menyimpan hasil crop gambar unggulan.",
      );
    }
  }, []);

  const removeFeaturedImage = () => {
    abortFeaturedCrop();
    setPendingFeaturedMedia(null);
    setFeaturedImagePreview(null);
    setFormData((prev) => ({
      ...prev,
      featuredImage: "",
      featuredImageAttribution: { caption: "", credit: "" },
    }));
  };

  // ─── Gallery Handlers ──────────────────────────────────────────────────────
  const handleGalleryItemCaption = (id: string, caption: string) => {
    setGalleryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, caption } : item)),
    );
  };

  const handleGalleryItemCredit = (id: string, credit: string) => {
    setGalleryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, credit } : item)),
    );
  };

  const handleGalleryItemRemove = (id: string) => {
    setGalleryItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddGalleryImage = () => {
    setPickerContext("gallery");
    setPickerOpen(true);
  };

  const handleAddMultipleGalleryImages = useCallback(
    (selectedMediaArray: (Media | PendingMedia)[]) => {
      setGalleryItems((prev) => {
        const maxOrder =
          prev.length > 0 ? Math.max(...prev.map((i) => i.order)) : -1;
        const newItems = selectedMediaArray.map((media, index) => {
          const isPending = media._id === null;
          const pm = media as PendingMedia;
          const m = media as Media;
          return {
            id: `${Date.now()}-${index}`,
            mediaId: isPending ? "" : (m._id ?? ""),
            imageUrl: isPending
              ? pm.tempUrl
              : `/api/media/view?key=${encodeURIComponent(m.filename)}`,
            caption: media.caption ?? "",
            credit: "",
            order: maxOrder + 1 + index,
            tempMediaId: isPending ? pm.tempMediaId : undefined,
            isPending: isPending || undefined,
          };
        });
        return [...prev, ...newItems];
      });
      setPickerOpen(false);
    },
    [],
  );

  const handleGalleryReorder = useCallback((reorderedItems: GalleryItem[]) => {
    const itemsWithOrder = reorderedItems.map((item, idx) => ({
      ...item,
      order: idx,
    }));
    setGalleryItems(itemsWithOrder);
  }, []);

  // ─── Editor ─────────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapImage.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full" },
      }),
      TiptapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-hijauSawah underline" },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        HTMLAttributes: { class: "rounded-lg mx-auto" },
      }),
      Placeholder.configure({ placeholder: "Start writing your article..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Highlight.configure({
        HTMLAttributes: {
          class: "rounded-sm bg-hijauSawah/25 text-inherit",
        },
      }),
      SocialEmbed,
      PageBreak,
      ReadAlsoNode,
      // ImageFigure: node atom untuk gambar + caption dari picker
      // TiptapImage standar tetap ada untuk backward compatibility dengan artikel lama
      ImageFigure,
    ],
    content: "",
    editorProps: {
      attributes: { class: "prose-arasvara focus:outline-none min-h-[400px]" },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && initialContent !== null) {
      editor.commands.setContent(initialContent);
      setInitialContent(null);
    }
  }, [editor, initialContent]);

  useEffect(() => {
    if (!editor || isEditing) return;

    const syncContent = () => {
      setEditorContentSnapshot(editor.getHTML());
    };

    syncContent();
    editor.on("update", syncContent);

    return () => {
      editor.off("update", syncContent);
    };
  }, [editor, isEditing]);

  // ─── Draft loading (create mode) ────────────────────────────────────────────
  useEffect(() => {
    if (isEditing || hasLoadedDraftRef.current) return;
    if (format === "STANDARD" && !editor) return;

    const loadDraft = async () => {
      hasLoadedDraftRef.current = true;

      const raw = readArticleDraftRaw(format);
      if (!raw) {
        setIsDraftHydrated(true);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        const parsedFormat =
          parsed.format === "GALLERY" ? "GALLERY" : "STANDARD";
        if (parsed.format != null && parsedFormat !== format) {
          setIsDraftHydrated(true);
          return;
        }

        let catId = "";
        const rawCategoryId = parsed.categoryId;
        if (typeof rawCategoryId === "string") {
          catId = rawCategoryId;
        } else if (
          rawCategoryId &&
          typeof rawCategoryId === "object" &&
          "$oid" in rawCategoryId
        ) {
          const oid = (rawCategoryId as { $oid?: unknown }).$oid;
          catId = typeof oid === "string" ? oid : "";
        }

        const restoredContent =
          typeof parsed.content === "string" ? parsed.content : "";
        const restoredTags = formatTagsForInput(
          Array.isArray(parsed.tags)
            ? parsed.tags.map((tag) => String(tag))
            : typeof parsed.tags === "string"
              ? parsed.tags
              : undefined,
        );

        let restoredFeaturedImage = "";
        if (typeof parsed.featuredImage === "string") {
          restoredFeaturedImage = parsed.featuredImage;
        } else if (
          parsed.featuredImage &&
          typeof parsed.featuredImage === "object" &&
          "_id" in parsed.featuredImage &&
          typeof (parsed.featuredImage as { _id?: unknown })._id === "string"
        ) {
          restoredFeaturedImage = String(
            (parsed.featuredImage as { _id?: unknown })._id,
          );
        }

        let missingDraftImageCount = 0;

        const savedFeaturedTempId =
          typeof parsed.pendingFeaturedTempId === "string"
            ? parsed.pendingFeaturedTempId
            : null;
        if (savedFeaturedTempId) {
          const tempUrl = buildTempMediaViewUrl(savedFeaturedTempId);
          setFeaturedImagePreview(tempUrl);
          setPendingFeaturedMedia({
            _id: null,
            tempMediaId: savedFeaturedTempId,
            tempUrl,
            filename: `${savedFeaturedTempId}.webp`,
            size: 0,
            mimetype: "image/webp",
            url: tempUrl,
          });
        } else if (
          // Draft lama (pra-temp): idbKey IndexedDB tidak bisa dipulihkan lagi
          typeof parsed.pendingFeaturedIdbKey === "string" &&
          parsed.pendingFeaturedIdbKey
        ) {
          missingDraftImageCount += 1;
        } else if (typeof parsed.featuredImagePreviewUrl === "string") {
          setFeaturedImagePreview(parsed.featuredImagePreviewUrl);
        }

        const savedEditorImageKeys = Array.isArray(parsed.editorImageKeys)
          ? (parsed.editorImageKeys as Array<{
              tempMediaId?: string;
              meta?: {
                caption?: string;
                takenBy?: string;
                watermark?: boolean;
              };
            }>)
          : [];

        const restoredHtml = restoredContent;
        const restoredEditorImageKeys: typeof editorImageKeys = [];

        for (const { tempMediaId, meta = {} } of savedEditorImageKeys) {
          if (!tempMediaId) {
            // Draft lama — blob IndexedDB sudah tidak bisa dipulihkan
            missingDraftImageCount += 1;
            continue;
          }
          // Konten HTML sudah memuat tempUrl (URL server) — tidak perlu replace
          restoredEditorImageKeys.push({ tempMediaId, meta });
        }

        if (restoredEditorImageKeys.length > 0) {
          setEditorImageKeys(restoredEditorImageKeys);
        }

        const parsedStatus = parsed.status;
        const normalizedStatus =
          typeof parsedStatus === "string" &&
          Object.values(ArticleStatus).includes(parsedStatus as ArticleStatus)
            ? (parsedStatus as ArticleStatus)
            : ArticleStatus.DRAFT;

        setFormData((prev) => ({
          ...prev,
          title: typeof parsed.title === "string" ? parsed.title : "",
          excerpt: typeof parsed.excerpt === "string" ? parsed.excerpt : "",
          ...(format === "GALLERY" ? { content: restoredContent } : {}),
          categoryId: catId,
          tags: restoredTags,
          featuredImage: restoredFeaturedImage,
          featuredImageAttribution: {
            caption:
              typeof (parsed.featuredImageAttribution as Record<string, unknown> | undefined)?.caption === "string"
                ? String((parsed.featuredImageAttribution as Record<string, unknown>).caption)
                : "",
            credit:
              typeof (parsed.featuredImageAttribution as Record<string, unknown> | undefined)?.credit === "string"
                ? String((parsed.featuredImageAttribution as Record<string, unknown>).credit)
                : "",
          },
          status: normalizedStatus,
          scheduledAt:
            typeof parsed.scheduledAt === "string" ? parsed.scheduledAt : "",
        }));

        const restoredRelatedArticles = Array.isArray(parsed.relatedArticles)
          ? parsed.relatedArticles
          : [];
        if (restoredRelatedArticles.length > 0) {
          setRelatedArticles(restoredRelatedArticles as SectionArticleItem[]);
        }

        if (format === "GALLERY" && Array.isArray(parsed.galleryItems)) {
          const restoredGallery: GalleryItem[] = [];
          for (const rawItem of parsed.galleryItems as DraftGalleryItem[]) {
            if (!rawItem || typeof rawItem !== "object") continue;
            const base = {
              id: String(rawItem.id ?? `${Date.now()}-${restoredGallery.length}`),
              mediaId: String(rawItem.mediaId ?? ""),
              caption: String(rawItem.caption ?? ""),
              credit: String(rawItem.credit ?? ""),
              order:
                typeof rawItem.order === "number"
                  ? rawItem.order
                  : restoredGallery.length,
            };
            if (rawItem.isPending) {
              if (rawItem.tempMediaId) {
                restoredGallery.push({
                  ...base,
                  imageUrl:
                    String(rawItem.imageUrl ?? "") ||
                    buildTempMediaViewUrl(rawItem.tempMediaId),
                  tempMediaId: rawItem.tempMediaId,
                  isPending: true,
                });
              } else {
                // Draft lama — blob IndexedDB sudah tidak bisa dipulihkan
                missingDraftImageCount += 1;
              }
            } else {
              restoredGallery.push({
                ...base,
                imageUrl: String(rawItem.imageUrl ?? ""),
              });
            }
          }
          if (restoredGallery.length > 0) {
            setGalleryItems(
              restoredGallery.sort((a, b) => a.order - b.order),
            );
          }
        }

        if (missingDraftImageCount > 0) {
          toast.warning(
            `${missingDraftImageCount} foto draft tidak ditemukan lagi di penyimpanan lokal. Unggah ulang foto tersebut.`,
          );
        }

        if (format === "STANDARD" && restoredHtml && editor) {
          editor.commands.setContent(restoredHtml);
          setEditorContentSnapshot(restoredHtml);
        }
      } catch (e) {
        console.error("Error loading draft:", e);
      } finally {
        setIsDraftHydrated(true);
      }
    };

    void loadDraft();
  }, [isEditing, editor, format]);

  // ─── Clear form ──────────────────────────────────────────────────────────────
  const clearForm = () => {
    abortFeaturedCrop();
    setPendingFeaturedMedia(null);
    setFormData({
      title: "",
      excerpt: "",
      content: "",
      categoryId: "",
      tags: "",
      featuredImage: "",
      featuredImageAttribution: { caption: "", credit: "" },
      status: ArticleStatus.DRAFT,
      scheduledAt: "",
      authorId: canPick && currentUser?._id ? String(currentUser._id) : "",
      editorId: "",
      contributorIds: [],
    });
    editor?.commands.clearContent();
    setFeaturedImagePreview(null);
    setEditorImageKeys([]);
    setGalleryItems([]);
    setRelatedArticles([]);
    removeArticleDraft(getArticleDraftStorageKey(format));
  };

  // ─── Preview ─────────────────────────────────────────────────────────────────
  const previewArticle = () => {
    // Sisipkan page break otomatis jika berformat STANDARD sebelum melakukan save untuk preview
    if (format === "STANDARD" && editor) {
      const currentHtml = editor.getHTML();
      const updatedHtml = autoInsertPageBreaks(currentHtml);
      if (updatedHtml !== currentHtml) {
        editor.commands.setContent(updatedHtml);
        setEditorContentSnapshot(updatedHtml);
      }
    }
    void performAutoSave();
    const previewFormat = format === "GALLERY" ? "gallery" : "standard";
    window.open(adminPanelHref(`articles/preview?format=${previewFormat}`), "_blank");
  };

  const draftStorageKey = getArticleDraftStorageKey(format);

  const buildDraftPersistInput = useCallback(() => {
    const fd = formDataRef.current;
    const normalizedStatus =
      fd.status && Object.values(ArticleStatus).includes(fd.status)
        ? fd.status
        : ArticleStatus.DRAFT;
    const currentContent =
      format === "GALLERY"
        ? fd.content ?? ""
        : editorContentSnapshotRef.current || editor?.getHTML() || "";

    return {
      formData: {
        ...fd,
        content: currentContent,
        status: normalizedStatus,
        tags: fd.tags,
        relatedArticles: relatedArticlesRef.current,
      },
      editor: format === "STANDARD" ? editor : null,
      activeParamArticle,
      featuredImagePreviewUrl: featuredImagePreviewRef.current,
      storageKey: draftStorageKey,
      format,
      galleryItems: toDraftGalleryItems(galleryItemsRef.current),
      pendingFeaturedTempId:
        pendingFeaturedMediaRef.current?.tempMediaId ?? null,
      editorImageKeys: editorImageKeysRef.current.map(
        ({ tempMediaId, meta }) => ({
          tempMediaId,
          meta,
        }),
      ),
    };
  }, [format, editor, activeParamArticle, draftStorageKey]);

  // ─── Auto-save ───────────────────────────────────────────────────────────────
  const performAutoSave = useCallback(async () => {
    if (
      isEditing ||
      !isDraftHydrated ||
      suppressDraftPersistRef.current ||
      isPublishing
    ) {
      return;
    }

    const generationAtStart = draftPersistGenerationRef.current;
    const persistInput = buildDraftPersistInput();

    await autosaveArticle({
      ...persistInput,
      setLastSaved,
      setAutoSaving,
      autoSaving,
      shouldPersist: () =>
        !suppressDraftPersistRef.current &&
        generationAtStart === draftPersistGenerationRef.current,
    });
  }, [
    isEditing,
    isDraftHydrated,
    isPublishing,
    buildDraftPersistInput,
    setLastSaved,
    setAutoSaving,
    autoSaving,
  ]);

  // Flush sinkron saat unmount / pagehide agar navigasi cepat tidak kehilangan draft
  useEffect(() => {
    if (isEditing) return;

    const flushDraft = () => {
      if (!isDraftHydrated || suppressDraftPersistRef.current || isPublishing) {
        return;
      }
      persistArticleDraftSync({
        ...buildDraftPersistInput(),
        shouldPersist: () => !suppressDraftPersistRef.current,
      });
    };

    window.addEventListener("pagehide", flushDraft);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      flushDraft();
    };
  }, [
    isEditing,
    isDraftHydrated,
    isPublishing,
    buildDraftPersistInput,
  ]);

  useEffect(() => {
    if (isEditing || !isDraftHydrated) return;
    void performAutoSave();
  }, [
    formData.categoryId,
    formData.featuredImage,
    formData.featuredImageAttribution,
    formData.status,
    formData.scheduledAt,
    featuredImagePreview,
    isEditing,
    isDraftHydrated,
    performAutoSave,
  ]);

  useEffect(() => {
    if (isEditing || !isDraftHydrated) return;

    const timeoutId = window.setTimeout(() => {
      void performAutoSave();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [
    formData.title,
    formData.excerpt,
    formData.content,
    formData.tags,
    formData.featuredImageAttribution,
    editorContentSnapshot,
    galleryItems,
    relatedArticles,
    isEditing,
    isDraftHydrated,
    performAutoSave,
  ]);

  // ─── Upload semua pending media sebelum submit ────────────────────────────
  const uploadAllPendingMedia = useCallback(
    async (
      currentContent: string,
    ): Promise<{
      resolvedFeaturedImageId: string | null;
      resolvedFeaturedImageUrl: string | null;
      resolvedContent: string;
      resolvedGalleryItems: GalleryItem[];
      uploadedFileKeys: string[];
      /** Map dari tempUrl (atau mediaKey untuk existing) ke data media final.
       *  Digunakan oleh extractContentMediaFromEditor untuk menyusun contentMedia. */
      contentMediaMap: Map<string, { mediaId: string; url: string; filename: string }>;
    }> => {
      const uploadedFileKeys: string[] = [];
      let resolvedFeaturedImageId: string | null = null;
      let resolvedFeaturedImageUrl: string | null = null;
      let resolvedContent = currentContent;
      const resolvedGalleryItems = [...galleryItems];
      const contentMediaMap = new Map<string, { mediaId: string; url: string; filename: string }>();

      // 1. Featured image pending
      if (pendingFeaturedMedia) {
        const result = await promoteOneTempMedia(
          pendingFeaturedMedia.tempMediaId,
          {
            caption: pendingFeaturedMedia.caption,
            credit: pendingFeaturedMedia.credit,
            watermark: pendingFeaturedMedia.watermark,
          },
          "featured",
        );
        uploadedFileKeys.push(result.fileKey);
        resolvedFeaturedImageId = result.mediaId;
        resolvedFeaturedImageUrl = result.url;
      } else {
        const existingFeatured = resolveExistingFeaturedImageForSubmit(
          formData.featuredImage,
        );
        if (existingFeatured) {
          resolvedFeaturedImageId = existingFeatured.mediaId;
          resolvedFeaturedImageUrl = existingFeatured.url;
        }
      }

      // 2. Gambar di body editor (tempUrl)
      for (const { tempMediaId, meta } of editorImageKeys) {
        const tempUrl = buildTempMediaViewUrl(tempMediaId);
        if (!resolvedContent.includes(tempUrl)) continue;
        try {
          const result = await promoteOneTempMedia(tempMediaId, meta, "content");
          uploadedFileKeys.push(result.fileKey);
          const viewUrl = `/api/media/view?key=${encodeURIComponent(result.filename)}`;
          resolvedContent = resolvedContent.replaceAll(tempUrl, viewUrl);

          // Update Tiptap editor nodes directly so that the HTML
          // generated later contains the clean mediaKey instead of tempMediaId
          if (editor) {
            const { state, view } = editor;
            const tr = state.tr;
            let modified = false;
            state.doc.descendants((node, pos) => {
              if (
                node.type.name === "imageFigure" &&
                node.attrs.tempMediaId === tempMediaId
              ) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  src: viewUrl,
                  tempMediaId: "",
                  mediaKey: result.mediaId,
                });
                modified = true;
              }
            });
            if (modified) {
              view.dispatch(tr);
            }
          }

          // Perbarui resolvedContent jika kita di format STANDARD (mengambil HTML terbaru)
          if (format === "STANDARD" && editor) {
            resolvedContent = editor.getHTML();
          }

          // Simpan mapping tempUrl → media final untuk contentMediaMap
          contentMediaMap.set(tempUrl, {
            mediaId: result.mediaId,
            url: result.url,
            filename: result.filename,
          });
        } catch (err) {
          throw Object.assign(
            new Error(
              `Gagal mempromosikan gambar body (${tempMediaId}): ${(err as Error).message}`,
            ),
            { uploadedFileKeys },
          );
        }
      }

      // 3. Gallery items yang pending
      for (let i = 0; i < resolvedGalleryItems.length; i++) {
        const item = resolvedGalleryItems[i];
        if (!item.isPending || !item.tempMediaId) continue;
        try {
          const result = await promoteOneTempMedia(
            item.tempMediaId,
            {
              caption: item.caption || undefined,
              credit: item.credit || undefined,
            },
            "gallery",
          );
          uploadedFileKeys.push(result.fileKey);
          resolvedGalleryItems[i] = {
            ...item,
            mediaId: result.mediaId,
            imageUrl: result.url,
            tempMediaId: undefined,
            isPending: undefined,
          };
        } catch (err) {
          throw Object.assign(
            new Error(
              `Gagal mempromosikan gambar gallery (${item.tempMediaId}): ${(err as Error).message}`,
            ),
            { uploadedFileKeys },
          );
        }
      }

      return {
        resolvedFeaturedImageId,
        resolvedFeaturedImageUrl,
        resolvedContent,
        resolvedGalleryItems,
        uploadedFileKeys,
        contentMediaMap,
      };
    },
    [
      pendingFeaturedMedia,
      formData.featuredImage,
      editorImageKeys,
      galleryItems,
    ],
  );

  // ─── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e?: React.FormEvent, status?: ArticleStatus) => {
      e?.preventDefault();
      const fdStart = formDataRef.current;
      const titleTrimmed = String(fdStart.title ?? "").trim();
      const categoryHex = normalizeCategoryIdForSubmit(fdStart.categoryId);

      if (!titleTrimmed) {
        toast.error("Judul wajib diisi");
        return;
      }
      if (!categoryHex) {
        toast.error("Channel wajib dipilih");
        return;
      }

      if (!isEditing) {
        draftPersistGenerationRef.current += 1;
      }

      setIsPublishing(true);

      let finalScheduledAt: string = "";
      let finalStatus: ArticleStatus =
        fdStart.status ?? status ?? ArticleStatus.DRAFT;
      const canApplySchedulePick = hasArticleFormStatusPickerAccess(
        currentUser?.role,
      );
      if (
        canApplySchedulePick &&
        fdStart.scheduledAt &&
        fdStart.scheduledAt.trim() !== ""
      ) {
        const wibDate = parseDatetimeLocalAsWib(fdStart.scheduledAt, {
          roundTo5Minutes: true,
        });
        if (wibDate) {
          finalScheduledAt = wibDate.toISOString();
          finalStatus = ArticleStatus.SCHEDULED;
        }
      }

      let uploadedFileKeys: string[] = [];

      try {
        // ── Konten awal ────────────────────────────────────────────────────
        let baseContent: string = "";
        if (format === "STANDARD") {
          const currentHtml = editor?.getHTML() || "";
          baseContent = autoInsertPageBreaks(currentHtml);
          // Selaraskan tampilan editor jika ada perubahan page break otomatis
          if (editor && baseContent !== currentHtml) {
            editor.commands.setContent(baseContent);
            setEditorContentSnapshot(baseContent);
          }
        } else {
          baseContent = fdStart.content ?? "";
        }

        // ── Upload semua pending media ─────────────────────────────────────
        const {
          resolvedFeaturedImageId,
          resolvedFeaturedImageUrl,
          resolvedContent,
          resolvedGalleryItems,
          uploadedFileKeys: keys,
          contentMediaMap,
        } = await uploadAllPendingMedia(baseContent);
        uploadedFileKeys = keys;

        const fd = formDataRef.current;
        const titleAfterUpload = String(fd.title ?? "").trim();
        const categoryAfterUpload = normalizeCategoryIdForSubmit(
          fd.categoryId,
        );
        if (!titleAfterUpload || !categoryAfterUpload) {
          throw Object.assign(
            new Error(
              "Judul atau channel tidak boleh kosong setelah unggah media.",
            ),
            { status: 400 },
          );
        }

        // ── Susun payload ──────────────────────────────────────────────────

        // Featured image sebagai objek ArticleMedia penuh
        const featuredImagePayload = resolvedFeaturedImageId
          ? {
              mediaId: resolvedFeaturedImageId,
              url: resolvedFeaturedImageUrl ?? "",
              caption: (fd.featuredImageAttribution?.caption ?? "").trim(),
              credit: (fd.featuredImageAttribution?.credit ?? "").trim(),
            }
          : null;

        const userRemovedFeaturedImage =
          !pendingFeaturedMedia &&
          (fd.featuredImage === "" ||
            fd.featuredImage === null ||
            fd.featuredImage === undefined);

        // Content media: traverse editor JSON setelah upload selesai.
        // contentMediaMap berisi tempUrl → media final untuk gambar upload baru.
        // Gambar existing dari galeri akan resolve via mediaKey (filename).
        const contentMediaPayload =
          format === "STANDARD"
            ? extractContentMediaFromEditor(editor, editorImageKeys, contentMediaMap)
            : [];

        const payload: Record<string, unknown> = {
          title: titleAfterUpload,
          content: resolvedContent,
          excerpt: fd.excerpt ?? "",
          categoryId: categoryAfterUpload,
          tags: (fd.tags || "")
            .replace(/,\s*$/, "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ...(featuredImagePayload
            ? { featuredImage: featuredImagePayload }
            : !isEditing || userRemovedFeaturedImage
              ? { featuredImage: null }
              : {}),
          status: finalStatus,
          scheduledAt: finalScheduledAt,
          format,
          relatedArticles: relatedArticles.map((item, index) => ({
            article_id: item.article_id ?? (item.article ? item.article._id : item._id),
            order: index,
          })),
        };

        if (format === "STANDARD") {
          payload.contentMedia = contentMediaPayload;
        }

        if (format === "GALLERY") {
          payload.galleryItems = resolvedGalleryItems.map((item) => ({
            mediaId: item.mediaId,
            caption: item.caption ?? "",
            credit: item.credit ?? "",
            order: item.order,
          }));
        }

        if (canPickArticleAttribution(currentUser?.role)) {
          const aid = (fd.authorId ?? "").trim();
          if (aid && /^[a-f\d]{24}$/i.test(aid)) {
            payload.authorId = aid;
          }
          const eid = (fd.editorId ?? "").trim();
          payload.editorId =
            eid && /^[a-f\d]{24}$/i.test(eid) ? eid : null;
        }

        if (isEditing && fd.reason) {
          payload.reason = fd.reason;
        }

        // ── Kirim ke server ────────────────────────────────────────────────
        if (isEditing && idArticle) {
          await api.patch(`/articles/${idArticle}`, payload);
          toast.success("Article updated successfully!");
        } else {
          await api.post("/articles", payload);
          toast.success("Article created successfully!");
        }

        // ── Bersihkan draft (create: reset form agar tidak ter-restore) ──
        if (!isEditing) {
          suppressDraftPersistRef.current = true;
          draftPersistGenerationRef.current += 1;
        }
        removeArticleDraft(getArticleDraftStorageKey(format));
        if (!isEditing) {
          clearForm();
        }

        setTimeout(() => {
          router.replace(adminPanelHref("articles"));
        }, 1500);
      } catch (error: unknown) {
        // Rollback: hapus file yang sudah terupload di object storage
        if (uploadedFileKeys.length > 0) {
          api
            .post("/media/cleanup", { fileKeys: uploadedFileKeys })
            .catch(() => {});
        }

        // Ambil uploadedFileKeys dari error jika ada (dari uploadAllPendingMedia)
        const errKeys = (error as Record<string, unknown>)?.uploadedFileKeys as
          | string[]
          | undefined;
        if (errKeys && errKeys.length > 0 && uploadedFileKeys.length === 0) {
          api
            .post("/media/cleanup", { fileKeys: errKeys })
            .catch(() => {});
        }

        console.error("Error submitting article:", error);
        toast.error(getApiErrorMessage(error, "Gagal menyimpan artikel"));
      } finally {
        setIsPublishing(false);
      }
    },
    [
      formData,
      isEditing,
      idArticle,
      editor,
      router,
      format,
      uploadAllPendingMedia,
      currentUser?.role,
      formData.authorId,
      formData.editorId,
    ],
  );

  // ─── Picker handlers ──────────────────────────────────────────────────────
  const handlePickerSelect = useCallback(
    (result: ImagePickerResult) => {
      const { media, articleAttribution } = result;
      const isPending = media._id === null;

      if (pickerContext === "featured") {
        // Simpan atribusi khusus artikel
        setFormData((prev) => ({
          ...prev,
          featuredImageAttribution: articleAttribution,
        }));

        if (isPending) {
          // PendingMedia sudah melewati crop di ImagePickerModal (cropForFeatured=true)
          // dan sudah tersimpan di /temp — langsung simpan referensi ke state.
          const pm = media as PendingMedia;

          setPendingFeaturedMedia(pm);
          setFeaturedImagePreview(pm.tempUrl);
          setFormData((prev) => ({ ...prev, featuredImage: "" }));
          setPickerOpen(false);
        } else {
          // Media dari galeri (sudah ada) — langsung gunakan tanpa crop / upload ulang
          const existingMedia = media as Media;
          setFormData((prev) => ({
            ...prev,
            featuredImage: existingMedia,
            featuredImageAttribution: {
              caption: articleAttribution.caption || existingMedia.caption || "",
              credit: articleAttribution.credit || "",
            },
          }));
          setPendingFeaturedMedia(null); // Bersihkan pending featured media lama jika ada
          const previewUrl = getMediaPreviewUrl(existingMedia) || "";
          setFeaturedImagePreview(previewUrl);
          setPickerOpen(false);
        }
        return;
      } else if (pickerContext === "editor") {
        if (isPending) {
          const pm = media as PendingMedia;

          // Insert node ImageFigure (gambar + caption sebagai satu atom)
          editor?.chain().focus().setImageFigure({
            src: pm.tempUrl,
            caption: articleAttribution.caption,
            credit: articleAttribution.credit,
            tempMediaId: pm.tempMediaId,
            mediaKey: pm.tempMediaId, // sementara, diganti setelah promote
          }).run();

          setEditorImageKeys((prev) => [
            ...prev,
            {
              tempMediaId: pm.tempMediaId,
              meta: {
                caption: articleAttribution.caption,
                credit: articleAttribution.credit,
                watermark: pm.watermark,
              },
            },
          ]);
        } else {
          const existingMedia = media as Media;
          const url = getMediaPreviewUrl(existingMedia);
          if (url) {
            // Insert node ImageFigure untuk gambar dari galeri.
            // mediaKey menggunakan _id (bukan filename) agar backend bisa
            // lookup langsung via ObjectId tanpa query tambahan.
            editor?.chain().focus().setImageFigure({
              src: url,
              caption: articleAttribution.caption,
              credit: articleAttribution.credit,
              mediaKey: existingMedia._id,
              tempMediaId: "",
            }).run();
          }
        }
      } else if (pickerContext === "gallery") {
        // Single-select path yang masuk sini hanya dari tab Upload.
        // (Tab Gallery di mode multi-select sudah ditangani oleh handlePickerSelectMultiple.)
        // Tambahkan sebagai satu item galeri, pakai attribution yang sudah diisi user.
        const pm = media as PendingMedia;
        const m = media as Media;
        setGalleryItems((prev) => {
          const maxOrder =
            prev.length > 0 ? Math.max(...prev.map((i) => i.order)) : -1;
          return [
            ...prev,
            {
              id: `${Date.now()}-gallery-single`,
              mediaId: isPending ? "" : (m._id ?? ""),
              imageUrl: isPending
                ? pm.tempUrl
                : `/api/media/view?key=${encodeURIComponent(m.filename)}`,
              caption:
                articleAttribution.caption ||
                (media.caption ?? ""),
              credit: articleAttribution.credit || "",
              order: maxOrder + 1,
              tempMediaId: isPending ? pm.tempMediaId : undefined,
              isPending: isPending || undefined,
            },
          ];
        });
      }
    },
    [pickerContext, editor, abortFeaturedCrop],
  );

  const handlePickerSelectMultiple = useCallback(
    (result: MultiImagePickerResult) => {
      if (pickerContext === "gallery") {
        // Multi-select: setiap item sudah memiliki attribution default dari media
        handleAddMultipleGalleryImages(
          result.selectedMediaArray.map((item) => item.media),
        );
      }
    },
    [pickerContext, handleAddMultipleGalleryImages],
  );

  // ─── URL preview & change detection ───────────────────────────────────────
  const previewPublicPath = useMemo(() => {
    const slug = initialData?.slug?.trim();
    if (!slug) return null;

    const urlFormat = initialData?.urlFormat ?? resolveUrlFormatForNewArticle();
    if (urlFormat !== "structured") return null;

    const categorySlug = categories.find(
      (c) => c._id === formData.categoryId,
    )?.slug?.trim();
    if (!categorySlug) return null;

    const publishedAtRaw =
      formData.scheduledAt ||
      initialData?.publishedAt ||
      initialData?.scheduledAt;
    if (!publishedAtRaw) return null;

    const publishedAt = new Date(publishedAtRaw);
    if (Number.isNaN(publishedAt.getTime())) return null;

    const isPublishedContext =
      formData.status === ArticleStatus.PUBLISHED ||
      formData.status === ArticleStatus.SCHEDULED ||
      initialData?.status === ArticleStatus.PUBLISHED;

    if (!isPublishedContext) return null;

    try {
      return buildArticlePublicPath({
        slug,
        publishedAt,
        categorySlug,
        urlFormat: "structured",
        status: ArticleStatus.PUBLISHED,
      });
    } catch {
      return initialData?.publicPath ?? null;
    }
  }, [
    initialData?.slug,
    initialData?.urlFormat,
    initialData?.publishedAt,
    initialData?.scheduledAt,
    initialData?.status,
    initialData?.publicPath,
    formData.categoryId,
    formData.scheduledAt,
    formData.status,
    categories,
  ]);

  const urlWillChange = useMemo(() => {
    if (!isEditing) return false;
    if (initialData?.status !== ArticleStatus.PUBLISHED) return false;
    if (initialData?.urlFormat !== "structured") return false;
    if (!previewPublicPath || !initialData?.publicPath) return false;
    return !pathsEqual(previewPublicPath, initialData.publicPath);
  }, [
    isEditing,
    initialData?.status,
    initialData?.urlFormat,
    initialData?.publicPath,
    previewPublicPath,
  ]);

  // ─── Status logic ─────────────────────────────────────────────────────────
  const allowedStatus = useMemo(() => {
    if (!hasArticleFormStatusPickerAccess(currentUser?.role)) {
      return [];
    }
    return isEditing
      ? articleEditorEditStatusChoices(formData.status, currentUser?.role)
      : articleEditorCreateStatusChoices();
  }, [currentUser?.role, isEditing, formData.status]);

  const isOwnArticle = useMemo(() => {
    if (!isEditing) return true;
    const authorId = String(
      formData.authorId || initialData?.authorId || "",
    ).trim();
    const userId = String(currentUser?._id ?? "").trim();
    return Boolean(authorId && userId && authorId === userId);
  }, [
    isEditing,
    formData.authorId,
    initialData?.authorId,
    currentUser?._id,
  ]);

  /** Status workflow: pakai status awal artikel agar tombol tidak berubah sebelum save selesai. */
  const workflowStatus = isEditing
    ? (initialData?.status ?? formData.status)
    : formData.status;

  const writerActions = useMemo(() => {
    if (!isWriterRole(currentUser?.role)) return null;
    return getWriterArticleActions(workflowStatus, {
      isEditing,
      isOwnArticle,
    });
  }, [currentUser?.role, workflowStatus, isEditing, isOwnArticle]);

  const isViewOnly = writerActions?.isViewOnly ?? false;

  const showSaveDraftHeader = writerActions
    ? writerActions.showSaveDraft
    : !isEditing || usesWriterArticleFormSubmit(currentUser?.role);

  const showSecondarySave = writerActions
    ? writerActions.showSecondarySave
    : true;

  const showTakeDownButton = writerActions
    ? writerActions.showTakeDown
    : isEditing; // editor / EIC / admin: take down artikel mana pun di mode edit

  const secondarySubmitLabel = writerActions
    ? writerActions.secondaryLabel
    : isEditing && hasArticleFormStatusPickerAccess(currentUser?.role)
      ? "Save changes"
      : "Submit";

  const [pendingSubmit, setPendingSubmit] = useState<null | ArticleStatus>(
    null,
  );

  // Kunci editor TipTap saat artikel Taken Down (writer view-only)
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isViewOnly);
  }, [editor, isViewOnly]);

  const hasRequiredFeaturedImage = useCallback((): boolean => {
    if (pendingFeaturedMedia) return true;
    const fi = formDataRef.current.featuredImage;
    if (!fi) return false;
    if (typeof fi === "string") return fi.trim().length > 0;
    if (typeof fi === "object") {
      const mediaObj = fi as unknown as Record<string, unknown>;
      const id = mediaObj._id;
      const mediaId = mediaObj.mediaId;
      return (
        (typeof id === "string" && id.trim().length > 0) ||
        (typeof mediaId === "string" && mediaId.trim().length > 0)
      );
    }
    return false;
  }, [pendingFeaturedMedia]);

  const handleSubmitDraft = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isViewOnly) return;
    if (!hasRequiredFeaturedImage()) {
      toast.error("Featured image wajib ditambahkan sebelum menyimpan.");
      return;
    }
    // Sisipkan page break otomatis jika berformat STANDARD sebelum menyimpan draft
    if (format === "STANDARD" && editor) {
      const currentHtml = editor.getHTML();
      const updatedHtml = autoInsertPageBreaks(currentHtml);
      if (updatedHtml !== currentHtml) {
        editor.commands.setContent(updatedHtml);
        setEditorContentSnapshot(updatedHtml);
      }
    }
    setFormData((prev) => ({ ...prev, status: ArticleStatus.DRAFT }));
    setPendingSubmit(ArticleStatus.DRAFT);
  };

  const handleSubmitPublish = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isViewOnly) return;
    if (!hasRequiredFeaturedImage()) {
      toast.error("Featured image wajib ditambahkan sebelum submit.");
      return;
    }
    // Sisipkan page break otomatis jika berformat STANDARD sebelum mempublikasikan
    if (format === "STANDARD" && editor) {
      const currentHtml = editor.getHTML();
      const updatedHtml = autoInsertPageBreaks(currentHtml);
      if (updatedHtml !== currentHtml) {
        editor.commands.setContent(updatedHtml);
        setEditorContentSnapshot(updatedHtml);
      }
    }
    if (writerActions) {
      const nextStatus = writerActions.secondaryStatus;
      setFormData((prev) => ({ ...prev, status: nextStatus }));
      setPendingSubmit(nextStatus);
      return;
    }
    if (usesWriterArticleFormSubmit(currentUser?.role)) {
      const nextStatus = ArticleStatus.PENDING_REVIEW;
      setFormData((prev) => ({ ...prev, status: nextStatus }));
      setPendingSubmit(nextStatus);
      return;
    }
    const nextStatus = formData.status ?? ArticleStatus.PUBLISHED;
    setFormData((prev) => ({ ...prev, status: nextStatus }));
    setPendingSubmit(nextStatus);
  };

  useEffect(() => {
    if (pendingSubmit === null) return;
    if (formData.status === pendingSubmit) {
      handleSubmit(undefined, pendingSubmit);
      setPendingSubmit(null);
    }
  }, [formData.status, pendingSubmit, handleSubmit]);

  return (
    <>
      <CropImageModal
        open={featuredCropOpen && Boolean(featuredCropSrc)}
        imageSrc={featuredCropSrc ?? ""}
        aspect={FEATURED_IMAGE_ASPECT}
        outputWidth={FEATURED_IMAGE_WIDTH}
        outputHeight={FEATURED_IMAGE_HEIGHT}
        webpQuality={FEATURED_WEBP_QUALITY}
        title="Sesuaikan gambar unggulan (1280 × 800)"
        onCrop={(blob) => handleFeaturedCropApply(blob)}
        onCancel={abortFeaturedCrop}
      />
      <ArticleEditorFormUi
        idArticle={idArticle}
        isEditing={isEditing}
        lastSaved={lastSaved}
        previewArticle={previewArticle}
        clearForm={clearForm}
        takeDownDialogOpen={takeDownDialogOpen}
        setTakeDownDialogOpen={setTakeDownDialogOpen}
        handleTakeDown={handleTakeDown}
        handleSubmitDraft={handleSubmitDraft}
        handleSubmitPublish={handleSubmitPublish}
        showSaveDraftHeader={showSaveDraftHeader}
        showSecondarySave={showSecondarySave}
        showTakeDownButton={showTakeDownButton}
        isViewOnly={isViewOnly}
        showWriterStatusHints={Boolean(writerActions)}
        secondarySubmitLabel={secondarySubmitLabel}
        isPublishing={isPublishing}
        formData={formData}
        setFormData={setFormData}
        handlePickerSelect={handlePickerSelect}
        handlePickerSelectMultiple={handlePickerSelectMultiple}
        setPickerContext={setPickerContext}
        pickerContext={pickerContext}
        pickerOpen={pickerOpen}
        setPickerOpen={setPickerOpen}
        editor={editor}
        featuredImagePreview={featuredImagePreview}
        removeFeaturedImage={removeFeaturedImage}
        categories={categories}
        allowedStatus={allowedStatus}
        format={format}
        galleryItems={galleryItems}
        galleryMediaIds={galleryItems.map((item) => item.mediaId).filter(Boolean)}
        relatedArticles={relatedArticles}
        setRelatedArticles={setRelatedArticles}
        onGalleryItemCaption={handleGalleryItemCaption}
        onGalleryItemCredit={handleGalleryItemCredit}
        onGalleryItemRemove={handleGalleryItemRemove}
        onGalleryReorder={handleGalleryReorder}
        onAddGalleryImage={handleAddGalleryImage}
        canPickAttribution={canPick}
        attributionAuthors={attributionOptions.authors}
        attributionEditors={attributionOptions.editors}
        attributionLoading={attributionOptions.loading}
        currentPublicPath={previewPublicPath}
        urlWillChange={urlWillChange}
      />
    </>
  );
}
