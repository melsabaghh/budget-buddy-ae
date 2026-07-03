import { Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wallet, LayoutDashboard, ListChecks, Tags, PiggyBank, CreditCard } from "lucide-react";
import { currentMonth, monthLabel } from "@/lib/budget-store";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ListChecks },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/debts", label: "Debts", icon: CreditCard },
  { to: "/savings", label: "Savings", icon: PiggyBank },
] as const;

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link to="/" className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl gradient-brand text-white shadow-lg shadow-primary/25">
              <Wallet className="h-5 w-5" />
              <span className="absolute inset-0 rounded-xl ring-1 ring-white/30" />
            </span>
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight">
                Ledger<span className="gradient-text">.AE</span>
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">
                {monthLabel(currentMonth())}
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-border/70 bg-card/60 p-1 shadow-sm">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground data-[status=active]:gradient-brand data-[status=active]:text-white data-[status=active]:shadow-md data-[status=active]:shadow-primary/30 sm:px-4 sm:py-2 sm:text-sm"
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
      <main className="mx-auto max-w-6xl px-4 py-8">{children ?? <Outlet />}</main>
    </div>
  );
}
