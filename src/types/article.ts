import { ObjectId } from "mongodb";
import { Category } from "./category";
import { UserProfile } from "./user";
import { Media, PayloadCreateMedia } from "./media";
import { SectionArticleItem } from "./articleSection";

// Enum for Article Status (sync with constants)
export type ArticleUrlFormat = "legacy" | "structured";

export enum ArticleStatus {
	DRAFT = "DRAFT",
	PENDING_REVIEW = "PENDING_REVIEW",
	PUBLISHED = "PUBLISHED",
	SCHEDULED = "SCHEDULED",
	REJECTED = "REJECTED",
	TAKEN_DOWN = "TAKEN_DOWN",
	DELETED = "DELETED",
}

export interface Tag {
	_id?: string;
	name: string;
	slug: string;
}

export interface ArticleMediaStored {
	mediaId: string | ObjectId;
	filename: string;
	caption: string;
	credit: string;
}

/** Dikembalikan ke client via API — url adalah CDN yang dibangun saat read. */
export interface ArticleMedia {
	mediaId: string | ObjectId;
	url: string;
	caption: string;
	credit: string;
	media?: Media | null;
}

export interface GalleryItem extends ArticleMedia {
	order: number;
}

/** Disimpan di MongoDB untuk artikel galeri. */
export interface GalleryItemStored extends ArticleMediaStored {
	order: number;
}

export interface BaseArticle {
	_id?: string;
	title: string;
	slug: string;
	excerpt: string;
	categoryId: string;
	category: Category;
	tags: Tag[];
	featuredImage?: ArticleMedia;
	authorId: string;
	author: UserProfile;
	editorId?: string | null;
	editor?: UserProfile | null;
	/** Urutan mengikuti `contributorIds` di DB (baca editorial / admin). */
	contributors?: UserProfile[] | null;
	/** Hanya untuk round-trip form admin; tidak wajib di tampilan publik. */
	contributorIds?: string[];
	status: ArticleStatus;
	viewCount: number;
	metaTitle?: string;
	metaDesc?: string;
	publishedAt: Date;
	publishedBy?: string | ObjectId;
	scheduledAt?: Date | null;
	/** Terakhir title/excerpt/content berubah setelah publish (untuk SEO dateModified). */
	contentUpdatedAt?: Date | null;
	createdAt: Date;
	createdBy?: UserProfile | null;
	submittedAt?: Date;
	updatedAt: Date;
	deletedAt?: Date | null;
	revisionHistory?: ArticleRevision[];
	relatedArticles?: SectionArticleItem[];
	isFeatured?: boolean;
	isHeadline?: boolean;
	isBreaking?: boolean;
	isPopular?: boolean;
	isEditorChoices?: boolean;
	/** Path kanonik publik denormalized, mis. /news/nasional/2026/06/19/judul */
	publicPath?: string | null;
	/** legacy = /news/{slug}; structured = path hierarkis WIB */
	urlFormat?: ArticleUrlFormat;
}

// Tipe untuk Artikel Teks Biasa
export interface StandardArticle extends BaseArticle {
	format: "STANDARD";
	content: string; // Wajib ada untuk teks
	contentMedia?: ArticleMedia[];
}

// Tipe untuk Artikel Galeri
export interface GalleryArticle extends BaseArticle {
	format: "GALLERY";
	content?: string; // Menjadi opsional (hanya untuk pengantar singkat jika ada)
	galleryItems: GalleryItem[]; // Wajib ada untuk galeri
}

export type Article = StandardArticle | GalleryArticle;

export interface ArticleListResponse {
	_id?: string;
	title: string;
	slug: string;
	excerpt: string;
	category: Category;
	tags: Tag[];
	featuredImage?: ArticleMedia | null; // data media lengkap, bisa null jika tidak ada featured image
	author: UserProfile;
	editor?: UserProfile | null;
	status: ArticleStatus;
	isFeatured?: boolean;
	isHeadline?: boolean;
	isBreaking?: boolean;
	isPopular?: boolean;
	isEditorChoices?: boolean;
	viewCount: number;
	publishedAt: Date;
	updatedAt: Date;
	/** Ada pada hasil pencarian / list ringkas */
	format?: "STANDARD" | "GALLERY";
	publicPath?: string | null;
	urlFormat?: ArticleUrlFormat;
}

export interface ArticleRevision {
	by: string | ObjectId; // userId editor yang mengembalikan
	at: Date; // waktu revisi
	from: ArticleStatus; // status sebelum revisi (misal: PENDING_REVIEW)
	to: ArticleStatus; // status setelah revisi (misal: DRAFT)
	reason?: string; // alasan revisi (opsional)
}

export interface GetAllArticlesParams {
	limit?: number;
	page?: number;
	authorId?: string;
	userId?: string;
	categorySlug?: string;
	status?: string;
	featured?: boolean;
	headline?: boolean;
	search?: string;
	cursor?: string;
	excludeIds?: string[];
	/** Filter format artikel (STANDARD | GALLERY) */
	format?: "STANDARD" | "GALLERY";
}

export interface GetAllArticlesResult {
	articles: Article[];
	nextCursor: string | null;
	hasMore: boolean;
	total: number;
}

export interface ArticleListPage<TArticle = Article> {
	articles: TArticle[];
	nextCursor: string | null;
	hasMore: boolean;
	total: number;
	totalPages: number;
}

export type RelatedResponse = {
	article: Article;
	related: Article[];
};

// Payload untuk form create/edit article (frontend ke backend, multipart/form-data)
export interface ArticleFormData {
	title: string;
	content: string; // HTML atau JSON string dari editor
	excerpt?: string;
	categoryId: string;
	tags?: string[]; // array of tag name/slug, atau string[]
	featuredImage?: ArticleMedia | PayloadCreateMedia | string;
	/** Caption khusus gambar unggulan (per artikel), bukan caption file di koleksi media */
	captionFeaturedImage?: string | null;
	contentMedia?: ArticleMedia[] | string[];
	galleryItems?: GalleryItem[];
	status?: ArticleStatus;
	scheduledAt?: string | null;
	format?: "STANDARD" | "GALLERY"; // Tipe format artikel (default: STANDARD)
	/** Hanya diproses jika role boleh atribusi manual (editor+). */
	authorId?: string;
	editorId?: string | null;
	contributorIds?: string[];
	relatedArticles?: SectionArticleItem[];
}

export interface UpdateArticleFormData extends Partial<ArticleFormData> {
	articleId: string; // id artikel yang mau diupdate
	reason?: string;
	// format tidak bisa diubah setelah artikel dibuat (immutable)
}

/** Item galeri terserialisasi di draft localStorage (create mode). */
export interface DraftGalleryItem {
	id: string;
	mediaId: string;
	imageUrl: string;
	caption: string;
	credit: string;
	order: number;
	/** ID media temp di object storage (`temp/`) untuk item yang belum di-promote. */
	tempMediaId?: string;
	isPending?: boolean;
}

export interface DraftArticle {
	articleId: string | null;
	title: string;
	content: string;
	excerpt: string;
	categoryId: string;
	tags: string;
	/** Format artikel saat draft disimpan — isolasi STANDARD vs GALLERY. */
	format?: "STANDARD" | "GALLERY";
	/** Item galeri (hanya untuk format GALLERY). */
	galleryItems?: DraftGalleryItem[];
	featuredImage: string | null;
	/** Atribusi caption & credit gambar unggulan khusus artikel ini. */
	featuredImageAttribution?: { caption: string; credit: string };
	status: ArticleStatus;
	scheduledAt: string;
	contentMedia?: ArticleMedia[] | string[];
	featuredImagePreviewUrl?: string | null;
	savedAt: string;

	// Legacy: draft lama / penempatan beranda diurus di section CMS.
	isFeatured?: boolean;
	isHeadline?: boolean;
	isBreaking?: boolean;
	isPopular?: boolean;
	isEditorChoices?: boolean;

	/** Temp media ID untuk featured image yang belum dipromosikan ke server. */
	pendingFeaturedTempId?: string | null;
	/** Temp media ID untuk gambar body editor yang belum dipromosikan. */
	editorImageKeys?: Array<{
		tempMediaId: string;
		meta?: { caption?: string; credit?: string; watermark?: boolean };
	}>;

	// Legacy fields for backward compatibility with old drafts.
	featuredImageKey?: string;
	author?: {
		name?: string;
		avatar?: string | null;
	};
	category?: Category;
	relatedArticles?: SectionArticleItem[];
}

export interface ApprovalPayload {
	status: ArticleStatus;
	scheduledAt?: string | null;
	reason?: string;
	/** Hanya diproses jika role boleh atribusi (sama seperti update artikel). */
	authorId?: string;
	editorId?: string | null;
	contributorIds?: string[];
}

// Manual mapping: status → allowed roles
export const STATUS_ROLE_MAP: Record<ArticleStatus, string[]> = {
	DRAFT: [
		"reporter",
		"writer",
		"contributor",
		"editor",
		"head-of",
		"managing-editor",
		"editor-in-chief",
		"admin",
	],
	PENDING_REVIEW: [
		"reporter",
		"writer",
		"contributor",
		"editor",
		"head-of",
		"managing-editor",
		"editor-in-chief",
		"admin",
	],
	REJECTED: [
		"editor",
		"head-of",
		"managing-editor",
		"editor-in-chief",
		"admin",
	],
	PUBLISHED: [
		"editor",
		"head-of",
		"managing-editor",
		"editor-in-chief",
		"admin",
	],
	SCHEDULED: [
		"editor",
		"head-of",
		"managing-editor",
		"editor-in-chief",
		"admin",
	],
	TAKEN_DOWN: [
		"editor",
		"head-of",
		"managing-editor",
		"editor-in-chief",
		"admin",
	],
	DELETED: ["editor-in-chief", "admin"],
};

// Notifikasi: status → {roles, message}
export const STATUS_NOTIFICATION: Record<
	ArticleStatus,
	{ roles: string[]; getMessage: (article: Article, reason?: string) => string }
> = {
	DRAFT: {
		roles: [],
		getMessage: () => "", // Tidak perlu notifikasi
	},
	PENDING_REVIEW: {
		roles: ["editor", "head-of"],
		getMessage: (a) => `Artikel "${a.title}" menunggu review.`,
	},
	REJECTED: {
		roles: ["reporter", "writer", "contributor"],
		getMessage: (a, r) =>
			`Artikel "${a.title}" ditolak.${r ? " Alasan: " + r : ""}`,
	},
	PUBLISHED: {
		roles: ["reporter", "writer", "contributor"],
		getMessage: (a) => `Artikel "${a.title}" telah dipublikasikan.`,
	},
	SCHEDULED: {
		roles: ["reporter", "writer", "contributor"],
		getMessage: (a) => `Artikel "${a.title}" dijadwalkan terbit.`,
	},
	TAKEN_DOWN: {
		roles: ["reporter", "writer", "contributor"],
		getMessage: (a, r) =>
			`Artikel "${a.title}" di-takedown.${r ? " Alasan: " + r : ""}`,
	},
	DELETED: {
		roles: ["reporter", "writer", "contributor"],
		getMessage: (a, r) =>
			`Artikel "${a.title}" dihapus.${r ? " Alasan: " + r : ""}`,
	},
};

// ─── Payload Types ────────────────────────────────────────────────────────────
export interface AutosavePayload {
	articleId?: string;
	title?: string;
	content?: string;
	excerpt?: string;
	categoryId?: unknown;
	tags?: string[];
	featuredImage?: string;
	status?: string;
	scheduledAt?: string | null;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CategoryOption {
	_id: string;
	name: string;
	slug?: string;
}

export interface ArticleInitialData {
	title?: string;
	excerpt?: string;
	content?: string;
	slug?: string;
	categoryId?: string;
	tags?: string; // comma-separated
	featuredImage?: string | Media | ArticleMedia;
	captionFeaturedImage?: string;
	status?: ArticleStatus;
	scheduledAt?: string; // always string, never null
	contentMedia?: ArticleMedia[] | string[];
	galleryItems?: GalleryItem[];
	authorId?: string;
	editorId?: string | null;
	contributorIds?: string[];
	relatedArticles?: SectionArticleItem[];
	publicPath?: string | null;
	urlFormat?: ArticleUrlFormat;
	publishedAt?: string;
}

export interface ArticleEditorFormProps {
	mode: "create" | "edit";
	paramArticle?: string;
	idArticle?: string;
	initialData?: ArticleInitialData;
	categories: CategoryOption[];
}
