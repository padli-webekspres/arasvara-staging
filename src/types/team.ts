import { ObjectId } from "mongodb";

export interface Team {
	_id: string | ObjectId;
	name: string;
	slug: string;
	description?: string;
	createdAt?: Date;
	updatedAt?: Date;
}
