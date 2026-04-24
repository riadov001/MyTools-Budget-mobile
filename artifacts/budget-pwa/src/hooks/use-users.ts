import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

export function useUsers() {
  return useQuery<User[]>({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.users.list.path);
      const data = await res.json();
      return api.users.list.responses[200].parse(data);
    },
  });
}
