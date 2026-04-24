import { useState, useEffect } from "react";
import { useReminderSettings, useUpdateReminderSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, Save } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function Settings() {
  const { data: settings, isLoading } = useReminderSettings();
  const updateMutation = useUpdateReminderSettings();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    enabled: true,
    daysBefore: 7,
    emailSender: "",
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled,
        daysBefore: settings.daysBefore,
        emailSender: settings.emailSender,
      });
    } else if (user) {
      // Default fallback if no settings exist yet
      setFormData(prev => ({
        ...prev,
        emailSender: `billing@${user.email.split('@')[1] || 'company.com'}`
      }));
    }
  }, [settings, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your application preferences and reminders.</p>
        </div>
        <div className="flex items-center gap-2 bg-accent/20 p-1 rounded-lg border border-border/50">
          <Button 
            variant={user?.language === 'fr' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 px-3"
            onClick={() => apiRequest('PATCH', '/api/auth/settings', { language: 'fr' }).then(() => queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] }))}
          >
            FR
          </Button>
          <Button 
            variant={user?.language === 'en' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-8 px-3"
            onClick={() => apiRequest('PATCH', '/api/auth/settings', { language: 'en' }).then(() => queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] }))}
          >
            EN
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="glass-card border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle className="font-display text-xl">Payment Reminders</CardTitle>
            </div>
            <CardDescription>
              Configure automated email alerts before a service subscription is due.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">Loading settings...</div>
            ) : (
              <>
                <div className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-4 bg-background/50">
                  <div className="space-y-0.5">
                    <label className="text-base font-medium">Enable Email Reminders</label>
                    <p className="text-sm text-muted-foreground">Receive notifications before billing dates.</p>
                  </div>
                  <Switch 
                    checked={formData.enabled} 
                    onCheckedChange={(c) => setFormData({...formData, enabled: c})} 
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Days Before Reminder</label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        min={1} 
                        max={30}
                        value={formData.daysBefore}
                        onChange={(e) => setFormData({...formData, daysBefore: parseInt(e.target.value) || 7})}
                        disabled={!formData.enabled}
                        className="bg-background/50 pl-10"
                      />
                      <Bell className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Alert X days before the nextBillingDate.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sender Email Address</label>
                    <div className="relative">
                      <Input 
                        type="email" 
                        value={formData.emailSender}
                        onChange={(e) => setFormData({...formData, emailSender: e.target.value})}
                        disabled={!formData.enabled}
                        className="bg-background/50 pl-10"
                      />
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">The "From" address for these emails.</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="bg-accent/10 border-t border-border/50 px-6 py-4 flex justify-end">
            <Button 
              type="submit" 
              disabled={updateMutation.isPending || isLoading}
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
