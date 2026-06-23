import { ArticleValidationError } from "@/lib/article-validation";

export type ArticleWriteErrorBody = {
  error: string;
  code?: string;
};

export function mapArticleWriteError(error: unknown): {
  status: number;
  body: ArticleWriteErrorBody;
} {
  if (error instanceof ArticleValidationError) {
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
        error: "Judul atau slug artikel sudah digunakan",
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
