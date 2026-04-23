import {
  Building2,
  Users,
  Workflow,
  LayoutDashboard,
  Truck,
  Settings as SettingsIcon,
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
  { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, active: true },
  { key: "properties", label: "Properties", path: "/properties", icon: Building2, active: true },
  { key: "people", label: "People", path: "/people", icon: Users, active: true },
  { key: "lifecycle", label: "Leasing Lifecycle", path: "/lifecycle", icon: Workflow, active: true },
  { key: "vendors", label: "Vendors", path: "/vendors", icon: Truck, active: true },
  { key: "settings", label: "Settings", path: "/settings", icon: SettingsIcon, active: true },
];
