import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  AED,
  CATEGORY_LABEL,
  CATEGORY_TYPES,
  currentMonth,
  isIncome,
  monthInRange,
  monthLabel,
  shiftMonth,
  useCategories,
  useSavings,
  useTransactions,
  type Category,
  type CategoryType,
  type TransactionEntry,
} from "@/lib/budget-store";
import {
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Personal Budget" },
      {
        name: "description",
        content:
          "Monthly overview of planned vs actual income and expenses in AED.",
      },
    ],
  }),
  component: Dashboard,
});

const TYPE_COLORS: Record<CategoryType, string> = {
  income: "var(--chart-3)",
  bill: "var(--chart-1)",
  utility: "var(--chart-2)",
  expense: "var(--chart-5)",
  installment: "var(--chart-4)",
  loan: "var(--chart-6)",
};

function computeMonth(
  categories: Category[],
  txs: TransactionEntry[],
  month: string,
) {
  let plannedIncome = 0,
    actualIncome = 0,
    plannedOut = 0,
    actualOut = 0;
  const byType: Record<CategoryType, { planned: number; actual: number }> = {
    income: { planned: 0, actual: 0 },
    bill: { planned: 0, actual: 0 },
    utility: { planned: 0, actual: 0 },
    expense: { planned: 0, actual: 0 },
    installment: { planned: 0, actual: 0 },
    loan: { planned: 0, actual: 0 },
  };
  const active = categories.filter((c) =>
    monthInRange(month, c.startDate, c.endDate),
  );
  for (const cat of active) {
    const entry = txs.find(
      (t) => t.month === month && t.categoryId === cat.id,
    );
    const planned = entry?.planned ?? cat.amount;
    const actual = entry?.actual ?? 0;
    byType[cat.type].planned += planned;
    byType[cat.type].actual += actual;
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
    active,
    byType,
  };
}

type Scope = "month" | "year";

function Dashboard() {
  const [categories] = useCategories();
  const [txs] = useTransactions();
  const [savings] = useSavings();
  const month = currentMonth();
  const [scope, setScope] = useState<Scope>("month");
  const year = month.slice(0, 4);

  const yearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, "0");
      return `${year}-${mm}`;
    });
  }, [year]);

  const monthSummary = useMemo(
    () => computeMonth(categories, txs, month),
    [categories, txs, month],
  );

  const yearSummaries = useMemo(
    () => yearMonths.map((m) => ({ m, s: computeMonth(categories, txs, m) })),
    [categories, txs, yearMonths],
  );

  const yearSummary = useMemo(() => {
    const byType: Record<CategoryType, { planned: number; actual: number }> = {
      income: { planned: 0, actual: 0 },
      bill: { planned: 0, actual: 0 },
      utility: { planned: 0, actual: 0 },
      expense: { planned: 0, actual: 0 },
      installment: { planned: 0, actual: 0 },
      loan: { planned: 0, actual: 0 },
    };
    let pIn = 0, aIn = 0, pOut = 0, aOut = 0;
    const activeMap = new Map<string, Category>();
    for (const { s } of yearSummaries) {
      pIn += s.plannedIncome;
      aIn += s.actualIncome;
      pOut += s.plannedOut;
      aOut += s.actualOut;
      for (const k of Object.keys(s.byType) as CategoryType[]) {
        byType[k].planned += s.byType[k].planned;
        byType[k].actual += s.byType[k].actual;
      }
      for (const c of s.active) activeMap.set(c.id, c);
    }
    return {
      plannedIncome: pIn,
      actualIncome: aIn,
      plannedOut: pOut,
      actualOut: aOut,
      plannedNet: pIn - pOut,
      actualNet: aIn - aOut,
      active: Array.from(activeMap.values()),
      byType,
    };
  }, [yearSummaries]);

  const summary = scope === "year" ? yearSummary : monthSummary;

  const trend = useMemo(() => {
    if (scope === "year") {
      return yearSummaries.map(({ m, s }) => ({
        month: m,
        label: new Date(`${m}-01`).toLocaleString("en-US", { month: "short" }),
        income: s.actualIncome,
        spending: s.actualOut,
        net: s.actualNet,
      }));
    }
    const arr: {
      month: string;
      label: string;
      income: number;
      spending: number;
      net: number;
    }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = shiftMonth(month, -i);
      const s = computeMonth(categories, txs, m);
      arr.push({
        month: m,
        label: new Date(`${m}-01`).toLocaleString("en-US", { month: "short" }),
        income: s.actualIncome,
        spending: s.actualOut,
        net: s.actualNet,
      });
    }
    return arr;
  }, [scope, yearSummaries, categories, txs, month]);

  const spendingByType = useMemo(() => {
    return (Object.keys(summary.byType) as CategoryType[])
      .filter((t) => !isIncome(t) && summary.byType[t].actual > 0)
      .map((t) => ({
        name: CATEGORY_LABEL[t],
        value: summary.byType[t].actual,
        fill: TYPE_COLORS[t],
      }));
  }, [summary.byType]);

  const plannedVsActual = useMemo(() => {
    return (Object.keys(summary.byType) as CategoryType[])
      .filter((t) => summary.byType[t].planned + summary.byType[t].actual > 0)
      .map((t) => ({
        name: CATEGORY_LABEL[t].slice(0, 5),
        Planned: summary.byType[t].planned,
        Actual: summary.byType[t].actual,
      }));
  }, [summary.byType]);

  const topOverspend = useMemo(() => {
    const rows = summary.active
      .filter((c) => !isIncome(c.type))
      .map((c) => {
        let planned = 0;
        let actual = 0;
        if (scope === "year") {
          for (const m of yearMonths) {
            if (!monthInRange(m, c.startDate, c.endDate)) continue;
            const e = txs.find((t) => t.month === m && t.categoryId === c.id);
            planned += e?.planned ?? c.amount;
            actual += e?.actual ?? 0;
          }
        } else {
          const e = txs.find(
            (t) => t.month === month && t.categoryId === c.id,
          );
          planned = e?.planned ?? c.amount;
          actual = e?.actual ?? 0;
        }
        return { c, planned, actual, over: actual - planned };
      });
    return rows.sort((a, b) => b.over - a.over).slice(0, 5);
  }, [summary.active, txs, month, scope, yearMonths]);

  const savingsRate =
    summary.actualIncome > 0
      ? Math.max(0, (summary.actualNet / summary.actualIncome) * 100)
      : 0;
  const budgetUsage =
    summary.plannedOut > 0
      ? (summary.actualOut / summary.plannedOut) * 100
      : 0;

  const totalSaved = savings.reduce((s, g) => s + g.saved, 0);
  const totalTarget = savings.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-xl shadow-primary/5 backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full gradient-brand opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[var(--brand-2)] opacity-15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              {scope === "year" ? `Full year ${year}` : monthLabel(month)}
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Your money at a <span className="gradient-text">glance</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {scope === "year"
                ? `Year-to-date analysis across all 12 months of ${year} — in AED.`
                : "Real-time overview of income, spending and savings — all in AED."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setScope("month")}
                className={
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition " +
                  (scope === "month"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                This month
              </button>
              <button
                type="button"
                onClick={() => setScope("year")}
                className={
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition " +
                  (scope === "year"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                Full year
              </button>
            </div>
            <div className="flex flex-col items-end gap-1 rounded-2xl border border-border/60 bg-background/70 px-5 py-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {scope === "year" ? `Net ${year}` : "Net this month"}
              </span>
              <span
                className={
                  "font-display text-2xl font-semibold " +
                  (summary.actualNet >= 0 ? "text-income" : "text-expense")
                }
              >
                {summary.actualNet >= 0 ? "+" : ""}
                {AED(summary.actualNet)}
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Income"
            planned={summary.plannedIncome}
            value={summary.actualIncome}
            tone="income"
            icon={<ArrowUpRight className="h-4 w-4" />}
          />
          <StatCard
            label="Spending"
            planned={summary.plannedOut}
            value={summary.actualOut}
            tone="expense"
            icon={<ArrowDownRight className="h-4 w-4" />}
          />
          <StatCard
            label="Savings rate"
            planned={summary.plannedIncome}
            value={summary.actualNet}
            tone={summary.actualNet >= 0 ? "income" : "expense"}
            icon={<TrendingUp className="h-4 w-4" />}
            secondary={`${savingsRate.toFixed(0)}% of income`}
          />
          <StatCard
            label="Savings pot"
            planned={totalTarget}
            value={totalSaved}
            tone="income"
            icon={<PiggyBank className="h-4 w-4" />}
            plannedLabel="Target"
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="font-display text-base">
                  {scope === "year" ? `${year} cashflow` : "6-month cashflow"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {scope === "year"
                    ? "Actual income, spending and net across every month of the year."
                    : "Actual income, spending and net across recent months."}
                </p>
              </div>
              <Badge variant="secondary" className="font-normal">
                Actuals
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                income: { label: "Income", color: "var(--chart-3)" },
                spending: { label: "Spending", color: "var(--chart-5)" },
                net: { label: "Net", color: "var(--chart-1)" },
              } satisfies ChartConfig}
              className="h-[240px] w-full"
            >
              <LineChart data={trend} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(v, name) => (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="capitalize text-muted-foreground">
                            {name}
                          </span>
                          <span className="font-mono font-medium">
                            {AED(Number(v))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="var(--color-income)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="spending"
                  stroke="var(--color-expense)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">
              Spending breakdown
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Where your money went this month.
            </p>
          </CardHeader>
          <CardContent>
            {spendingByType.length === 0 ? (
              <EmptyBlock text="No spending recorded yet." />
            ) : (
              <>
                <ChartContainer
                  config={{}}
                  className="mx-auto h-[180px] w-full"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v, name) => (
                            <div className="flex w-full items-center justify-between gap-3">
                              <span>{name}</span>
                              <span className="font-mono font-medium">
                                {AED(Number(v))}
                              </span>
                            </div>
                          )}
                          hideLabel
                        />
                      }
                    />
                    <Pie
                      data={spendingByType}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {spendingByType.map((s, i) => (
                        <Cell key={i} fill={s.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-3 space-y-1.5">
                  {spendingByType.map((s) => {
                    const total = spendingByType.reduce(
                      (a, b) => a + b.value,
                      0,
                    );
                    const pct = total > 0 ? (s.value / total) * 100 : 0;
                    return (
                      <div
                        key={s.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: s.fill }}
                          />
                          <span className="text-foreground">{s.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-mono">{AED(s.value)}</span>
                          <span className="w-9 text-right">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="font-display text-base">
                  Planned vs Actual
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Compare budget to reality by category type.
                </p>
              </div>
              <Badge
                variant="secondary"
                className={
                  "font-normal " +
                  (budgetUsage > 100
                    ? "bg-expense/10 text-expense"
                    : "bg-income/10 text-income")
                }
              >
                {budgetUsage.toFixed(0)}% of budget
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {plannedVsActual.length === 0 ? (
              <EmptyBlock text="Add categories and enter amounts to see this chart." />
            ) : (
              <ChartContainer
                config={{
                  Planned: { label: "Planned", color: "var(--chart-2)" },
                  Actual: { label: "Actual", color: "var(--chart-1)" },
                }}
                className="h-[240px] w-full"
              >
                <BarChart data={plannedVsActual}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v, name) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span>{name}</span>
                            <span className="font-mono font-medium">
                              {AED(Number(v))}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="Planned"
                    fill="var(--chart-2)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="Actual"
                    fill="var(--chart-1)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">
              Top over-budget
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Categories exceeding their plan this month.
            </p>
          </CardHeader>
          <CardContent>
            {topOverspend.length === 0 ? (
              <EmptyBlock text="No over-budget items." />
            ) : (
              <div className="space-y-3">
                {topOverspend.map((row) => {
                  const pct =
                    row.planned > 0
                      ? Math.min(200, (row.actual / row.planned) * 100)
                      : row.actual > 0
                        ? 100
                        : 0;
                  const over = row.over > 0;
                  return (
                    <div key={row.c.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {row.c.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {CATEGORY_LABEL[row.c.type]}
                          </div>
                        </div>
                        <div
                          className={
                            "font-mono text-xs font-semibold " +
                            (over ? "text-expense" : "text-muted-foreground")
                          }
                        >
                          {over ? "+" : ""}
                          {AED(row.over)}
                        </div>
                      </div>
                      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={
                            "absolute inset-y-0 left-0 rounded-full " +
                            (over
                              ? "bg-expense"
                              : "bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)]")
                          }
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="font-display text-base">
                Active items this month
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Everything scheduled for {monthLabel(month)}.
              </p>
            </div>
            <Link
              to="/transactions"
              className="text-xs font-medium text-primary hover:underline"
            >
              Open transactions →
            </Link>
          </CardHeader>
          <CardContent>
            {summary.active.length === 0 ? (
              <EmptyHint />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {CATEGORY_TYPES.map((t) => {
                  const items = summary.active.filter(
                    (c) => c.type === t.value,
                  );
                  if (items.length === 0) return null;
                  const bucket = summary.byType[t.value];
                  return (
                    <div
                      key={t.value}
                      className="rounded-2xl border border-border/60 bg-background/50 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: TYPE_COLORS[t.value] }}
                          />
                          <span className="text-sm font-medium">
                            {t.label}
                          </span>
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 text-[10px] font-normal"
                          >
                            {items.length}
                          </Badge>
                        </div>
                        <span
                          className={
                            "font-mono text-xs font-semibold " +
                            (isIncome(t.value)
                              ? "text-income"
                              : "text-foreground")
                          }
                        >
                          {AED(bucket.actual)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.slice(0, 4).map((c) => {
                          const entry = txs.find(
                            (x) =>
                              x.month === month && x.categoryId === c.id,
                          );
                          const planned = entry?.planned ?? c.amount;
                          const actual = entry?.actual ?? 0;
                          const pct =
                            planned > 0
                              ? Math.min(100, (actual / planned) * 100)
                              : 0;
                          return (
                            <div key={c.id}>
                              <div className="flex items-center justify-between text-xs">
                                <span className="truncate text-foreground">
                                  {c.name}
                                </span>
                                <span className="font-mono text-muted-foreground">
                                  {AED(actual)}{" "}
                                  <span className="text-[10px]">
                                    / {AED(planned)}
                                  </span>
                                </span>
                              </div>
                              <Progress value={pct} className="mt-1 h-1" />
                            </div>
                          );
                        })}
                        {items.length > 4 && (
                          <div className="text-[11px] text-muted-foreground">
                            +{items.length - 4} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
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
  secondary,
}: {
  label: string;
  planned: number;
  value: number;
  tone: "income" | "expense";
  icon: React.ReactNode;
  plannedLabel?: string;
  secondary?: string;
}) {
  const pct = planned > 0 ? Math.min(100, (Math.abs(value) / planned) * 100) : 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={
            "flex h-7 w-7 items-center justify-center rounded-lg " +
            (tone === "income"
              ? "bg-income/10 text-income"
              : "bg-expense/10 text-expense")
          }
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {AED(value)}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={
            "h-full rounded-full " +
            (tone === "income" ? "bg-income" : "bg-expense")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {plannedLabel}: {AED(planned)}
        </span>
        {secondary && <span className="font-medium">{secondary}</span>}
      </div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
      No active categories yet.{" "}
      <Link
        to="/categories"
        className="font-medium text-primary hover:underline"
      >
        Add categories
      </Link>{" "}
      to start tracking.
    </div>
  );
}
