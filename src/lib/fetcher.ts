import api from "./axios";

export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await api.get<T>(url);
  return res.data;
};
