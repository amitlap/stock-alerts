"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { useAsyncAction } from "@/frontend/hooks";
import { checkTelegramLinked, connectTelegram, disconnectTelegram } from "@/backend/actions";

// How often, and for how long, to check whether the user pressed Start in the bot.
const POLL_MS = 2000;
const POLL_FOR_MS = 10 * 60 * 1000;

// Links a Telegram chat to this login (opens the bot, where the user presses Start), or unlinks it.
// While waiting for Start it checks the link every few seconds and refreshes the page once it's made.
export default function TelegramButton({ linked }: { linked: boolean }) {
  const router = useRouter();
  const action = useAsyncAction();
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting || linked) return;

    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > POLL_FOR_MS) {
        setWaiting(false);
        return;
      }
      if (await checkTelegramLinked().catch(() => false)) router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, linked, router]);

  async function handleConnect() {
    // Open the tab now, inside the click: browsers block a window opened after an await.
    const tab = window.open("", "_blank");
    const ok = await action.run(async () => {
      const url = await connectTelegram();
      if (tab) tab.location.href = url;
      else window.location.href = url;
    });
    if (ok) setWaiting(true);
    else tab?.close();
  }

  async function handleDisconnect() {
    setWaiting(false);
    await action.run(async () => {
      await disconnectTelegram();
      router.refresh();
    });
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {action.error && (
        <Typography variant="caption" color="error">
          {action.error}
        </Typography>
      )}
      {linked ? (
        <Chip
          size="small"
          color="success"
          variant="outlined"
          label={action.pending ? "Disconnecting..." : "✓ Telegram connected"}
          onDelete={action.pending ? undefined : handleDisconnect}
          title="Alerts also go to your Telegram. Click × to disconnect."
        />
      ) : waiting ? (
        <>
          <Typography variant="caption" color="text.secondary">
            Press <b>Start</b> in Telegram…
          </Typography>
          <Button size="small" onClick={() => setWaiting(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button size="small" variant="outlined" onClick={handleConnect} disabled={action.pending}>
          {action.pending ? "Opening..." : "Connect Telegram"}
        </Button>
      )}
    </Stack>
  );
}
