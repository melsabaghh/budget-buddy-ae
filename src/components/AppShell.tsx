import { Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wallet, LayoutDashboard, ListChecks, Tags, PiggyBank } from "lucide-react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ListChecks },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/savings", label: "Savings", icon: PiggyBank },
] as const;

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Budget</div>
              <div className="text-xs text-muted-foreground">AED · personal</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
              >
                <span className="flex items-center gap-2">
                  <n.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{n.label}</span>
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children ?? <Outlet />}</main>
    </div>
  );
}
