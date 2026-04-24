import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { InsertReminderSettings, ReminderSettings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useReminderSettings() {
  return useQuery<ReminderSettings | null>({
    queryKey: [api.settings.getReminders.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.settings.getReminders.path);
      const data = await res.json();
      return api.settings.getReminders.responses[200].parse(data);
    },
  });
}

export function useUpdateReminderSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: Partial<InsertReminderSettings>) => {
      const res = await apiRequest("PUT", api.settings.updateReminders.path, data);
      return api.settings.updateReminders.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.settings.getReminders.path] });
      toast({ title: "Settings Updated", description: "Reminder configuration saved." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });
}
