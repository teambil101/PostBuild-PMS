import {
  Building2,
  Users,
  LayoutDashboard,
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
  { key: "people", label: "Directory", path: "/people", icon: Users, active: true },
  { key: "settings", label: "Settings", path: "/settings", icon: SettingsIcon, active: true },
];
