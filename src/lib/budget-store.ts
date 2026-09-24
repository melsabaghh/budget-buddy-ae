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
const DIRTY_FLAG = (uid: string) => `budget.cloud-dirty.v1::${uid}`;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let pushPending = false;
let pullInFlight: Promise<void> | null = null;
let localRevision = 0;

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
    const revisionAtStart = localRevision;
    try {
      const cloud = await loadBudgetData();
      if (currentUserId !== userId) return;
      const local = localSnapshot();
      const hasUnsavedLocalChanges =
        window.localStorage.getItem(DIRTY_FLAG(userId)) === "1" ||
        localRevision !== revisionAtStart;
      const cloudEmpty =
        cloud.categories.length === 0 &&
        cloud.transactions.length === 0 &&
        cloud.savings.length === 0;
      const localHasData =
        local.categories.length > 0 ||
        local.transactions.length > 0 ||
        local.savings.length > 0;

      if (hasUnsavedLocalChanges || (cloudEmpty && localHasData)) {
        // Local changes take priority until they have safely reached the account.
        await saveBudgetData({ data: local });
        if (currentUserId === userId && localRevision === revisionAtStart) {
          window.localStorage.removeItem(DIRTY_FLAG(userId));
        } else {
          schedulePushToCloud();
        }
      } else if (!cloudEmpty) {
        write(BASE_KEYS.categories, cloud.categories as Category[], false);
        write(BASE_KEYS.transactions, cloud.transactions as TransactionEntry[], false);
        write(BASE_KEYS.savings, cloud.savings as SavingsGoal[], false);
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
  pushPending = true;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void flushPushQueue(), 800);
}

async function flushPushQueue() {
  if (pushing || !currentUserId || typeof window === "undefined") return;
  pushTimer = null;
  pushing = true;
  try {
    while (pushPending && currentUserId) {
      pushPending = false;
      const userId = currentUserId;
      const revision = localRevision;
      await saveBudgetData({ data: localSnapshot() });
      if (currentUserId === userId && localRevision === revision) {
        window.localStorage.removeItem(DIRTY_FLAG(userId));
      } else if (currentUserId === userId) {
        pushPending = true;
      }
    }
  } catch (err) {
    pushPending = true;
    console.error("[budget] cloud save failed", err);
  } finally {
    pushing = false;
    if (pushPending && currentUserId) {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => void flushPushQueue(), 2000);
    }
  }
}

// ---------- device backups (restore data saved on this device) ----------

export interface DeviceBackup {
  scope: string; // storage suffix, e.g. "anon" or a user id
  label: string;
  categories: number;
  transactions: number;
  savings: number;
}

function parseKey<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function listDeviceBackups(): DeviceBackup[] {
  if (typeof window === "undefined") return [];
  const scopes = new Set<string>();
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    for (const base of Object.values(BASE_KEYS)) {
      if (k === base) scopes.add("");
      else if (k.startsWith(`${base}::`)) scopes.add(k.slice(base.length + 2));
    }
  }
  const out: DeviceBackup[] = [];
  scopes.forEach((scope) => {
    const suffix = scope ? `::${scope}` : "";
    const categories = parseKey<Category[]>(`${BASE_KEYS.categories}${suffix}`, []);
    const transactions = parseKey<TransactionEntry[]>(
      `${BASE_KEYS.transactions}${suffix}`,
      [],
    );
    const savings = parseKey<SavingsGoal[]>(`${BASE_KEYS.savings}${suffix}`, []);
    if (!categories.length && !transactions.length && !savings.length) return;
    const isCurrent = scope === (currentUserId ?? "anon");
    out.push({
      scope,
      label: isCurrent
        ? "This account (current data)"
        : scope === "anon" || scope === ""
          ? "Saved before sign-in"
          : `Another account (${scope.slice(0, 8)}…)`,
      categories: categories.length,
      transactions: transactions.length,
      savings: savings.length,
    });
  });
  return out.sort((a, b) => b.categories + b.transactions - (a.categories + a.transactions));
}

export async function restoreDeviceBackup(scope: string) {
  if (typeof window === "undefined") return;
  const suffix = scope ? `::${scope}` : "";
  const snapshot = {
    categories: parseKey<Category[]>(`${BASE_KEYS.categories}${suffix}`, []),
    transactions: parseKey<TransactionEntry[]>(`${BASE_KEYS.transactions}${suffix}`, []),
    savings: parseKey<SavingsGoal[]>(`${BASE_KEYS.savings}${suffix}`, []),
  };
  write(BASE_KEYS.categories, snapshot.categories);
  write(BASE_KEYS.transactions, snapshot.transactions);
  write(BASE_KEYS.savings, snapshot.savings);
  if (currentUserId) await saveBudgetData({ data: snapshot });
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

function write<T>(key: string, value: T, sync = true) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scoped(key), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("budget:update", { detail: key }));
  if (sync && currentUserId) {
    localRevision += 1;
    window.localStorage.setItem(DIRTY_FLAG(currentUserId), "1");
    schedulePushToCloud();
  }
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
