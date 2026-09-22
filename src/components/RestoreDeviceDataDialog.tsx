import { useState } from "react";
import { HardDriveDownload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  listDeviceBackups,
  restoreDeviceBackup,
  type DeviceBackup,
} from "@/lib/budget-store";

export function RestoreDeviceDataDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<DeviceBackup[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setBackups(listDeviceBackups());
  };

  const restore = async (b: DeviceBackup) => {
    setBusy(b.scope);
    try {
      await restoreDeviceBackup(b.scope);
      toast.success("Data restored and saved to your account");
      setOpen(false);
    } catch {
      toast.error("Could not restore that copy");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDriveDownload className="h-5 w-5" /> Restore data from this device
          </DialogTitle>
          <DialogDescription>
            Copies still stored on this phone or browser. Restoring replaces what is
            currently in your account on every device.
          </DialogDescription>
        </DialogHeader>

        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved copies were found on this device.
          </p>
        ) : (
          <div className="space-y-3">
            {backups.map((b) => (
              <div
                key={b.scope || "legacy"}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{b.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.categories} categories · {b.transactions} monthly entries ·{" "}
                    {b.savings} savings goals
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void restore(b)}
                >
                  {busy === b.scope ? "Restoring…" : "Restore"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
