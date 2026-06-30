import { useCallback, useEffect, useState } from "react";

export type CategoryType =
  | "income"
  | "bill"
  | "utility"
  | "expense"
  | "installment"
  | "loan";

export const CATEGORY_TYPES: { value: CategoryType; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "bill", label: "Bill" },
  { value: "utility", label: "Utility" },
  { value: "expense", label: "Expense" },
  { value: "installment", label: "Installment" },
  { value: "loan", label: "Loan" },
];

export const CATEGORY_LABEL: Record<CategoryType, string> = {
  income: "Income",
  bill: "Bill",
  utility: "Utility",
  expense: "Expense",
  installment: "Installment",
  loan: "Loan",
};

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  amount: number; // planned recurring amount per month
  startDate: string; // YYYY-MM
  endDate?: string | null; // YYYY-MM (inclusive). null/undefined = open-ended
  notes?: string;
}

export interface TransactionEntry {
  // keyed by `${month}__${categoryId}` in storage
  month: string; // YYYY-MM
  categoryId: string;
  planned: number;
  actual: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  saved: number;
  monthlyContribution: number;
  targetDate?: string; // YYYY-MM
}

const KEYS = {
  categories: "budget.categories.v1",
  transactions: "budget.transactions.v1",
  savings: "budget.savings.v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("budget:update", { detail: key }));
}

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail === key) setValue(read(key, fallback));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setValue(read(key, fallback));
    };
    window.addEventListener("budget:update", onUpdate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("budget:update", onUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, [key, fallback]);

  const update = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: T) => T)(prev)
            : updater;
        write(key, next);
        return next;
      });
    },
    [key],
  );

  return [value, update] as const;
}

export const useCategories = () => useStored<Category[]>(KEYS.categories, []);
export const useTransactions = () =>
  useStored<TransactionEntry[]>(KEYS.transactions, []);
export const useSavings = () => useStored<SavingsGoal[]>(KEYS.savings, []);

// ---------- helpers ----------

export const AED = (n: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
};

export const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthInRange = (
  month: string,
  start: string,
  end?: string | null,
) => {
  if (month < start) return false;
  if (end && month > end) return false;
  return true;
};

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const isIncome = (t: CategoryType) => t === "income";

export const txKey = (month: string, categoryId: string) =>
  `${month}__${categoryId}`;

export function getEntry(
  txs: TransactionEntry[],
  month: string,
  categoryId: string,
) {
  return txs.find((t) => t.month === month && t.categoryId === categoryId);
}

export function upsertEntry(
  txs: TransactionEntry[],
  entry: TransactionEntry,
): TransactionEntry[] {
  const i = txs.findIndex(
    (t) => t.month === entry.month && t.categoryId === entry.categoryId,
  );
  if (i === -1) return [...txs, entry];
  const next = txs.slice();
  next[i] = entry;
  return next;
}
