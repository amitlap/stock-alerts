"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack, Typography } from "@mui/material";
import { useAsyncAction } from "@/lib/hooks";
import { formatAlertLabel, type Alert } from "@/lib/stockUtils";

// Runs the same check as the scheduled job now: fires matching steps, emails, and starts the next ones.
export default function RunCheckButton() {
  const router = useRouter();
  const check = useAsyncAction();
  const [result, setResult] = useState<string | null>(null);

  async function handleCheck() {
    setResult(null);
    await check.run(async () => {
      const res = await fetch("/api/cron/stocks", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `Check failed (${res.status})`);
      }
      const fired: Alert[] = data.matchingAlerts ?? [];
      setResult(fired.length === 0 ? "Nothing fired." : `Fired: ${fired.map(formatAlertLabel).join(", ")}`);
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
