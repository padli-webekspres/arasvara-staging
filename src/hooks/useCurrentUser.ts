import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export function useCurrentUser(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: ["currentUser"],
		queryFn: async () => {
			const { data } = await api.get("/auth/me");
			return data.user; // null jika tidak login
		},
		staleTime: 5 * 60 * 1000, // 5 menit
		enabled: options?.enabled ?? true,
	});
}
