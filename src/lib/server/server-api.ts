/**
 * Helper URL API untuk Server Components / Route Handlers.
 * Dipisah agar bisa diimpor tanpa menarik fetcher spesifik domain.
 */
export function getServerApiBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (apiUrl && apiUrl.startsWith("http")) {
    return apiUrl;
  }

  if (baseUrl) {
    return `${baseUrl}/api`;
  }

  return "http://localhost:3000/api";
}
