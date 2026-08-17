export interface ScanCategoryOption {
  id: string;
  name: string;
  type: string;
}

export interface ScanResult {
  vendor: string | null;
  total: number | null;
  date: string | null; // YYYY-MM-DD
  currency: string | null;
  categoryId: string | null;
  suggestedType: string | null;
  summary: string | null;
}

const SYSTEM = `You read photos/scans of invoices, bills and receipts and extract structured data.
Return ONLY a tool call. Amounts are numbers without currency symbols. If the grand total is unclear, use the largest total-like amount.
Pick the best matching category id from the provided list; if nothing fits, return null for categoryId and suggest a type.`;

export async function scanReceiptImage(
  imageDataUrl: string,
  categories: ScanCategoryOption[],
): Promise<ScanResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");

  const catList = categories.length
    ? categories
        .map((c) => `- id: ${c.id} | name: ${c.name} | type: ${c.type}`)
        .join("\n")
    : "(no categories defined)";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the bill details. Available categories:\n${catList}`,
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "record_bill",
            description: "Record the extracted bill/invoice details",
            parameters: {
              type: "object",
              properties: {
                vendor: { type: "string", description: "Merchant or biller name" },
                total: { type: "number", description: "Grand total amount" },
                currency: { type: "string", description: "Currency code, e.g. AED" },
                date: { type: "string", description: "Invoice date as YYYY-MM-DD" },
                categoryId: {
                  type: "string",
                  description: "Best matching category id from the list, or empty",
                },
                suggestedType: {
                  type: "string",
                  enum: ["income", "bill", "utility", "expense", "installment", "loan"],
                },
                summary: { type: "string", description: "One short line about the bill" },
              },
              required: ["total"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "record_bill" } },
    }),
  });

  if (res.status === 429) throw new Error("Rate limit reached, try again shortly.");
  if (res.status === 402)
    throw new Error("AI credits exhausted. Please top up your workspace.");
  if (!res.ok) throw new Error(`Scan failed (${res.status})`);

  const json: any = await res.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("Could not read this image. Try a clearer photo.");
  const args = JSON.parse(call.function.arguments || "{}");

  const validId =
    args.categoryId && categories.some((c) => c.id === args.categoryId)
      ? args.categoryId
      : null;

  return {
    vendor: args.vendor ?? null,
    total: typeof args.total === "number" ? args.total : Number(args.total) || null,
    date: args.date ?? null,
    currency: args.currency ?? null,
    categoryId: validId,
    suggestedType: args.suggestedType ?? null,
    summary: args.summary ?? null,
  };
}
