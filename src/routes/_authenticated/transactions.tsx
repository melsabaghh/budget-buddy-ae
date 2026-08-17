import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AED,
  CATEGORY_TYPES,
  currentMonth,
  isIncome,
  monthInRange,
  monthLabel,
  shiftMonth,
  upsertEntry,
  useCategories,
  useTransactions,
  type CategoryType,
} from "@/lib/budget-store";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { ScanBillDialog } from "@/components/ScanBillDialog";


export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions · Personal Budget" },
      { name: "description", content: "Enter planned and actual amounts month by month." },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const [categories] = useCategories();
  const [txs, setTxs] = useTransactions();
  const [month, setMonth] = useState(currentMonth());

  const active = useMemo(
    () =>
      categories.filter((c) => monthInRange(month, c.startDate, c.endDate)),
    [categories, month],
  );

  const grouped = useMemo(() => {
    const m = new Map<CategoryType, typeof active>();
    for (const t of CATEGORY_TYPES) m.set(t.value, []);
    for (const c of active) m.get(c.type)!.push(c);
    return m;
  }, [active]);

  const totals = useMemo(() => {
    let pIn = 0, aIn = 0, pOut = 0, aOut = 0;
    for (const c of active) {
      const e = txs.find((t) => t.month === month && t.categoryId === c.id);
      const planned = e?.planned ?? c.amount;
      const actual = e?.actual ?? 0;
      if (isIncome(c.type)) { pIn += planned; aIn += actual; }
      else { pOut += planned; aOut += actual; }
    }
    return { pIn, aIn, pOut, aOut };
  }, [active, txs, month]);

  const update = (
    categoryId: string,
    field: "planned" | "actual",
    value: number,
    fallbackPlanned: number,
  ) => {
    setTxs((prev) => {
      const existing = prev.find(
        (t) => t.month === month && t.categoryId === categoryId,
      );
      const entry = {
        month,
        categoryId,
        planned: existing?.planned ?? fallbackPlanned,
        actual: existing?.actual ?? 0,
        [field]: value,
      };
      return upsertEntry(prev, entry);
    });
  };

  const applyScanned = (
    categoryId: string,
    value: number,
    mode: "set" | "add",
  ) => {
    const cat = active.find((c) => c.id === categoryId);
    setTxs((prev) => {
      const existing = prev.find(
        (t) => t.month === month && t.categoryId === categoryId,
      );
      const planned = existing?.planned ?? cat?.amount ?? 0;
      const current = existing?.actual ?? 0;
      return upsertEntry(prev, {
        month,
        categoryId,
        planned,
        actual: mode === "add" ? current + value : value,
      });
    });
  };

  const matchActualToPlanned = (
    categoryId: string,
    planned: number,
    checked: boolean,
  ) => {
    update(categoryId, "actual", checked ? planned : 0, planned);
  };


  const matchAllInType = (type: CategoryType) => {
    setTxs((prev) => {
      let next = prev;
      for (const c of active) {
        if (c.type !== type) continue;
        const existing = next.find(
          (t) => t.month === month && t.categoryId === c.id,
        );
        const planned = existing?.planned ?? c.amount;
        next = upsertEntry(next, {
          month,
          categoryId: c.id,
          planned,
          actual: planned,
        });
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-lg shadow-primary/5 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full gradient-brand opacity-15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {monthLabel(month)}
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
              Monthly <span className="gradient-text">ledger</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter planned and actual amounts. Rows appear from each category's start until its end month.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <ScanBillDialog
            categories={active}
            month={month}
            onApply={applyScanned}
          />
          <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/70 p-1 shadow-sm">

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value || currentMonth())}
              className="h-8 w-[150px] border-0 bg-transparent text-sm focus-visible:ring-0"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Mini label="Planned income" value={totals.pIn} tone="income" />
          <Mini label="Actual income" value={totals.aIn} tone="income" />
          <Mini label="Planned out" value={totals.pOut} tone="expense" />
          <Mini label="Actual out" value={totals.aOut} tone="expense" />
        </div>
      </div>

      {active.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No active categories for {monthLabel(month)}. Add categories first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {CATEGORY_TYPES.map((t) => {
            const items = grouped.get(t.value) ?? [];
            if (items.length === 0) return null;
            return (
              <Card key={t.value} className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    {t.label}
                    <Badge variant="secondary" className="font-normal">
                      {items.length}
                    </Badge>
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-full text-xs"
                    onClick={() => matchAllInType(t.value)}
                    title="Set actual = planned for every row in this section"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Match all to planned
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[170px]">Planned (AED)</TableHead>
                        <TableHead className="w-[170px]">Actual (AED)</TableHead>
                        <TableHead className="w-[90px] text-center">Same as planned</TableHead>
                        <TableHead className="w-[130px] text-right">Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((c) => {
                        const e = txs.find(
                          (x) => x.month === month && x.categoryId === c.id,
                        );
                        const planned = e?.planned ?? c.amount;
                        const actual = e?.actual ?? 0;
                        const diff = isIncome(c.type)
                          ? actual - planned
                          : planned - actual;
                        const matches = planned > 0 && actual === planned;
                        return (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{c.name}</div>
                              {c.endDate && (
                                <div className="text-xs text-muted-foreground">
                                  ends {monthLabel(c.endDate)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={planned}
                                onChange={(ev) =>
                                  update(
                                    c.id,
                                    "planned",
                                    Number(ev.target.value) || 0,
                                    c.amount,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={actual}
                                onChange={(ev) =>
                                  update(
                                    c.id,
                                    "actual",
                                    Number(ev.target.value) || 0,
                                    c.amount,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={matches}
                                onCheckedChange={(v) =>
                                  matchActualToPlanned(c.id, planned, !!v)
                                }
                                aria-label="Set actual equal to planned"
                              />
                            </TableCell>
                            <TableCell
                              className={
                                "text-right text-sm font-medium " +
                                (diff >= 0 ? "text-income" : "text-expense")
                              }
                            >
                              {diff >= 0 ? "+" : ""}
                              {AED(diff)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "income" | "expense";
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 backdrop-blur">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-1 font-display text-lg font-semibold " +
          (tone === "income" ? "text-income" : "text-expense")
        }
      >
        {AED(value)}
      </div>
    </div>
  );
}
