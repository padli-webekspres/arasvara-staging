import { ObjectId } from "mongodb";

export interface ArticleView {
	_id?: string;
	articleId: string | ObjectId; // ID artikel yang dilihat
	userId?: string | ObjectId; // opsional, jika user login
	sessionId?: string; // opsional, untuk unique session
	ip?: string; // opsional, untuk unique visitor
	userAgent?: string; // opsional, device info
	referrer?: string; // opsional, dari mana user datang
	viewedAt: string | Date; // ISO date string
	deletedAt?: Date | null; // untuk soft delete
}
