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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  CATEGORY_LABEL,
  CATEGORY_TYPES,
  currentMonth,
  monthLabel,
  uid,
  useCategories,
  type Category,
  type CategoryType,
} from "@/lib/budget-store";
import { Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({
    meta: [
      { title: "Categories · Personal Budget" },
      { name: "description", content: "Manage income, bills, utilities, expenses, installments and loans." },
    ],
  }),
  component: CategoriesPage,
});

type Draft = Omit<Category, "id"> & { id?: string; totalAmount?: number };

const emptyDraft: Draft = {
  name: "",
  type: "expense",
  amount: 0,
  startDate: currentMonth(),
  endDate: "",
  notes: "",
  totalAmount: 0,
};

const isDebt = (t: CategoryType) => t === "installment" || t === "loan";

const round2 = (n: number) => Math.round(n * 100) / 100;

function monthsBetween(start: string, end: string) {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

function addMonths(start: string, delta: number) {
  const [y, m] = start.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}


function CategoriesPage() {
  const [categories, setCategories] = useCategories();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const startNew = () => {
    setDraft({ ...emptyDraft, startDate: currentMonth() });
    setOpen(true);
  };
  const startEdit = (c: Category) => {
    const total =
      isDebt(c.type) && c.endDate
        ? round2(c.amount * monthsBetween(c.startDate, c.endDate))
        : 0;
    setDraft({ ...c, endDate: c.endDate ?? "", totalAmount: total });
    setOpen(true);
  };


  const save = () => {
    if (!draft.name.trim()) return;
    const payload: Category = {
      id: draft.id ?? uid(),
      name: draft.name.trim(),
      type: draft.type,
      amount: Number(draft.amount) || 0,
      startDate: draft.startDate,
      endDate: draft.endDate ? draft.endDate : null,
      notes: draft.notes?.trim() || undefined,
    };
    setCategories((prev) => {
      const i = prev.findIndex((c) => c.id === payload.id);
      if (i === -1) return [...prev, payload];
      const next = prev.slice();
      next[i] = payload;
      return next;
    });
    setOpen(false);
  };

  const remove = (id: string) =>
    setCategories((prev) => prev.filter((c) => c.id !== id));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-lg shadow-primary/5 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full gradient-brand opacity-15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Category <span className="gradient-text">library</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Each category appears in monthly transactions from its start month until the end date.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={startNew} className="gradient-brand text-white shadow-md shadow-primary/25 hover:opacity-95">
                <Plus className="mr-2 h-4 w-4" /> Add category
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {draft.id ? "Edit category" : "New category"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <Field label="Name">
                <Input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  placeholder="e.g. Salary, DEWA, Car loan"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select
                    value={draft.type}
                    onValueChange={(v) =>
                      setDraft({ ...draft, type: v as CategoryType })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={isDebt(draft.type) ? "Monthly installment (AED)" : "Amount (AED)"}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.amount || ""}
                    onChange={(e) => {
                      const amount = Number(e.target.value) || 0;
                      const next = { ...draft, amount };
                      if (isDebt(draft.type)) {
                        if (draft.endDate && draft.startDate) {
                          const m = monthsBetween(draft.startDate, draft.endDate);
                          next.totalAmount = round2(amount * m);
                        } else if (draft.totalAmount && amount > 0) {
                          next.endDate = addMonths(
                            draft.startDate,
                            Math.max(0, Math.ceil(draft.totalAmount / amount) - 1),
                          );
                        }
                      }
                      setDraft(next);
                    }}
                  />
                </Field>
              </div>
              {isDebt(draft.type) && (
                <Field label="Total amount (AED)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.totalAmount || ""}
                    onChange={(e) => {
                      const total = Number(e.target.value) || 0;
                      const next = { ...draft, totalAmount: total };
                      if (draft.endDate && draft.startDate && total > 0) {
                        const m = monthsBetween(draft.startDate, draft.endDate);
                        if (m > 0) next.amount = round2(total / m);
                      } else if (draft.amount > 0 && total > 0) {
                        next.endDate = addMonths(
                          draft.startDate,
                          Math.max(0, Math.ceil(total / draft.amount) - 1),
                        );
                      }
                      setDraft(next);
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Enter any two of total, monthly, and end month — the third fills in automatically.
                  </p>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start month">
                  <Input
                    type="month"
                    value={draft.startDate}
                    onChange={(e) => {
                      const startDate = e.target.value;
                      const next = { ...draft, startDate };
                      if (isDebt(draft.type)) {
                        if (draft.endDate && draft.totalAmount) {
                          const m = monthsBetween(startDate, draft.endDate);
                          if (m > 0) next.amount = round2(draft.totalAmount / m);
                        } else if (draft.endDate && draft.amount > 0) {
                          const m = monthsBetween(startDate, draft.endDate);
                          next.totalAmount = round2(draft.amount * m);
                        }
                      }
                      setDraft(next);
                    }}
                  />
                </Field>
                <Field label="End month (optional)">
                  <Input
                    type="month"
                    value={draft.endDate ?? ""}
                    onChange={(e) => {
                      const endDate = e.target.value;
                      const next = { ...draft, endDate };
                      if (isDebt(draft.type) && endDate && draft.startDate) {
                        const m = monthsBetween(draft.startDate, endDate);
                        if (draft.totalAmount && m > 0) {
                          next.amount = round2(draft.totalAmount / m);
                        } else if (draft.amount > 0) {
                          next.totalAmount = round2(draft.amount * m);
                        }
                      }
                      setDraft(next);
                    }}
                  />
                </Field>
              </div>
              <Field label="Notes (optional)">
                <Input
                  value={draft.notes ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </Field>
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
      </div>



      {CATEGORY_TYPES.map((t) => {
        const items = categories.filter((c) => c.type === t.value);
        return (
          <Card key={t.value} className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                {t.label}
                <Badge variant="secondary" className="font-normal">
                  {items.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                  No {CATEGORY_LABEL[t.value].toLowerCase()} categories yet.
                </div>
              ) : (
                <div className="divide-y">
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {monthLabel(c.startDate)}
                          {c.endDate ? ` → ${monthLabel(c.endDate)}` : " · ongoing"}
                          {c.notes ? ` · ${c.notes}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{AED(c.amount)}</div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(c)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(c.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-expense" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
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
