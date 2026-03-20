import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RecuperarSenha from "./pages/RecuperarSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import Dashboard from "./pages/Dashboard";
import Instances from "./pages/Instances";
import Groups from "./pages/Groups";
import GroupActions from "./pages/GroupActions";
import GroupActionDetails from "./pages/GroupActionDetails";
import Links from "./pages/Links";
import Campaigns from "./pages/Campaigns";
import CampaignEditor from "./components/campaigns/CampaignEditor";
import Settings from "./pages/Settings";
import PixelSettings from "./pages/PixelSettings";
import Plans from "./pages/Plans";
import GoRedirect from "./pages/GoRedirect";
import Support from "./pages/Support";
import SupportNew from "./pages/SupportNew";
import SupportTicket from "./pages/SupportTicket";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminConfig from "./pages/admin/AdminConfig";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminClients from "./pages/admin/AdminClients";
import AdminClientDetails from "./pages/admin/AdminClientDetails";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminSecurityTests from "./pages/admin/AdminSecurityTests";
import AdminApiTest from "./pages/admin/AdminApiTest";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminSupportTicket from "./pages/admin/AdminSupportTicket";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ImpersonationProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route path="/auth" element={<Login />} /> {/* Redirect /auth to login */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/instances" element={<Instances />} />
            <Route path="/dashboard/groups" element={<Groups />} />
            <Route path="/dashboard/group-actions" element={<GroupActions />} />
            <Route path="/dashboard/group-actions/:id" element={<GroupActionDetails />} />
            <Route path="/dashboard/links" element={<Links />} />
            <Route path="/dashboard/campaigns" element={<Campaigns />} />
            <Route path="/dashboard/campaigns/:id" element={<CampaignEditor />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/settings/pixel" element={<PixelSettings />} />
            <Route path="/dashboard/plans" element={<Plans />} />
            <Route path="/dashboard/support" element={<Support />} />
            <Route path="/dashboard/support/new" element={<SupportNew />} />
            <Route path="/dashboard/support/:id" element={<SupportTicket />} />
            <Route path="/go/:slug" element={<GoRedirect />} />
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/clients/:id" element={<AdminClientDetails />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/plans" element={<AdminPlans />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/config" element={<AdminConfig />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/security" element={<AdminSecurityTests />} />
            <Route path="/admin/test" element={<AdminApiTest />} />
            <Route path="/admin/support" element={<AdminSupport />} />
            <Route path="/admin/support/:id" element={<AdminSupportTicket />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
