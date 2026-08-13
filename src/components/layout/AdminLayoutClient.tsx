"use client";
import { useEffect, useState } from "react";
import Sidebar from "../navigation/Sidebar";
import { Eye, Menu } from "lucide-react";
import Link from "next/link";
import NotificationButton from "../notification/NotificationButton";
import PushDebugButton from "../notification/PushDebugButton";
import { Button } from "../ui/button";

export default function AdminLayoutClient({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Kunci scroll body saat sidebar mobile terbuka (Safari iOS rubber-band).
  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        user={user}
      />

      {/* Main Content */}
      <div
        className={`min-w-0 overflow-x-clip transition-all duration-300 ${
          isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
        }`}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur border-b border-border flex items-center justify-between px-4 gap-2 md:gap-4">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-muted rounded-md"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          <NotificationButton />
          {process.env.NODE_ENV === "development" ? <PushDebugButton /> : null}
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2 shrink-0"
          >
            <Button variant="outline" size="sm" className="gap-2">
              <Eye className="h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">View Site</span>
            </Button>
          </Link>
        </header>

        {/* Page Content */}
        <main className="min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
