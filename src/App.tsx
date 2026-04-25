import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { OwnerShell } from "@/components/owner/OwnerShell";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import UnitDetail from "./pages/UnitDetail";
import People from "./pages/People";
import PersonDetail from "./pages/PersonDetail";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound.tsx";
import Settings from "./pages/Settings";
import VendorDetail from "./pages/VendorDetail";
import Contracts from "./pages/Contracts";
import ContractDetail from "./pages/ContractDetail";
import NewManagementAgreement from "./pages/NewManagementAgreement";
import NewLease from "./pages/NewLease";
import NewVendorServiceAgreement from "./pages/NewVendorServiceAgreement";
import Services from "./pages/Services";
import NewServiceRequest from "./pages/NewServiceRequest";
import ServiceRequestDetail from "./pages/ServiceRequestDetail";
import Financials from "./pages/Financials";
import InvoiceDetail from "./pages/financials/InvoiceDetail";
import PublicQuoteSubmit from "./pages/PublicQuoteSubmit";
import PublicTenantDecision from "./pages/PublicTenantDecision";
import AcceptInvite from "./pages/AcceptInvite";
import Invitations from "./pages/Invitations";
import MarketplaceInbox from "./pages/MarketplaceInbox";
import { RequireNotBroker } from "@/components/RequireNotBroker";
import OwnerHome from "./pages/owner/OwnerHome";
import OwnerProperties from "./pages/owner/OwnerProperties";
import OwnerLeases from "./pages/owner/OwnerLeases";
import OwnerDocuments from "./pages/owner/OwnerDocuments";
import OwnerServices from "./pages/owner/OwnerServices";
import OwnerAccount from "./pages/owner/OwnerAccount";

const queryClient = new QueryClient();

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <SmartShell>{children}</SmartShell>
  </ProtectedRoute>
);

/**
 * Picks AppShell (operator/broker) or OwnerShell based on the active workspace kind.
 * Brokers use the same AppShell as operators — RLS already scopes their data.
 */
const SmartShell = ({ children }: { children: React.ReactNode }) => {
  const { activeWorkspace } = useWorkspace();
  if (activeWorkspace?.kind === "owner") {
    return <OwnerShell>{children}</OwnerShell>;
  }
  return <AppShell>{children}</AppShell>;
};

const OwnerOnly = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <OwnerShell>{children}</OwnerShell>
  </ProtectedRoute>
);

const IndexRedirect = () => {
  const { activeWorkspace, loading } = useWorkspace();
  if (loading) return null;
  if (activeWorkspace?.kind === "owner") return <Navigate to="/owner" replace />;
  return <Navigate to="/dashboard" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/q/:token" element={<PublicQuoteSubmit />} />
            <Route path="/t/:token" element={<PublicTenantDecision />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/" element={<ProtectedRoute><IndexRedirect /></ProtectedRoute>} />
            <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
            <Route path="/properties" element={<Shell><Properties /></Shell>} />
            <Route path="/properties/:id" element={<Shell><PropertyDetail /></Shell>} />
            <Route path="/properties/:buildingId/units/:unitId" element={<Shell><UnitDetail /></Shell>} />
            <Route path="/people" element={<Shell><People /></Shell>} />
            <Route path="/people/:id" element={<Shell><PersonDetail /></Shell>} />
            <Route path="/settings" element={<Shell><Settings /></Shell>} />
            <Route path="/lifecycle" element={<Navigate to="/dashboard" replace />} />
            <Route path="/contracts" element={<Shell><Contracts /></Shell>} />
            <Route path="/contracts/new/management-agreement" element={<Shell><NewManagementAgreement /></Shell>} />
            <Route path="/contracts/new/lease" element={<Shell><NewLease /></Shell>} />
            <Route path="/contracts/new/vendor-service-agreement" element={<Shell><NewVendorServiceAgreement /></Shell>} />
            <Route path="/contracts/:id" element={<Shell><ContractDetail /></Shell>} />
            <Route path="/services" element={<Shell><Services /></Shell>} />
            <Route path="/services/marketplace" element={<Shell><RequireNotBroker><MarketplaceInbox /></RequireNotBroker></Shell>} />
            <Route path="/services/requests/new" element={<Shell><NewServiceRequest /></Shell>} />
            <Route path="/services/requests/:id" element={<Shell><ServiceRequestDetail /></Shell>} />
            <Route path="/financials" element={<Shell><Financials /></Shell>} />
            <Route path="/financials/invoices/:id" element={<Shell><InvoiceDetail /></Shell>} />
            <Route path="/invitations" element={<Shell><Invitations /></Shell>} />
            {/* Owner portal */}
            <Route path="/owner" element={<OwnerOnly><OwnerHome /></OwnerOnly>} />
            <Route path="/owner/properties" element={<OwnerOnly><OwnerProperties /></OwnerOnly>} />
            <Route path="/owner/properties/:id" element={<OwnerOnly><PropertyDetail /></OwnerOnly>} />
            <Route path="/owner/leases" element={<OwnerOnly><OwnerLeases /></OwnerOnly>} />
            <Route path="/owner/documents" element={<OwnerOnly><OwnerDocuments /></OwnerOnly>} />
            <Route path="/owner/services" element={<OwnerOnly><OwnerServices /></OwnerOnly>} />
            <Route path="/owner/account" element={<OwnerOnly><OwnerAccount /></OwnerOnly>} />
            <Route path="/tickets" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tickets/:ticketId" element={<Navigate to="/dashboard" replace />} />
            <Route path="/vendors" element={<Navigate to="/people?role=vendor" replace />} />
            <Route path="/vendors/:vendorId" element={<Shell><VendorDetail /></Shell>} />
            <Route path="/leads" element={<Navigate to="/dashboard" replace />} />
            <Route path="/leads/:leadId" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
