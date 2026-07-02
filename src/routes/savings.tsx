import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AED,
  monthLabel,
  uid,
  useSavings,
  type SavingsGoal,
} from "@/lib/budget-store";
import { Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/savings")({
  head: () => ({
    meta: [
      { title: "Savings · Personal Budget" },
      { name: "description", content: "Set savings goals and track progress in AED." },
    ],
  }),
  component: SavingsPage,
});

type Draft = Omit<SavingsGoal, "id"> & { id?: string };

const emptyDraft: Draft = {
  name: "",
  targetAmount: 0,
  saved: 0,
  monthlyContribution: 0,
  targetDate: "",
};

function SavingsPage() {
  const [goals, setGoals] = useSavings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const startNew = () => {
    setDraft(emptyDraft);
    setOpen(true);
  };
  const startEdit = (g: SavingsGoal) => {
    setDraft({ ...g, targetDate: g.targetDate ?? "" });
    setOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) return;
    const payload: SavingsGoal = {
      id: draft.id ?? uid(),
      name: draft.name.trim(),
      targetAmount: Number(draft.targetAmount) || 0,
      saved: Number(draft.saved) || 0,
      monthlyContribution: Number(draft.monthlyContribution) || 0,
      targetDate: draft.targetDate || undefined,
    };
    setGoals((prev) => {
      const i = prev.findIndex((g) => g.id === payload.id);
      if (i === -1) return [...prev, payload];
      const next = prev.slice();
      next[i] = payload;
      return next;
    });
    setOpen(false);
  };

  const remove = (id: string) =>
    setGoals((prev) => prev.filter((g) => g.id !== id));

  const addContribution = (id: string, amount: number) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g,
      ),
    );
  };

  const grandTotal = goals.reduce((s, g) => s + g.saved, 0);
  const grandTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const grandMonthly = goals.reduce((s, g) => s + g.monthlyContribution, 0);
  const grandPct =
    grandTarget > 0 ? Math.min(100, (grandTotal / grandTarget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-lg shadow-primary/5 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full gradient-brand opacity-15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Savings <span className="gradient-text">plan</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Set goals, log contributions and watch progress compound.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={startNew} className="gradient-brand text-white shadow-md shadow-primary/25 hover:opacity-95">
                <Plus className="mr-2 h-4 w-4" /> New goal
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {draft.id ? "Edit goal" : "New savings goal"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <Field label="Name">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Emergency fund, Hajj, New car"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target (AED)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.targetAmount}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        targetAmount: Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
                <Field label="Already saved (AED)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.saved}
                    onChange={(e) =>
                      setDraft({ ...draft, saved: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly contribution (AED)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.monthlyContribution}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        monthlyContribution: Number(e.target.value) || 0,
                      })
                    }
                  />
                </Field>
                <Field label="Target month (optional)">
                  <Input
                    type="month"
                    value={draft.targetDate ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, targetDate: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>

        {goals.length > 0 && (
          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total saved</div>
              <div className="mt-1 font-display text-lg font-semibold text-income">{AED(grandTotal)}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full gradient-brand" style={{ width: `${grandPct}%` }} />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{grandPct.toFixed(0)}% of {AED(grandTarget)}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Monthly commitment</div>
              <div className="mt-1 font-display text-lg font-semibold">{AED(grandMonthly)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Across {goals.length} goal{goals.length === 1 ? "" : "s"}</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Remaining</div>
              <div className="mt-1 font-display text-lg font-semibold text-expense">{AED(Math.max(0, grandTarget - grandTotal))}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {grandMonthly > 0 ? `~${Math.ceil(Math.max(0, grandTarget - grandTotal) / grandMonthly)} months at current rate` : "Set a monthly amount to project"}
              </div>
            </div>
          </div>
        )}
      </div>

      {goals.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <PiggyBank className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
            No savings goals yet. Click <span className="font-medium">New goal</span> to start.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">

          {goals.map((g) => {
            const pct = g.targetAmount > 0
              ? Math.min(100, (g.saved / g.targetAmount) * 100)
              : 0;
            const remaining = Math.max(0, g.targetAmount - g.saved);
            const monthsLeft = g.monthlyContribution > 0
              ? Math.ceil(remaining / g.monthlyContribution)
              : null;
            return (
              <Card key={g.id} className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{g.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(g)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(g.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-expense" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-semibold tracking-tight text-income">
                        {AED(g.saved)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        of {AED(g.targetAmount)}
                      </div>
                    </div>
                    <Progress value={pct} className="mt-2" />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {pct.toFixed(0)}% · {AED(remaining)} to go
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/40 p-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Monthly</div>
                      <div className="mt-0.5 font-medium text-foreground">
                        {AED(g.monthlyContribution)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        {g.targetDate ? "Target month" : "Months to go"}
                      </div>
                      <div className="mt-0.5 font-medium text-foreground">
                        {g.targetDate
                          ? monthLabel(g.targetDate)
                          : monthsLeft !== null
                            ? `${monthsLeft}`
                            : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        addContribution(g.id, g.monthlyContribution)
                      }
                      disabled={g.monthlyContribution <= 0}
                    >
                      + {AED(g.monthlyContribution)}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => addContribution(g.id, -g.monthlyContribution)}
                      disabled={g.monthlyContribution <= 0 || g.saved <= 0}
                    >
                      Undo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
