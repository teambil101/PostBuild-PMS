import {
  Building2,
  Users,
  FileText,
  GitBranch,
  Ticket,
  LayoutDashboard,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  active: boolean;
}

export const MODULES: ModuleDef[] = [
  { key: "properties", label: "Properties", path: "/properties", icon: Building2, active: true },
  { key: "people", label: "People", path: "/people", icon: Users, active: true },
  { key: "contracts", label: "Contracts", path: "/contracts", icon: FileText, active: true },
  { key: "lifecycle", label: "Lease Lifecycle", path: "/lifecycle", icon: GitBranch, active: false },
  { key: "tickets", label: "Tickets & Workflows", path: "/tickets", icon: Ticket, active: false },
  { key: "dashboards", label: "Dashboards", path: "/dashboards", icon: LayoutDashboard, active: false },
  { key: "vendors", label: "Vendors", path: "/vendors", icon: Truck, active: false },
  { key: "services", label: "Services", path: "/services", icon: Wrench, active: false },
];
