"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Paper, Stack, Typography } from "@mui/material";
import { createClient } from "@/utils/supabase/client";

export default function UserHeader({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Paper elevation={1} sx={{ width: "100%", p: 1.5, mb: 2 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="body2">
          {userEmail ? `Connected email: ${userEmail}` : "Guest mode"}
        </Typography>
        {userEmail && (
          <Button size="small" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? "Logging out..." : "Log out"}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
