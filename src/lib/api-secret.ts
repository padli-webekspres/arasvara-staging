/**
 * Secret untuk header x-api-secret — terpisah dari JWT_SECRET.
 * Server & client memakai NEXT_PUBLIC_API_SECRET (nilai harus sama).
 */

export function getClientApiSecret(): string {
  return process.env.NEXT_PUBLIC_API_SECRET?.trim() ?? "";
}

export function getServerApiSecret(): string {
  const secret = getClientApiSecret();
  if (!secret && process.env.NODE_ENV === "production") {
    console.error(
      "[api-secret] NEXT_PUBLIC_API_SECRET wajib di-set di production.",
    );
  }
  return secret;
}

export function isValidApiSecret(headerValue: string | null): boolean {
  const serverSecret = getServerApiSecret();
  if (!serverSecret) {
    // Development: lewati jika belum dikonfigurasi
    return process.env.NODE_ENV !== "production";
  }
  return headerValue === serverSecret;
}
