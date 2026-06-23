import { ObjectId } from "mongodb";
import { Category } from "./category";

export interface option {
	id?: string;
	label: string;
	value: string;
}

export interface PopulatedTopic {
	_id: string;
	categoryId: string;
	selectedBy: string;
	category: Category;
	/** true = belum dikirim ke backend, sedang menunggu 2 detik */
	optimistic?: boolean;
}
