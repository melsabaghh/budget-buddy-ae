import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AED,
  CATEGORY_LABEL,
  currentMonth,
  isIncome,
  monthInRange,
  monthLabel,
  useCategories,
  useSavings,
  useTransactions,
} from "@/lib/budget-store";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Personal Budget" },
      { name: "description", content: "Monthly overview of planned vs actual income and expenses in AED." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [categories] = useCategories();
  const [txs] = useTransactions();
  const [savings] = useSavings();
  const month = currentMonth();

  const summary = useMemo(() => {
    let plannedIncome = 0,
      actualIncome = 0,
      plannedOut = 0,
      actualOut = 0;
    const activeCats = categories.filter((c) =>
      monthInRange(month, c.startDate, c.endDate),
    );
    for (const cat of activeCats) {
      const entry = txs.find((t) => t.month === month && t.categoryId === cat.id);
      const planned = entry?.planned ?? cat.amount;
      const actual = entry?.actual ?? 0;
      if (isIncome(cat.type)) {
        plannedIncome += planned;
        actualIncome += actual;
      } else {
        plannedOut += planned;
        actualOut += actual;
      }
    }
    return {
      plannedIncome,
      actualIncome,
      plannedOut,
      actualOut,
      plannedNet: plannedIncome - plannedOut,
      actualNet: actualIncome - actualOut,
      activeCats,
    };
  }, [categories, txs, month]);

  const totalSaved = savings.reduce((s, g) => s + g.saved, 0);
  const totalTarget = savings.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview for {monthLabel(month)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Income (actual)"
          planned={summary.plannedIncome}
          value={summary.actualIncome}
          tone="income"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label="Spending (actual)"
          planned={summary.plannedOut}
          value={summary.actualOut}
          tone="expense"
          icon={<ArrowDownRight className="h-4 w-4" />}
        />
        <StatCard
          label="Net (actual)"
          planned={summary.plannedNet}
          value={summary.actualNet}
          tone={summary.actualNet >= 0 ? "income" : "expense"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Savings"
          planned={totalTarget}
          value={totalSaved}
          tone="income"
          icon={<PiggyBank className="h-4 w-4" />}
          plannedLabel="Target"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Active items this month</CardTitle>
          <Link
            to="/transactions"
            className="text-xs font-medium text-primary hover:underline"
          >
            Open transactions →
          </Link>
        </CardHeader>
        <CardContent>
          {summary.activeCats.length === 0 ? (
            <EmptyHint />
          ) : (
            <div className="divide-y">
              {summary.activeCats.map((c) => {
                const entry = txs.find(
                  (t) => t.month === month && t.categoryId === c.id,
                );
                const planned = entry?.planned ?? c.amount;
                const actual = entry?.actual ?? 0;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[c.type]}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={
                          "text-sm font-semibold " +
                          (isIncome(c.type) ? "text-income" : "text-expense")
                        }
                      >
                        {AED(actual)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        planned {AED(planned)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  planned,
  value,
  tone,
  icon,
  plannedLabel = "Planned",
}: {
  label: string;
  planned: number;
  value: number;
  tone: "income" | "expense";
  icon: React.ReactNode;
  plannedLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          {label}
          <span
            className={
              "flex h-7 w-7 items-center justify-center rounded-md " +
              (tone === "income"
                ? "bg-income/10 text-income"
                : "bg-expense/10 text-expense")
            }
          >
            {icon}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{AED(value)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {plannedLabel}: {AED(planned)}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyHint() {
  return (
    <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
      No active categories yet.{" "}
      <Link to="/categories" className="font-medium text-primary hover:underline">
        Add categories
      </Link>{" "}
      to start tracking.
    </div>
  );
}
