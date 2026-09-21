import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORY_TYPES,
  uid,
  upsertEntry,
  useCategories,
  useTransactions,
  type Category,
  type CategoryType,
} from "@/lib/budget-store";

const TYPE_ALIASES: Record<string, CategoryType> = {
  income: "income",
  salary: "income",
  bill: "bill",
  bills: "bill",
  utility: "utility",
  utilities: "utility",
  expense: "expense",
  expenses: "expense",
  installment: "installment",
  installments: "installment",
  loan: "loan",
  loans: "loan",
};

function normalizeType(value: unknown): CategoryType | null {
  const key = String(value ?? "").trim().toLowerCase();
  return TYPE_ALIASES[key] ?? null;
}

function normalizeMonth(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  }
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
};

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const k of Object.keys(row)) {
    const norm = k.trim().toLowerCase();
    if (keys.includes(norm)) return row[k];
  }
  return undefined;
}

export function ImportExcelDialog() {
  const [categories, setCategories] = useCategories();
  const [, setTxs] = useTransactions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const cats = XLSX.utils.json_to_sheet([
      {
        Name: "Salary",
        Type: "income",
        Amount: 20000,
        "Start Month": "2026-01",
        "End Month": "",
        Notes: "",
      },
      {
        Name: "DEWA",
        Type: "utility",
        Amount: 450,
        "Start Month": "2026-01",
        "End Month": "",
        Notes: "",
      },
      {
        Name: "Car loan",
        Type: "loan",
        Amount: 1500,
        "Start Month": "2026-01",
        "End Month": "2028-12",
        Notes: "",
      },
    ]);
    const txs = XLSX.utils.json_to_sheet([
      { Month: "2026-01", Category: "Salary", Planned: 20000, Actual: 20000 },
      { Month: "2026-01", Category: "DEWA", Planned: 450, Actual: 512 },
    ]);
    XLSX.utils.book_append_sheet(wb, cats, "Categories");
    XLSX.utils.book_append_sheet(wb, txs, "Transactions");
    XLSX.writeFile(wb, "budget-template.xlsx");
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheet = (name: string) =>
        wb.SheetNames.find((s) => s.trim().toLowerCase() === name);

      const catSheet = sheet("categories") ?? wb.SheetNames[0];
      const txSheet = sheet("transactions");

      const catRows: Record<string, unknown>[] = catSheet
        ? XLSX.utils.sheet_to_json(wb.Sheets[catSheet], { defval: "" })
        : [];

      const byName = new Map<string, Category>();
      for (const c of categories) byName.set(c.name.trim().toLowerCase(), c);

      const nextCats = categories.slice();
      let added = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of catRows) {
        const name = String(pick(row, ["name", "category", "category name"]) ?? "").trim();
        const type = normalizeType(pick(row, ["type", "category type"]));
        const start = normalizeMonth(pick(row, ["start month", "start", "start date", "from"]));
        if (!name || !type || !start) {
          skipped++;
          continue;
        }
        const payload: Category = {
          id: byName.get(name.toLowerCase())?.id ?? uid(),
          name,
          type,
          amount: num(pick(row, ["amount", "monthly", "monthly amount", "monthly installment"])),
          startDate: start,
          endDate: normalizeMonth(pick(row, ["end month", "end", "end date", "to"])),
          notes: String(pick(row, ["notes", "note"]) ?? "").trim() || undefined,
        };
        const i = nextCats.findIndex((c) => c.id === payload.id);
        if (i === -1) {
          nextCats.push(payload);
          added++;
        } else {
          nextCats[i] = payload;
          updated++;
        }
        byName.set(name.toLowerCase(), payload);
      }

      let txCount = 0;
      let txSkipped = 0;
      if (txSheet) {
        const txRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
          wb.Sheets[txSheet],
          { defval: "" },
        );
        setTxs((prev) => {
          let next = prev;
          for (const row of txRows) {
            const month = normalizeMonth(pick(row, ["month", "date", "period"]));
            const catName = String(
              pick(row, ["category", "name", "category name"]) ?? "",
            )
              .trim()
              .toLowerCase();
            const cat = byName.get(catName);
            if (!month || !cat) {
              txSkipped++;
              continue;
            }
            next = upsertEntry(next, {
              month,
              categoryId: cat.id,
              planned: num(pick(row, ["planned", "planned amount", "plan"])) || cat.amount,
              actual: num(pick(row, ["actual", "actual amount", "paid"])),
            });
            txCount++;
          }
          return next;
        });
      }

      setCategories(nextCats);

      toast.success("Import complete", {
        description: `${added} categories added, ${updated} updated, ${txCount} monthly rows imported${
          skipped + txSkipped > 0 ? ` · ${skipped + txSkipped} rows skipped` : ""
        }.`,
      });
      setOpen(false);
    } catch (err) {
      toast.error("Could not read that file", {
        description: err instanceof Error ? err.message : "Please use the template layout.",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Excel (optional)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 text-sm text-muted-foreground">
          <p>
            Upload a spreadsheet to add everything at once. Use a{" "}
            <strong className="text-foreground">Categories</strong> sheet, and optionally a{" "}
            <strong className="text-foreground">Transactions</strong> sheet for monthly planned
            and actual amounts. Existing categories with the same name are updated, not duplicated.
          </p>
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-xs">
            <div className="font-medium text-foreground">Categories columns</div>
            <div>Name · Type ({CATEGORY_TYPES.map((t) => t.value).join(", ")}) · Amount · Start Month · End Month · Notes</div>
            <div className="mt-2 font-medium text-foreground">Transactions columns</div>
            <div>Month (YYYY-MM) · Category · Planned · Actual</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => void downloadTemplate()}>
            <Download className="mr-2 h-4 w-4" /> Download template
          </Button>
          <Button disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> {busy ? "Importing…" : "Choose file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
