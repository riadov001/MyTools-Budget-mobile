import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { InsertApplication, Application } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useApplications() {
  return useQuery<Application[]>({
    queryKey: [api.applications.list.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.applications.list.path);
      const data = await res.json();
      return api.applications.list.responses[200].parse(data);
    },
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: InsertApplication) => {
      const res = await apiRequest("POST", api.applications.create.path, data);
      return api.applications.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.applications.list.path] });
      toast({ title: "Application Created", description: "Tenant application added successfully." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });
}
