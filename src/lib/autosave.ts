import {
	ArticleStatus,
	DraftArticle,
	DraftGalleryItem,
} from "@/types/article";

/**
 * Autosave article to database (for edit) or localStorage (for create)
 */

/** @deprecated Legacy key — migrasi ke key per format. */
export const LEGACY_ARTICLE_DRAFT_KEY = "arasvara-article-draft";

const DEFAULT_DRAFT_KEY = LEGACY_ARTICLE_DRAFT_KEY;

export type ArticleDraftFormat = "STANDARD" | "GALLERY";

export function getArticleDraftStorageKey(
	format: ArticleDraftFormat,
): string {
	return format === "GALLERY"
		? "arasvara-article-draft-gallery"
		: "arasvara-article-draft-standard";
}

export interface EditorInstance {
	getHTML: () => string;
}

type DraftFormInput = {
	title?: string;
	content?: string;
	excerpt?: string;
	categoryId?: string | { $oid?: string };
	tags?: string | string[];
	featuredImage?: unknown;
	/** Atribusi gambar unggulan khusus artikel (caption & credit). */
	featuredImageAttribution?: { caption: string; credit: string };
	status?: ArticleStatus;
	scheduledAt?: string | null;
	relatedArticles?: unknown[];
};

export interface AutosaveParams {
	formData: DraftFormInput;
	editor: EditorInstance | null;
	activeParamArticle?: string | null;
	setActiveParamArticle?: (id: string) => void;
	setLastSaved: (date: Date) => void;
	setAutoSaving: (saving: boolean) => void;
	autoSaving: boolean;
	featuredImagePreviewUrl?: string | null;
	storageKey?: string;
	format?: ArticleDraftFormat;
	galleryItems?: DraftGalleryItem[];
	/** IDB key untuk featured image yang belum diunggah. */
	pendingFeaturedIdbKey?: string | null;
	/** Pasangan blobUrl ↔ idbKey untuk gambar di body editor. */
	editorImageKeys?: Array<{
		blobUrl: string;
		idbKey: string;
		meta?: { caption?: string; credit?: string; watermark?: boolean };
	}>;
	/** Jika mengembalikan false, draft tidak ditulis (mis. setelah submit berhasil). */
	shouldPersist?: () => boolean;
}

export type PersistArticleDraftSyncParams = Omit<
	AutosaveParams,
	"setLastSaved" | "setAutoSaving" | "autoSaving"
>;

function normalizeCategoryId(categoryId: DraftFormInput["categoryId"]): string {
	if (!categoryId) return "";
	if (typeof categoryId === "string") return categoryId;
	return categoryId.$oid ?? "";
}

function normalizeTags(tags: DraftFormInput["tags"]): string {
	if (!tags) return "";
	if (Array.isArray(tags)) {
		return tags
			.map((tag) => tag.trim())
			.filter(Boolean)
			.join(", ");
	}
	return tags;
}

function normalizeFeaturedImage(
	featuredImage: DraftFormInput["featuredImage"],
): string | null {
	if (!featuredImage) return null;
	if (typeof featuredImage === "string") {
		return featuredImage.trim() || null;
	}
	if (
		typeof featuredImage === "object" &&
		featuredImage !== null &&
		"_id" in featuredImage
	) {
		const value = (featuredImage as { _id?: unknown })._id;
		return typeof value === "string" && value.trim() ? value : null;
	}
	return null;
}

function resolveDraftContent(
	format: ArticleDraftFormat,
	formData: DraftFormInput,
	editor: EditorInstance | null,
): string {
	if (format === "GALLERY") {
		return formData.content ?? "";
	}
	return editor?.getHTML() ?? formData.content ?? "";
}

function serializeGalleryItems(
	items: DraftGalleryItem[] | undefined,
): DraftGalleryItem[] {
	if (!Array.isArray(items)) return [];
	return items.map((item) => ({
		id: item.id,
		mediaId: item.mediaId ?? "",
		// Pending: jangan andalkan blob URL setelah reload — pulihkan via idbKey
		imageUrl: item.isPending ? "" : (item.imageUrl ?? ""),
		caption: item.caption ?? "",
		credit: item.credit ?? "",
		order: typeof item.order === "number" ? item.order : 0,
		...(item.idbKey ? { idbKey: item.idbKey } : {}),
		...(item.isPending ? { isPending: true } : {}),
	}));
}

function createDraftPayload({
	formData,
	editor,
	activeParamArticle,
	featuredImagePreviewUrl,
	pendingFeaturedIdbKey,
	editorImageKeys,
	format = "STANDARD",
	galleryItems = [],
}: {
	formData: DraftFormInput;
	editor: EditorInstance | null;
	activeParamArticle: string | null;
	featuredImagePreviewUrl: string | null;
	pendingFeaturedIdbKey?: string | null;
	editorImageKeys?: AutosaveParams["editorImageKeys"];
	format?: ArticleDraftFormat;
	galleryItems?: DraftGalleryItem[];
}): DraftArticle {
	const content = resolveDraftContent(format, formData, editor);

	return {
		articleId: activeParamArticle,
		title: formData.title ?? "",
		content,
		excerpt: formData.excerpt ?? "",
		categoryId: normalizeCategoryId(formData.categoryId),
		tags: normalizeTags(formData.tags),
		format,
		galleryItems:
			format === "GALLERY" ? serializeGalleryItems(galleryItems) : undefined,
		featuredImage: normalizeFeaturedImage(formData.featuredImage),
		featuredImageAttribution: formData.featuredImageAttribution ?? {
			caption: "",
			credit: "",
		},
		status: formData.status ?? ArticleStatus.DRAFT,
		scheduledAt: formData.scheduledAt ?? "",
		featuredImagePreviewUrl: featuredImagePreviewUrl || null,
		pendingFeaturedIdbKey: pendingFeaturedIdbKey ?? null,
		editorImageKeys: editorImageKeys ?? [],
		relatedArticles: (formData.relatedArticles ?? []) as DraftArticle["relatedArticles"],
		savedAt: new Date().toISOString(),
	};
}

/**
 * Tulis draft ke localStorage secara sinkron (flush saat unmount / pagehide).
 */
export function persistArticleDraftSync({
	formData,
	editor,
	activeParamArticle = null,
	featuredImagePreviewUrl = null,
	storageKey = DEFAULT_DRAFT_KEY,
	format = "STANDARD",
	galleryItems = [],
	pendingFeaturedIdbKey = null,
	editorImageKeys = [],
	shouldPersist,
}: PersistArticleDraftSyncParams): void {
	if (typeof window === "undefined") return;
	if (activeParamArticle) return;
	if (shouldPersist && !shouldPersist()) return;

	const payload = createDraftPayload({
		formData,
		editor,
		activeParamArticle,
		featuredImagePreviewUrl,
		pendingFeaturedIdbKey,
		editorImageKeys,
		format,
		galleryItems,
	});

	localStorage.setItem(storageKey, JSON.stringify(payload));
}

/**
 * Baca draft dari key format; fallback legacy key jika cocok format halaman.
 */
export function readArticleDraftRaw(
	format: ArticleDraftFormat,
): string | null {
	if (typeof window === "undefined") return null;

	const key = getArticleDraftStorageKey(format);
	const raw = localStorage.getItem(key);
	if (raw) return raw;

	const legacy = localStorage.getItem(LEGACY_ARTICLE_DRAFT_KEY);
	if (!legacy) return null;

	try {
		const parsed = JSON.parse(legacy) as { format?: string };
		const legacyFormat: ArticleDraftFormat =
			parsed.format === "GALLERY" ? "GALLERY" : "STANDARD";
		if (legacyFormat !== format) return null;
		localStorage.setItem(key, legacy);
		localStorage.removeItem(LEGACY_ARTICLE_DRAFT_KEY);
		return legacy;
	} catch {
		return null;
	}
}

export async function autosaveArticle({
	formData,
	editor,
	activeParamArticle = null,
	setLastSaved,
	setAutoSaving,
	autoSaving,
	featuredImagePreviewUrl = null,
	storageKey = DEFAULT_DRAFT_KEY,
	format = "STANDARD",
	galleryItems = [],
	pendingFeaturedIdbKey = null,
	editorImageKeys = [],
	shouldPersist,
}: AutosaveParams): Promise<void> {
	if (autoSaving) return;

	setAutoSaving(true);
	try {
		if (!activeParamArticle) {
			if (shouldPersist && !shouldPersist()) {
				return;
			}

			const payload = createDraftPayload({
				formData,
				editor,
				activeParamArticle,
				featuredImagePreviewUrl,
				pendingFeaturedIdbKey,
				editorImageKeys,
				format,
				galleryItems,
			});

			if (shouldPersist && !shouldPersist()) {
				return;
			}

			localStorage.setItem(storageKey, JSON.stringify(payload));
			setLastSaved(new Date());
			return;
		}

		setLastSaved(new Date());
	} catch (error) {
		console.error("Auto-save error:", error);
	} finally {
		setAutoSaving(false);
	}
}

/**
 * Hapus draft artikel dari localStorage
 */
export function removeArticleDraft(key = DEFAULT_DRAFT_KEY) {
	if (typeof window !== "undefined") {
		localStorage.removeItem(key);
	}
}
