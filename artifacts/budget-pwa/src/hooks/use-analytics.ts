import { useQuery } from "@tanstack/react-query";
import { api, DashboardResponse } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

export function useDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: [api.analytics.dashboard.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.analytics.dashboard.path);
      const data = await res.json();
      return api.analytics.dashboard.responses[200].parse(data);
    },
  });
}
