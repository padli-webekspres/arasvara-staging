import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/fetcher";
import { Configuration } from "@/types/configuration";

export const useConfiguration = () => {
  const query = useQuery({
    queryKey: ["configuration", "all"],
    queryFn: async () => fetcher<Configuration[]>("/configuration"),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const getConfig = (key: string) => {
    if (!query.data) return null;
    return query.data.find((item: Configuration) => item.key === key);
  };

  const getConfigValue = (key: string) => {
    const config = getConfig(key);
    return config?.value ?? null;
  };

  const getMediaUrl = (key: string, fallback = "") => {
    const value = getConfigValue(key) as any;
    return value?.url || fallback;
  };

  const getStringValue = (key: string, fallback = "") => {
    const value = getConfigValue(key);
    return typeof value === "string" ? value : fallback;
  };

  const getBooleanValue = (key: string, fallback = false) => {
    const value = getConfigValue(key);
    return typeof value === "boolean" ? value : value === "true" ? true : fallback;
  };

  return {
    ...query,
    getConfig,
    getConfigValue,
    getMediaUrl,
    getStringValue,
    getBooleanValue,
  };
};
