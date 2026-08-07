import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyCategoryRedirectPage(props: PageProps) {
  const { category: categorySlug } = await props.params;
  const rawSearchParams = props.searchParams ? await props.searchParams : {};

  // Formulasi query string jika terdapat searchParams dari URL legacy
  const searchParamsObj = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParamsObj.append(key, item);
      }
    } else if (typeof value === "string") {
      searchParamsObj.append(key, value);
    }
  }

  const queryString = searchParamsObj.toString();
  const querySuffix = queryString ? `?${queryString}` : "";

  if (categorySlug) {
    permanentRedirect(`/${encodeURIComponent(categorySlug)}${querySuffix}`);
  }

  permanentRedirect(`/${querySuffix}`);
}
