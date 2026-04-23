import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import Settings from "./pages/Settings";
import VendorDetail from "./pages/VendorDetail";

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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
            <Route path="/properties" element={<Shell><Properties /></Shell>} />
            <Route path="/properties/:id" element={<Shell><PropertyDetail /></Shell>} />
            <Route path="/properties/:buildingId/units/:unitId" element={<Shell><UnitDetail /></Shell>} />
            <Route path="/people" element={<Shell><People /></Shell>} />
            <Route path="/people/:id" element={<Shell><PersonDetail /></Shell>} />
            <Route path="/settings" element={<Shell><Settings /></Shell>} />
            <Route path="/lifecycle" element={<Navigate to="/dashboard" replace />} />
            <Route path="/contracts" element={<Navigate to="/dashboard" replace />} />
            <Route path="/contracts/:contractId" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tickets" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tickets/:ticketId" element={<Navigate to="/dashboard" replace />} />
            <Route path="/vendors" element={<Navigate to="/people?role=vendor" replace />} />
            <Route path="/vendors/:vendorId" element={<Shell><VendorDetail /></Shell>} />
            <Route path="/services" element={<Navigate to="/dashboard" replace />} />
            <Route path="/services/:scheduleId" element={<Navigate to="/dashboard" replace />} />
            <Route path="/leads" element={<Navigate to="/dashboard" replace />} />
            <Route path="/leads/:leadId" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
