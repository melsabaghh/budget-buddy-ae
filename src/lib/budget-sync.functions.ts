import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["income", "bill", "utility", "expense", "installment", "loan"]),
  amount: z.number(),
  totalAmount: z.number().nullish(),
  startDate: z.string(),
  endDate: z.string().nullish(),
  notes: z.string().nullish(),
});

const txSchema = z.object({
  month: z.string(),
  categoryId: z.string(),
  planned: z.number(),
  actual: z.number(),
});

const goalSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetAmount: z.number(),
  saved: z.number(),
  monthlyContribution: z.number(),
  targetDate: z.string().nullish(),
});

const payloadSchema = z.object({
  categories: z.array(categorySchema).max(500),
  transactions: z.array(txSchema).max(20000),
  savings: z.array(goalSchema).max(200),
});

export const loadBudgetData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [cats, txs, goals] = await Promise.all([
      supabase.from("categories").select("*").eq("user_id", userId),
      supabase.from("transaction_entries").select("*").eq("user_id", userId),
      supabase.from("savings_goals").select("*").eq("user_id", userId),
    ]);
    if (cats.error) throw cats.error;
    if (txs.error) throw txs.error;
    if (goals.error) throw goals.error;

    return {
      categories: (cats.data ?? []).map((c: any) => ({
        id: c.client_id ?? c.id,
        name: c.name,
        type: c.type,
        amount: Number(c.amount),
        totalAmount: c.total_amount != null ? Number(c.total_amount) : null,
        startDate: c.start_month,
        endDate: c.end_month,
        notes: c.notes ?? undefined,
      })),
      transactions: (txs.data ?? []).map((t: any) => ({
        month: t.month,
        categoryId: t.client_id ?? t.category_id,
        planned: Number(t.planned),
        actual: Number(t.actual),
      })),
      savings: (goals.data ?? []).map((g: any) => ({
        id: g.client_id ?? g.id,
        name: g.name,
        targetAmount: Number(g.target_amount),
        saved: Number(g.saved),
        monthlyContribution: Number(g.monthly_contribution),
        targetDate: g.target_date ?? undefined,
      })),
    };
  });

export const saveBudgetData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => payloadSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Full-replace sync: delete then insert keeps cloud identical to local state.
    // Transactions reference categories, so delete them first instead of racing
    // both deletes and intermittently hitting the foreign-key constraint.
    const txDelete = await supabase
      .from("transaction_entries")
      .delete()
      .eq("user_id", userId);
    if (txDelete.error) throw txDelete.error;

    const [categoryDelete, savingsDelete] = await Promise.all([
      supabase.from("categories").delete().eq("user_id", userId),
      supabase.from("savings_goals").delete().eq("user_id", userId),
    ]);
    if (categoryDelete.error) throw categoryDelete.error;
    if (savingsDelete.error) throw savingsDelete.error;

    if (data.categories.length) {
      const { data: inserted, error } = await supabase
        .from("categories")
        .insert(
          data.categories.map((c) => ({
            user_id: userId,
            client_id: c.id,
            name: c.name,
            type: c.type,
            amount: c.amount,
            total_amount: c.totalAmount ?? null,
            start_month: c.startDate,
            end_month: c.endDate ?? null,
            notes: c.notes ?? null,
          })),
        )
        .select("id, client_id");
      if (error) throw error;

      const idMap = new Map(
        (inserted ?? []).map((r: any) => [r.client_id as string, r.id as string]),
      );

      if (data.transactions.length) {
        const missingCategoryIds = new Set<string>();
        const rows = data.transactions
          .map((t) => ({
            user_id: userId,
            client_id: t.categoryId,
            month: t.month,
            category_id: idMap.get(t.categoryId),
            planned: t.planned,
            actual: t.actual,
          }))
          .filter((r) => {
            if (r.category_id) return true;
            missingCategoryIds.add(r.client_id);
            return false;
          });
        if (missingCategoryIds.size > 0) {
          throw new Error(
            `Could not save transactions for ${missingCategoryIds.size} missing categories`,
          );
        }
        if (rows.length) {
          const { error: txErr } = await supabase
            .from("transaction_entries")
            .insert(rows as any);
          if (txErr) throw txErr;
        }
      }
    }

    if (data.savings.length) {
      const { error } = await supabase.from("savings_goals").insert(
        data.savings.map((g) => ({
          user_id: userId,
          client_id: g.id,
          name: g.name,
          target_amount: g.targetAmount,
          saved: g.saved,
          monthly_contribution: g.monthlyContribution,
          target_date: g.targetDate ?? null,
        })),
      );
      if (error) throw error;
    }

    return { ok: true };
  });
