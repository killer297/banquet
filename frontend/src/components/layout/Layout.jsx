import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, ListChecks, Users, Building2, Package,
  CreditCard, FileText, Wallet, BarChart3, Shield, Bell, ScrollText,
  Settings as SettingsIcon, LogOut, Search
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, ROLES } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["super_admin","manager","booking_staff","accountant"] },
  { to: "/bookings", icon: ListChecks, label: "Bookings", roles: ["super_admin","manager","booking_staff","accountant"] },
  { to: "/calendar", icon: CalendarDays, label: "Calendar", roles: ["super_admin","manager","booking_staff","accountant"] },
  { to: "/customers", icon: Users, label: "Customers", roles: ["super_admin","manager","booking_staff","accountant"] },
  { to: "/halls", icon: Building2, label: "Banquet Halls", roles: ["super_admin","manager","booking_staff","accountant"] },
  { to: "/packages", icon: Package, label: "Packages", roles: ["super_admin","manager","booking_staff","accountant"] },
  { to: "/payments", icon: CreditCard, label: "Payments", roles: ["super_admin","manager","accountant","booking_staff"] },
  { to: "/invoices", icon: FileText, label: "Invoices", roles: ["super_admin","manager","accountant"] },
  { to: "/expenses", icon: Wallet, label: "Expenses", roles: ["super_admin","manager","accountant"] },
  { to: "/reports", icon: BarChart3, label: "Reports", roles: ["super_admin","manager","accountant"] },
  { to: "/users", icon: Shield, label: "Users & Roles", roles: ["super_admin"] },
  { to: "/audit-logs", icon: ScrollText, label: "Audit Logs", roles: ["super_admin","manager"] },
  { to: "/settings", icon: SettingsIcon, label: "Settings", roles: ["super_admin"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [notifs, setNotifs] = useState([]);

  const loadNotifs = async () => {
    try { const { data } = await api.get("/notifications"); setNotifs(data); } catch {}
  };
  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 30000); return () => clearInterval(t); }, []);

  const unread = notifs.filter(n => !n.read).length;
  const items = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border/60 bg-card/80 backdrop-blur hidden lg:flex flex-col">
        <div className="h-16 px-6 flex items-center gap-2 border-b border-border/60">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-700 flex items-center justify-center font-bold text-black">GB</div>
          <div>
            <div className="font-display text-lg leading-none gold-gradient-text font-bold">GrandImperia</div>
            <div className="text-xs text-muted-foreground mt-1">Banquet BMS</div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-3 space-y-1">
            {items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === "/"}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g,"-")}`}
                className={({isActive}) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                             : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}>
                <Icon size={16} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </ScrollArea>
        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400 font-semibold">
              {user?.name?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{ROLES[user?.role]}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={async ()=>{await logout(); nav("/login");}} data-testid="logout-btn">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-40 flex items-center px-6 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="global-search" placeholder="Search bookings, customers…" className="pl-9 bg-background/60"/>
          </div>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="notification-bell">
                  <Bell size={18} />
                  {unread > 0 && <Badge className="absolute -top-1 -right-1 h-5 min-w-5 bg-rose-500 hover:bg-rose-500 text-white px-1.5">{unread}</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div className="font-semibold">Notifications</div>
                  <button className="text-xs text-yellow-500 hover:underline"
                    onClick={async ()=>{await api.put("/notifications/read-all"); loadNotifs();}}
                    data-testid="mark-all-read-btn">Mark all read</button>
                </div>
                <ScrollArea className="max-h-96">
                  {notifs.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No notifications</div>}
                  {notifs.map(n => (
                    <div key={n.id} className={`p-3 border-b border-border/50 text-sm ${!n.read ? "bg-yellow-500/5" : ""}`}>
                      <div className="font-medium">{n.title}</div>
                      <div className="text-muted-foreground text-xs">{n.message}</div>
                    </div>
                  ))}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <div className="text-right hidden md:block">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{ROLES[user?.role]}</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
