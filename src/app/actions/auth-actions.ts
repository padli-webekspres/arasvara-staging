"use server";

import { getCollection } from "@/lib/db/db";
import bcrypt from "bcryptjs";
import { issueAuthSession } from "@/lib/auth";
import {
	LoginInput,
	loginSchema,
	RegisterInput,
	registerSchema,
} from "@/lib/validations/auth";
import { registerUser } from "@/services/registerUser";
import { UserProfile } from "@/types/user";

export async function loginAction(values: LoginInput) {
	const parsed = loginSchema.safeParse(values);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message || "Input tidak valid" };
	}

	const { email, password } = parsed.data;

	const users = await getCollection("users");
	const user = await users.findOne({ email });

	if (!user) {
		return { error: "Email atau password salah" };
	}
	if (user.isActive === false) {
		return { error: "Akun dinonaktifkan" };
	}

	const isValid = await bcrypt.compare(password, user.password);
	if (!isValid) {
		return { error: "Email atau password salah" };
	}

	const userProfile: UserProfile = {
		_id: user._id?.toString?.() ?? user._id,
		name: user.name,
		email: user.email,
		avatar: user.avatar,
		role: user.role,
		teamId: user.teamId,
		team: user.team,
	};

	await issueAuthSession(userProfile);

	return { success: true, message: "Login berhasil" };
}

export async function registerAction(values: RegisterInput) {
	const parsed = registerSchema.safeParse(values);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message || "Input tidak valid" };
	}
	const { name, email, password } = parsed.data;
	try {
		const user = await registerUser(name, email, password);
		const userProfile: UserProfile = {
			_id: user._id?.toString?.() ?? user._id,
			name: user.name,
			email: user.email,
			role: user.role,
			avatar: user.avatar,
		};
		await issueAuthSession(userProfile);
		return { success: true, message: "Registrasi berhasil" };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (err: any) {
		if (err.message === "EMAIL_EXISTS") {
			return { error: "Email sudah terdaftar" };
		}
		return { error: "Terjadi kesalahan server" };
	}
}
