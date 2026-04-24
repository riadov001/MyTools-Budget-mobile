import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppContextProvider } from "@/hooks/app-context";
import { AppLayout } from "@/components/layout/app-layout";
import { useEffect } from "react";

import { Login } from "@/pages/auth/login";
import { Register } from "@/pages/auth/register";
import { ForgotPassword } from "@/pages/auth/forgot-password";
import { ResetPassword } from "@/pages/auth/reset-password";
import { Dashboard } from "@/pages/dashboard";
import { Services } from "@/pages/services";
import { Applications } from "@/pages/applications";
import { Users } from "@/pages/users";
import { Settings } from "@/pages/settings";
import { Invoices } from "@/pages/invoices";
import { Expenses } from "@/pages/expenses";
import { Payments } from "@/pages/payments";
import { CreditNotes } from "@/pages/credit-notes";
import { SupplierInvoices } from "@/pages/supplier-invoices";
import { Journal } from "@/pages/journal";
import { Accounts } from "@/pages/accounts";
import { Clients } from "@/pages/clients";
import { Suppliers } from "@/pages/suppliers";
import { ApiManager } from "@/pages/api-manager";
import { Agenda } from "@/pages/agenda";
import OcrScanPage from "@/pages/ocr-scan";
import { AdvancedAnalytics } from "@/pages/advanced-analytics";
import { Banking } from "@/pages/banking";
import { RootAdmin } from "@/pages/root-admin";
import { Urssaf } from "@/pages/urssaf";
import { Accounting } from "@/pages/accounting";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return <AppLayout><Component /></AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/invoices"><ProtectedRoute component={Invoices} /></Route>
      <Route path="/supplier-invoices"><ProtectedRoute component={SupplierInvoices} /></Route>
      <Route path="/credit-notes"><ProtectedRoute component={CreditNotes} /></Route>
      <Route path="/expenses"><ProtectedRoute component={Expenses} /></Route>
      <Route path="/payments"><ProtectedRoute component={Payments} /></Route>
      <Route path="/journal"><ProtectedRoute component={Journal} /></Route>
      <Route path="/accounts"><ProtectedRoute component={Accounts} /></Route>
      <Route path="/clients"><ProtectedRoute component={Clients} /></Route>
      <Route path="/suppliers"><ProtectedRoute component={Suppliers} /></Route>
      <Route path="/services"><ProtectedRoute component={Services} /></Route>
      <Route path="/applications"><ProtectedRoute component={Applications} /></Route>
      <Route path="/users"><ProtectedRoute component={Users} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
      <Route path="/api-manager"><ProtectedRoute component={ApiManager} /></Route>
      <Route path="/agenda"><ProtectedRoute component={Agenda} /></Route>
      <Route path="/analytics"><ProtectedRoute component={AdvancedAnalytics} /></Route>
      <Route path="/banking"><ProtectedRoute component={Banking} /></Route>
      <Route path="/root-admin"><ProtectedRoute component={RootAdmin} /></Route>
      <Route path="/urssaf"><ProtectedRoute component={Urssaf} /></Route>
      <Route path="/accounting"><ProtectedRoute component={Accounting} /></Route>
      <Route path="/ocr-scan"><ProtectedRoute component={OcrScanPage} /></Route>
      <Route><Redirect to="/" /></Route>
    </Switch>
  );
}

export default function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContextProvider>
            <Router />
          </AppContextProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
