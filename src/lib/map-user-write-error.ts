import { UserValidationError } from "@/lib/user-validation";

export type UserWriteErrorBody = {
  error: string;
  code?: string;
};

export function mapUserWriteError(error: unknown): {
  status: number;
  body: UserWriteErrorBody;
} {
  if (error instanceof UserValidationError) {
    return {
      status: error.status,
      body: { error: error.message, code: error.code },
    };
  }

  const err = error as Error & { status?: number; code?: string };
  const mongoCode = (error as { code?: number })?.code;

  if (mongoCode === 11000) {
    return {
      status: 409,
      body: {
        error: "Nama atau slug pengguna sudah digunakan",
        code: "DUPLICATE_KEY",
      },
    };
  }

  return {
    status: err?.status ?? 500,
    body: {
      error: err?.message || "Internal server error",
      ...(err?.code ? { code: err.code } : {}),
    },
  };
}
