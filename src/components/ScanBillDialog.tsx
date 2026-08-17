import { useRef, useState } from "react";
import { Loader2, ScanLine, Upload, Camera } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scanReceipt } from "@/lib/scan-receipt.functions";
import { AED, CATEGORY_LABEL, monthLabel, type Category } from "@/lib/budget-store";

interface Props {
  categories: Category[]; // active categories for the month
  month: string;
  onApply: (categoryId: string, amount: number, mode: "set" | "add") => void;
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });

export function ScanBillDialog({ categories, month, onApply }: Props) {
  const scan = useServerFn(scanReceipt);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [mode, setMode] = useState<"set" | "add">("set");
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setVendor("");
    setAmount("");
    setDate("");
    setCategoryId("");
    setMode("set");
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large (max 8 MB).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      const result = await scan({
        data: {
          image: dataUrl,
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
          })),
        },
      });
      setVendor(result.vendor ?? "");
      setAmount(result.total != null ? String(result.total) : "");
      setDate(result.date ?? "");
      if (result.categoryId) setCategoryId(result.categoryId);
      toast.success("Bill scanned — review the details below.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    const value = Number(amount);
    if (!categoryId) return toast.error("Pick a category first.");
    if (!isFinite(value) || value <= 0) return toast.error("Enter a valid amount.");
    onApply(categoryId, value, mode);
    toast.success(`${AED(value)} recorded for ${monthLabel(month)}.`);
    setOpen(false);
    reset();
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-9 gap-1.5 rounded-full text-xs"
        onClick={() => setOpen(true)}
      >
        <ScanLine className="h-4 w-4" />
        Scan bill
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Scan invoice or bill</DialogTitle>
            <DialogDescription>
              Take a photo or upload an image — the amount, date and category are
              filled in for you, then added to {monthLabel(month)}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="gap-1.5"
            >
              <Camera className="h-4 w-4" /> Take photo
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => uploadRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" /> Upload image
            </Button>
          </div>

          {preview && (
            <div className="relative overflow-hidden rounded-xl border border-border/60">
              <img
                src={preview}
                alt="Scanned bill preview"
                className="max-h-52 w-full object-contain bg-muted/30"
              />
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reading bill…
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Vendor</Label>
              <Input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. DEWA"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Amount (AED)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Invoice date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {CATEGORY_LABEL[c.type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Apply to actual</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "set" | "add")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Replace actual amount</SelectItem>
                  <SelectItem value="add">Add to existing actual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {date && date.slice(0, 7) !== month && (
              <p className="text-xs text-expense">
                Invoice date is in {monthLabel(date.slice(0, 7))} but it will be
                recorded in {monthLabel(month)}.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={busy}>
              Add to transactions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
