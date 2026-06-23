import { getCollection } from "@/lib/db/db";
import bcrypt from "bcryptjs";
import { ROLES } from "@/lib/auth-client";

export async function registerUser(
	name: string,
	email: string,
	password: string,
) {
	const users = await getCollection("users");
	// Cek email unik
	const existing = await users.findOne({ email });
	if (existing) {
		throw new Error("EMAIL_EXISTS");
	}
	const hashedPassword = await bcrypt.hash(password, 12);
	const user = {
		name,
		email,
		password: hashedPassword,
		role: ROLES.SUBSCRIBER,
		avatar: null,
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	const result = await users.insertOne(user);
	// Ambil user yang baru saja dibuat
	const createdUser = await users.findOne({ _id: result.insertedId });
	if (!createdUser) throw new Error("REGISTER_FAILED");
	const { password: _, ...userWithoutPassword } = createdUser;
	return userWithoutPassword;
}
