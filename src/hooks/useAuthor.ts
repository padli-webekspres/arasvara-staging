import { UserProfile } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

export interface AuthorOption {
	label: string;
	value: string;
	email?: string;
}

async function fetchAuthors(search: string): Promise<AuthorOption[]> {
	const res = await api.get<{ users: UserProfile[] }>("/users/author", {
		params: { search, limit: 10 },
	});
	const data = res.data;
	return (data.users || []).map((user: UserProfile) => ({
		label: user.name || user.email,
		value: user._id,
		email: user.email,
	}));
}

export function useAuthorOptions(search: string) {
	return useQuery<AuthorOption[]>({
		queryKey: ["authors", search],
		queryFn: () => fetchAuthors(search),
		enabled: !!search,
		staleTime: 60 * 60 * 1000, // 1 hour
	});
}
