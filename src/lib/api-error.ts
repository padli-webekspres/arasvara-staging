import { AxiosError } from "axios";

type ApiErrorBody = {
  error?: string;
  message?: string;
};

/** Ambil pesan error manusiawi dari respons API (axios atau Error biasa). */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Terjadi kesalahan",
): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorBody | string | undefined;
    if (typeof data === "string" && data.trim()) return data.trim();
    if (data && typeof data === "object") {
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error.trim();
      }
      if (typeof data.message === "string" && data.message.trim()) {
        return data.message.trim();
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim();
    // Abaikan pesan generik axios "Request failed with status code XXX"
    if (!/^Request failed with status code \d+$/i.test(msg)) {
      return msg;
    }
  }

  if (typeof error === "object" && error !== null) {
    const err = error as {
      response?: { data?: ApiErrorBody };
      message?: string;
    };
    const apiError = err.response?.data?.error;
    if (typeof apiError === "string" && apiError.trim()) {
      return apiError.trim();
    }
  }

  return fallback;
}
