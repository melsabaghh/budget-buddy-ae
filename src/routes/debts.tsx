import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AED,
  currentMonth,
  monthLabel,
  useCategories,
  useTransactions,
  type Category,
  type TransactionEntry,
} from "@/lib/budget-store";
import { cn } from "@/lib/utils";
import { Banknote, CreditCard, CalendarClock, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/debts")({
  head: () => ({
    meta: [
      { title: "Debts · Personal Budget" },
      {
        name: "description",
        content: "Track installment plans and loans: paid to date, remaining balance, and months left.",
      },
    ],
  }),
  component: DebtsPage,
});

function monthsBetween(start: string, end: string) {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

interface DebtStats {
  cat: Category;
  termMonths: number | null;
  totalScheduled: number | null;
  paid: number;
  scheduledToDate: number;
  remainingScheduled: number | null;
  monthsElapsed: number;
  monthsRemaining: number | null;
  progressPct: number;
  onTrackPct: number;
  nextDueMonth: string | null;
}

function computeStats(cat: Category, txs: TransactionEntry[], now: string): DebtStats {
  const termMonths = cat.endDate ? monthsBetween(cat.startDate, cat.endDate) : null;
  const totalScheduled = termMonths !== null ? termMonths * cat.amount : null;

  const catTxs = txs.filter((t) => t.categoryId === cat.id);
  const paid = catTxs.reduce((s, t) => s + (t.actual || 0), 0);

  const clampedNow = cat.endDate && now > cat.endDate ? cat.endDate : now;
  const elapsedRaw =
    now < cat.startDate ? 0 : monthsBetween(cat.startDate, clampedNow);
  const monthsElapsed = Math.max(0, elapsedRaw);

  const scheduledToDate = monthsElapsed * cat.amount;
  const remainingScheduled =
    totalScheduled !== null ? Math.max(0, totalScheduled - paid) : null;
  const monthsRemaining =
    termMonths !== null ? Math.max(0, termMonths - monthsElapsed) : null;

  const progressPct =
    totalScheduled && totalScheduled > 0
      ? Math.min(100, (paid / totalScheduled) * 100)
      : 0;
  const onTrackPct =
    scheduledToDate > 0 ? Math.min(200, (paid / scheduledToDate) * 100) : 0;

  const nextDueMonth =
    cat.endDate && now >= cat.endDate
      ? null
      : now < cat.startDate
        ? cat.startDate
        : now;

  return {
    cat,
    termMonths,
    totalScheduled,
    paid,
    scheduledToDate,
    remainingScheduled,
    monthsElapsed,
    monthsRemaining,
    progressPct,
    onTrackPct,
    nextDueMonth,
  };
}

function isComplete(d: DebtStats) {
  return (
    d.totalScheduled !== null &&
    d.totalScheduled > 0 &&
    d.paid >= d.totalScheduled
  );
}

function DebtsPage() {
  const [categories] = useCategories();
  const [txs] = useTransactions();
  const now = currentMonth();
  const [filter, setFilter] = useState<"all" | "active" | "complete">("all");

  const debts = useMemo(
    () =>
      categories
        .filter((c) => c.type === "installment" || c.type === "loan")
        .map((c) => computeStats(c, txs, now))
        .sort((a, b) => a.cat.name.localeCompare(b.cat.name)),
    [categories, txs, now],
  );

  const filtered = useMemo(() => {
    if (filter === "active") return debts.filter((d) => !isComplete(d));
    if (filter === "complete") return debts.filter((d) => isComplete(d));
    return debts;
  }, [debts, filter]);

  const installments = filtered.filter((d) => d.cat.type === "installment");
  const loans = filtered.filter((d) => d.cat.type === "loan");

  const countBy = (arr: DebtStats[]) => ({
    total: arr.length,
    active: arr.filter((d) => !isComplete(d)).length,
    complete: arr.filter((d) => isComplete(d)).length,
  });
  const allInstallments = debts.filter((d) => d.cat.type === "installment");
  const allLoans = debts.filter((d) => d.cat.type === "loan");
  const iCount = countBy(allInstallments);
  const lCount = countBy(allLoans);

  const totals = useMemo(() => {
    let scheduled = 0;
    let paid = 0;
    let remaining = 0;
    let monthly = 0;
    for (const d of filtered) {
      if (d.totalScheduled !== null) scheduled += d.totalScheduled;
      paid += d.paid;
      if (d.remainingScheduled !== null) remaining += d.remainingScheduled;
      if (d.monthsRemaining === null || d.monthsRemaining > 0)
        monthly += d.cat.amount;
    }
    return { scheduled, paid, remaining, monthly };
  }, [filtered]);


  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-lg shadow-primary/5 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full gradient-brand opacity-15 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            {monthLabel(now)}
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            Installments & <span className="gradient-text">loans</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor payoff progress for every financed purchase and loan. Paid amounts come from your monthly actuals.
          </p>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Banknote className="h-4 w-4" />} label="Total financed" value={AED(totals.scheduled)} />
          <Stat icon={<CreditCard className="h-4 w-4" />} label="Paid to date" value={AED(totals.paid)} tone="income" />
          <Stat icon={<TrendingDown className="h-4 w-4" />} label="Remaining balance" value={AED(totals.remaining)} tone="expense" />
          <Stat icon={<CalendarClock className="h-4 w-4" />} label="Monthly commitment" value={AED(totals.monthly)} />
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 font-medium">
            Installments: <span className="font-semibold">{iCount.total}</span>
            <span className="mx-1 text-muted-foreground">·</span>
            <span className="text-primary">{iCount.active} active</span>
            <span className="mx-1 text-muted-foreground">·</span>
            <span className="text-income">{iCount.complete} complete</span>
          </span>
          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 font-medium">
            Loans: <span className="font-semibold">{lCount.total}</span>
            <span className="mx-1 text-muted-foreground">·</span>
            <span className="text-primary">{lCount.active} active</span>
            <span className="mx-1 text-muted-foreground">·</span>
            <span className="text-income">{lCount.complete} complete</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Show</span>
        <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/60 p-1 shadow-sm">
          {(["all", "active", "complete"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all sm:text-sm",
                filter === f
                  ? "gradient-brand text-white shadow-md shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Complete"}
            </button>
          ))}
        </div>
      </div>


      {filtered.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <p>No {filter === "all" ? "" : filter} installment or loan categories yet.</p>
            <Button asChild className="mt-4 gradient-brand text-white shadow-md shadow-primary/25 hover:opacity-95">
              <Link to="/categories">Add one in Categories</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <DebtGroup title="Installment plans" items={installments} />
          <DebtGroup title="Loans" items={loans} />
        </>
      )}
    </div>
  );
}

function DebtGroup({ title, items }: { title: string; items: DebtStats[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          {title}
          <Badge variant="secondary" className="font-normal">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((d) => (
          <DebtCard key={d.cat.id} d={d} />
        ))}
      </CardContent>
    </Card>
  );
}

function DebtCard({ d }: { d: DebtStats }) {
  const { cat } = d;
  const behind = d.onTrackPct > 0 && d.onTrackPct < 95;
  const ahead = d.onTrackPct >= 105;
  const done =
    d.totalScheduled !== null && d.paid >= d.totalScheduled && d.totalScheduled > 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-5 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{cat.name}</h3>
            {done ? (
              <Badge className="bg-income/15 text-income hover:bg-income/15">Paid off</Badge>
            ) : ahead ? (
              <Badge className="bg-income/15 text-income hover:bg-income/15">Ahead</Badge>
            ) : behind ? (
              <Badge className="bg-expense/15 text-expense hover:bg-expense/15">Behind</Badge>
            ) : (
              <Badge variant="secondary">On track</Badge>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {monthLabel(cat.startDate)}
            {cat.endDate ? ` → ${monthLabel(cat.endDate)}` : " · open-ended"}
            {cat.notes ? ` · ${cat.notes}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Monthly
          </div>
          <div className="font-display text-lg font-semibold">{AED(cat.amount)}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Paid {AED(d.paid)}
            {d.totalScheduled !== null && ` of ${AED(d.totalScheduled)}`}
          </span>
          <span className="font-medium text-foreground">
            {d.totalScheduled !== null ? `${d.progressPct.toFixed(1)}%` : "—"}
          </span>
        </div>
        <Progress value={d.progressPct} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini
          label="Remaining"
          value={
            d.remainingScheduled !== null ? AED(d.remainingScheduled) : "—"
          }
          tone="expense"
        />
        <Mini
          label="Months left"
          value={
            d.monthsRemaining !== null ? String(d.monthsRemaining) : "open"
          }
        />
        <Mini label="Scheduled to date" value={AED(d.scheduledToDate)} />
        <Mini
          label="Vs schedule"
          value={d.scheduledToDate > 0 ? `${d.onTrackPct.toFixed(0)}%` : "—"}
          tone={ahead || done ? "income" : behind ? "expense" : undefined}
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="grid h-6 w-6 place-content-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        {label}
      </div>
      <div
        className={
          "mt-2 font-display text-xl font-semibold " +
          (tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "income" | "expense";
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-sm font-semibold " +
          (tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

