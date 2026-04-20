import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import UnitDetail from "./pages/UnitDetail";
import People from "./pages/People";
import PersonDetail from "./pages/PersonDetail";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound.tsx";
import Contracts from "./pages/Contracts";
import ContractDetail from "./pages/ContractDetail";
import Settings from "./pages/Settings";
import Lifecycle from "./pages/Lifecycle";
import Tickets from "./pages/Tickets";
import TicketDetail from "./pages/TicketDetail";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";

const queryClient = new QueryClient();

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Shell><Dashboard /></Shell>} />
            <Route path="/properties" element={<Shell><Properties /></Shell>} />
            <Route path="/properties/:id" element={<Shell><PropertyDetail /></Shell>} />
            <Route path="/properties/:buildingId/units/:unitId" element={<Shell><UnitDetail /></Shell>} />
            <Route path="/people" element={<Shell><People /></Shell>} />
            <Route path="/people/:id" element={<Shell><PersonDetail /></Shell>} />
            <Route path="/contracts" element={<Shell><Contracts /></Shell>} />
            <Route path="/contracts/:contractId" element={<Shell><ContractDetail /></Shell>} />
            <Route path="/settings" element={<Shell><Settings /></Shell>} />
            <Route path="/lifecycle" element={<Shell><Lifecycle /></Shell>} />
            <Route path="/tickets" element={<Shell><Tickets /></Shell>} />
            <Route path="/tickets/:ticketId" element={<Shell><TicketDetail /></Shell>} />
            <Route path="/dashboards" element={<Shell><ComingSoon /></Shell>} />
            <Route path="/vendors" element={<Shell><Vendors /></Shell>} />
            <Route path="/vendors/:vendorId" element={<Shell><VendorDetail /></Shell>} />
            <Route path="/services" element={<Shell><Services /></Shell>} />
            <Route path="/services/:scheduleId" element={<Shell><ServiceDetail /></Shell>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
