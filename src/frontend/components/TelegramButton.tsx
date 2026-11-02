"use client";

import { useRouter } from "next/navigation";
import { Button, Stack, Typography } from "@mui/material";
import { useAsyncAction } from "@/frontend/hooks";
import { connectTelegram, disconnectTelegram } from "@/backend/actions";

// Links a Telegram chat to this login (opens the bot, where the user presses Start), or unlinks it.
export default function TelegramButton({ linked }: { linked: boolean }) {
  const router = useRouter();
  const action = useAsyncAction();

  async function handleConnect() {
    // Open the tab now, inside the click: browsers block a window opened after an await.
    const tab = window.open("", "_blank");
    const ok = await action.run(async () => {
      const url = await connectTelegram();
      if (tab) tab.location.href = url;
      else window.location.href = url;
    });
    if (!ok) tab?.close();
  }

  async function handleDisconnect() {
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
        <Button size="small" onClick={handleDisconnect} disabled={action.pending} title="Alerts also go to your Telegram">
          {action.pending ? "Disconnecting..." : "Telegram connected · Disconnect"}
        </Button>
      ) : (
        <Button size="small" variant="outlined" onClick={handleConnect} disabled={action.pending}>
          {action.pending ? "Opening..." : "Connect Telegram"}
        </Button>
      )}
    </Stack>
  );
}
