import { useQuery } from "@tanstack/react-query";
import axios from "@/lib/axios";
import api from "@/lib/axios";

export function useCurrentUser() {
	return useQuery({
		queryKey: ["currentUser"],
		queryFn: async () => {
			const { data } = await api.get("/auth/me");
			return data.user; // null jika tidak login
		},
		staleTime: 5 * 60 * 1000, // 5 menit
	});
}
