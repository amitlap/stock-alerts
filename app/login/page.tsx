"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim() !== "" && password !== "" && !loading;

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && canSubmit) {
      handleLogin();
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Paper elevation={1} sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Log in
          </Typography>
          <TextField
            label="Email"
            type="email"
            size="small"
            fullWidth
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <TextField
            label="Password"
            type="password"
            size="small"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {error && <Typography color="error">{error}</Typography>}
          <Button variant="contained" onClick={handleLogin} disabled={!canSubmit}>
            {loading ? "Logging in..." : "Log in"}
          </Button>
          <Typography variant="body2">
            Don&apos;t have an account? <Link href="/signup">Sign up</Link>
          </Typography>
        </Stack>
      </Paper>
    </div>
  );
}
