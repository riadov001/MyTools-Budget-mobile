import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { InsertService, Service } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useServices() {
  return useQuery<Service[]>({
    queryKey: [api.services.list.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.services.list.path);
      const data = await res.json();
      return api.services.list.responses[200].parse(data);
    },
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: InsertService) => {
      const res = await apiRequest("POST", api.services.create.path, data);
      return api.services.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.services.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.analytics.dashboard.path] });
      toast({ title: "Service Created", description: "The service has been added successfully." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<InsertService> & { id: number }) => {
      const url = buildUrl(api.services.update.path, { id });
      const res = await apiRequest("PUT", url, data);
      return api.services.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.services.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.analytics.dashboard.path] });
      toast({ title: "Service Updated", description: "The service has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.services.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.services.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.analytics.dashboard.path] });
      toast({ title: "Service Deleted", description: "The service has been removed." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });
}
