import { useCallback, useEffect, useState } from "react";
import {
  loadBudgetData,
  saveBudgetData,
} from "@/lib/budget-sync.functions";

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

const BASE_KEYS = {
  categories: "budget.categories.v1",
  transactions: "budget.transactions.v1",
  savings: "budget.savings.v1",
};

// Namespaced per authenticated user so switching accounts doesn't leak data.
let currentUserId: string | null = null;

export function setBudgetUserId(userId: string | null) {
  if (currentUserId === userId) return;
  currentUserId = userId;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("budget:user-change"));
    if (userId) void hydrateFromCloud(userId);
  }
}

function scoped(key: string) {
  return currentUserId ? `${key}::${currentUserId}` : `${key}::anon`;
}

// ---------- cloud sync ----------

const MIGRATED_FLAG = (uid: string) => `budget.cloud-migrated.v1::${uid}`;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let pullInFlight: Promise<void> | null = null;

function localSnapshot() {
  return {
    categories: read<Category[]>(BASE_KEYS.categories, []),
    transactions: read<TransactionEntry[]>(BASE_KEYS.transactions, []),
    savings: read<SavingsGoal[]>(BASE_KEYS.savings, []),
  };
}

async function hydrateFromCloud(userId: string) {
  if (pullInFlight) return pullInFlight;
  pullInFlight = (async () => {
    try {
      const cloud = await loadBudgetData();
      const local = localSnapshot();
      const cloudEmpty =
        cloud.categories.length === 0 &&
        cloud.transactions.length === 0 &&
        cloud.savings.length === 0;
      const localHasData =
        local.categories.length > 0 ||
        local.transactions.length > 0 ||
        local.savings.length > 0;

      if (cloudEmpty && localHasData) {
        // First sync from this device: push existing local data up.
        await saveBudgetData({ data: local });
      } else if (!cloudEmpty) {
        write(BASE_KEYS.categories, cloud.categories as Category[]);
        write(BASE_KEYS.transactions, cloud.transactions as TransactionEntry[]);
        write(BASE_KEYS.savings, cloud.savings as SavingsGoal[]);
      }
      window.localStorage.setItem(MIGRATED_FLAG(userId), "1");
    } catch (err) {
      console.error("[budget] cloud sync failed", err);
    } finally {
      pullInFlight = null;
    }
  })();
  return pullInFlight;
}

function schedulePushToCloud() {
  if (!currentUserId || typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    if (pushing || !currentUserId) return;
    pushing = true;
    try {
      await saveBudgetData({ data: localSnapshot() });
    } catch (err) {
      console.error("[budget] cloud save failed", err);
    } finally {
      pushing = false;
    }
  }, 800);
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(scoped(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scoped(key), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("budget:update", { detail: key }));
}

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));

  useEffect(() => {
    const refresh = () => setValue(read(key, fallback));
    const onUpdate = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail === key) refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === scoped(key)) refresh();
    };
    const onUserChange = () => refresh();
    window.addEventListener("budget:update", onUpdate);
    window.addEventListener("storage", onStorage);
    window.addEventListener("budget:user-change", onUserChange);
    return () => {
      window.removeEventListener("budget:update", onUpdate);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("budget:user-change", onUserChange);
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

export const useCategories = () => useStored<Category[]>(BASE_KEYS.categories, []);
export const useTransactions = () =>
  useStored<TransactionEntry[]>(BASE_KEYS.transactions, []);
export const useSavings = () => useStored<SavingsGoal[]>(BASE_KEYS.savings, []);


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
