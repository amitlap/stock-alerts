"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack, Typography } from "@mui/material";
import { useAsyncAction } from "@/frontend/hooks";
import { runStockCheck } from "@/backend/actions";

// Runs the same check as the scheduled job now: fires matching steps, emails, and starts the next ones.
export default function RunCheckButton() {
  const router = useRouter();
  const check = useAsyncAction();
  const [result, setResult] = useState<string | null>(null);

  async function handleCheck() {
    setResult(null);
    await check.run(async () => {
      const { fired, emailErrors } = await runStockCheck();
      if (emailErrors.length > 0) throw new Error(`Some emails failed: ${emailErrors.join("; ")}`);
      setResult(fired.length === 0 ? "Nothing fired." : `Fired: ${fired.join(", ")}`);
      router.refresh();
    });
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {(check.error || result) && (
        <Typography variant="caption" color={check.error ? "error" : "text.secondary"}>
          {check.error ?? result}
        </Typography>
      )}
      <Button size="small" variant="outlined" onClick={handleCheck} disabled={check.pending}>
        {check.pending ? "Checking..." : "Run check now"}
      </Button>
    </Stack>
  );
}
