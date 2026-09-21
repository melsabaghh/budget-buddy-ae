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
  upsertEntry,
  useCategories,
  useTransactions,
} from "@/lib/budget-store";

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
    if (keys.includes(k.trim().toLowerCase())) return row[k];
  }
  return undefined;
}

export function ImportTransactionsDialog({ month }: { month: string }) {
  const [categories] = useCategories();
  const [, setTxs] = useTransactions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const sample = categories.slice(0, 3);
    const rows =
      sample.length > 0
        ? sample.map((c) => ({
            Month: month,
            Category: c.name,
            Planned: c.amount,
            Actual: 0,
          }))
        : [{ Month: month, Category: "Salary", Planned: 20000, Actual: 20000 }];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "Transactions",
    );
    XLSX.writeFile(wb, "transactions-template.xlsx");
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheetName =
        wb.SheetNames.find((s) => s.trim().toLowerCase() === "transactions") ??
        wb.SheetNames[0];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
        wb.Sheets[sheetName],
        { defval: "" },
      );

      const byName = new Map(
        categories.map((c) => [c.name.trim().toLowerCase(), c]),
      );

      let imported = 0;
      let skipped = 0;
      setTxs((prev) => {
        let next = prev;
        for (const row of rows) {
          const rowMonth =
            normalizeMonth(pick(row, ["month", "date", "period"])) ?? month;
          const cat = byName.get(
            String(pick(row, ["category", "name", "category name"]) ?? "")
              .trim()
              .toLowerCase(),
          );
          if (!cat) {
            skipped++;
            continue;
          }
          const plannedRaw = pick(row, ["planned", "planned amount", "plan"]);
          next = upsertEntry(next, {
            month: rowMonth,
            categoryId: cat.id,
            planned:
              plannedRaw === "" || plannedRaw === undefined
                ? cat.amount
                : num(plannedRaw),
            actual: num(pick(row, ["actual", "actual amount", "paid", "spent"])),
          });
          imported++;
        }
        return next;
      });

      if (imported === 0) {
        toast.error("Nothing imported", {
          description:
            "No row matched an existing category name. Add the categories first, then import.",
        });
      } else {
        toast.success("Transactions imported", {
          description: `${imported} rows saved${skipped > 0 ? ` · ${skipped} skipped` : ""}.`,
        });
        setOpen(false);
      }
    } catch (err) {
      toast.error("Could not read that file", {
        description:
          err instanceof Error ? err.message : "Please use the template layout.",
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
          <DialogTitle>Import monthly amounts (optional)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 text-sm text-muted-foreground">
          <p>
            Upload a sheet of planned and actual amounts. Rows are matched to your
            existing categories by name and saved to the month in each row — if a
            row has no month, it goes to the month you are viewing.
          </p>
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-xs">
            <div className="font-medium text-foreground">Columns</div>
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
