import { ROLES } from "@/lib/auth-client";
import { ObjectId } from "mongodb";
import { Team } from "./team";

export interface User {
	_id: string;
	email: string;
	password?: string;
	name: string;
	/** URL segment publik penulis, mis. `andi-pratama` */
	slug?: string;
	/** Nama dinormalisasi untuk cek unik (lowercase, tanpa tanda baca) */
	nameNormalized?: string;
	role: keyof typeof ROLES;
	teamId?: string | ObjectId;
	team?: Team;
	avatar?: string | AvatarUser;
	bio?: string;
	isActive?: boolean;
	createdAt?: string | Date;
	updatedAt?: string | Date;
	deletedAt?: string | null;
}

export interface AvatarUser {
	_id: string;
	url: string;
	filename: string;
	mimetype: string;
	size: number;
	createdAt: string | Date;
	updatedAt: string | Date;
}

export interface UserProfile {
	_id: string;
	name: string;
	slug?: string;
	nameNormalized?: string;
	email: string;
	avatar?: string | AvatarUser;
	role: keyof typeof ROLES;
	teamId?: string | ObjectId;
	team?: Team;
}

export interface GetAllUsersParams {
	limit?: number;
	page?: number;
	role?: string;
	teamId?: string | ObjectId;
	team?: string | Team;
	search?: string;
	cursor?: string;
}

export interface GetAllUsersResult {
	users: User[];
	nextCursor: string | null;
	total?: number;
}
