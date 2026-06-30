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
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/transactions")({
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Planned vs actual amounts for each category.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card p-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            className="w-[160px] border-0 bg-transparent text-sm focus-visible:ring-0"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Mini label="Planned income" value={totals.pIn} tone="income" />
        <Mini label="Actual income" value={totals.aIn} tone="income" />
        <Mini label="Planned out" value={totals.pOut} tone="expense" />
        <Mini label="Actual out" value={totals.aOut} tone="expense" />
      </div>

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No active categories for {monthLabel(month)}. Add categories first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {CATEGORY_TYPES.map((t) => {
            const items = grouped.get(t.value) ?? [];
            if (items.length === 0) return null;
            return (
              <Card key={t.value}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {t.label}
                    <Badge variant="secondary" className="font-normal">
                      {items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[180px]">Planned (AED)</TableHead>
                        <TableHead className="w-[180px]">Actual (AED)</TableHead>
                        <TableHead className="w-[140px] text-right">Diff</TableHead>
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
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1 text-lg font-semibold " +
          (tone === "income" ? "text-income" : "text-expense")
        }
      >
        {AED(value)}
      </div>
    </div>
  );
}
