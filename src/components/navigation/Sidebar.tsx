"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";
import UserAvatar from "@/components/users/AvatarUser";
import { adminPanelHref } from "@/lib/admin-panel-path";
import DividerHorizontal from "@/components/homepage/DividerHorizontal";
import { UserProfile } from "@/types/user";
import { ROLES as ROLE_OPTIONS } from "@/lib/constants";
import {
  filterNavForRole,
  isAdminNavActive,
} from "@/lib/admin-sidebar-nav";
import api from "@/lib/axios";

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  user: UserProfile;
}

function getRoleDisplayLabel(role: string | undefined): string {
  if (!role) return "";
  const normalized = role.toLowerCase();
  const match = ROLE_OPTIONS.find((r) => r.value === normalized);
  return match?.label ?? role.replace(/-/g, " ");
}

const Sidebar = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  user,
}: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const userRole = user?.role?.toLowerCase() ?? "";

  const filteredNavItems = useMemo(
    () => filterNavForRole(userRole),
    [userRole],
  );

  const roleLabel = useMemo(
    () => getRoleDisplayLabel(user.role),
    [user.role],
  );

  const handleLogout = async () => {
    const pushToken = localStorage.getItem("fcm_token") ?? undefined;
    try {
      await api.post("/auth/logout", { pushToken: pushToken ?? null });
    } catch {
      // Logout tetap berlanjut meski request gagal
    }
    localStorage.removeItem("user");
    if (pushToken) localStorage.removeItem("fcm_token");
    router.push("/login");
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-50 h-screen bg-white border-r border-sidebar-border transition-all duration-300 flex flex-col ${
        isSidebarOpen ? "w-64" : "w-20"
      } ${
        isMobileSidebarOpen
          ? "translate-x-0"
          : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0">
        <Link href="/" className={`${isSidebarOpen ? "block" : "hidden"}`}>
          <span className="arasvara-logo text-xl"></span>
        </Link>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden lg:block p-2 hover:bg-sidebar-accent rounded-md"
          aria-label={isSidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden p-2 hover:bg-sidebar-accent rounded-md"
          aria-label="Tutup menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
        {filteredNavItems.map((item) => {
          if (item.type === "group") {
            if (!isSidebarOpen) {
              return (
                <DividerHorizontal
                  key={item.id}
                  variant="dark"
                  density="compact"
                  className="px-0"
                />
              );
            }
            return (
              <div
                key={item.id}
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-1 first:pt-1"
              >
                {item.name}
              </div>
            );
          }

          const isActive = isAdminNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isSidebarOpen ? item.name : undefined}
              className={
                `flex items-center gap-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ` +
                (!isSidebarOpen ? "justify-center px-2 " : "") +
                (isActive ? "bg-sidebar font-semibold text-hijauSawah!" : "")
              }
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden />
              {isSidebarOpen && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border mt-auto shrink-0 w-full">
        <Link
          href={adminPanelHref(`profile/${user._id}`)}
          className={`flex items-center gap-3 ${isSidebarOpen ? "" : "justify-center"}`}
          title={!isSidebarOpen ? "Profil" : undefined}
        >
          <UserAvatar
            avatar={user.avatar}
            name={user.name}
            className="size-8 shrink-0"
          />
          {isSidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {roleLabel}
              </p>
            </div>
          )}
        </Link>
        {isSidebarOpen && (
          <Button
            variant="ghost"
            className="w-full mt-3 justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        )}
        {!isSidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="w-full mt-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
