import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scanReceiptImage } from "./scan-receipt.server";


const schema = z.object({
  image: z.string().min(32).max(12_000_000),
  categories: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
      }),
    )
    .max(200),
});

export const scanReceipt = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => scanReceiptImage(data.image, data.categories));
