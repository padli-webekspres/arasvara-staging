import { NextResponse } from "next/server";
import { loginUser } from "@/services/authService";
import { issueAuthSession } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Input tidak valid" },
        { status: 400 },
      );
    }

    const { email, password } = validation.data;
    const user = await loginUser(email, password);

    const userProfile = {
      _id: user._id?.toString?.() ?? user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      teamId: user.teamId,
      team: user.team,
    };

    await issueAuthSession(userProfile);

    return NextResponse.json({
      message: "Login berhasil",
      user,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INVALID_CREDENTIALS") {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 },
      );
    }
    if (message === "ACCOUNT_DEACTIVATED") {
      return NextResponse.json(
        { error: "Akun dinonaktifkan" },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
