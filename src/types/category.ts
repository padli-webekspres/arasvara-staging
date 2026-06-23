import { ObjectId } from "mongodb";

export interface Category {
	_id?: ObjectId | string;
	name: string;
	slug: string;
	nickname?: string;
	showOnNavbar?: boolean;
	description?: string;
	order?: number;
	featured?: boolean;
	featuredOrder?: number;
	parentId?: string | ObjectId | null;
	createdAt?: Date | string;
	updatedAt?: Date | string;
}

export interface CategoryWithParent extends Category {
	parent?: Category | null;
	children?: CategoryWithParent[];
}

export interface CategoryListResult {
	categories: CategoryWithParent[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface CategorySingleResult extends CategoryWithParent {
	totalArticles: number;
	totalViews: number;
}

export interface FeaturedCategoryWithArticles extends Category {
	articles: import("./article").ArticleListResponse[];
}
