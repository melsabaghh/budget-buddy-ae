import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Wallet,
  LayoutDashboard,
  ListChecks,
  Tags,
  PiggyBank,
  CreditCard,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { currentMonth, monthLabel } from "@/lib/budget-store";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ListChecks },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/debts", label: "Debts", icon: CreditCard },
  { to: "/savings", label: "Savings", icon: PiggyBank },
] as const;

interface Profile {
  name: string;
  email: string;
  avatar_url: string | null;
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || !active) {
        setProfile(null);
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setProfile({
        name:
          p?.display_name ||
          (user.user_metadata?.full_name as string | undefined) ||
          user.email?.split("@")[0] ||
          "Account",
        email: user.email ?? "",
        avatar_url: p?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined) ?? null,
      });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "•";

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

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
          <div className="flex items-center gap-2">
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
            {profile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-card/60 text-xs font-semibold text-foreground shadow-sm transition hover:bg-accent">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt={profile.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{profile.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {profile.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    <UserIcon className="h-4 w-4" />
                    Cloud sync coming next
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children ?? <Outlet />}</main>
    </div>
  );
}
