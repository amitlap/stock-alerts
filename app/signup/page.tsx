"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { createClient } from "@/utils/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = email.trim() !== "" && password.length >= 6 && !loading;

  async function handleSignup() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      // If email confirmation is required, there is no session yet.
      if (!data.session) {
        setMessage("Check your email to confirm your account before logging in.");
        return;
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
      handleSignup();
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Paper elevation={1} sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Sign up
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
            helperText="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {error && <Typography color="error">{error}</Typography>}
          {message && <Typography color="success.main">{message}</Typography>}
          <Button variant="contained" onClick={handleSignup} disabled={!canSubmit}>
            {loading ? "Signing up..." : "Sign up"}
          </Button>
          <Typography variant="body2">
            Already have an account? <Link href="/login">Log in</Link>
          </Typography>
        </Stack>
      </Paper>
    </div>
  );
}
