"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useAsyncAction } from "@/frontend/hooks";

// The email + password card behind the login and sign-up pages. `onSubmit` throws to show an error,
// returns a message to show instead of leaving the page, or nothing to go to the dashboard.
export default function AuthForm({
  title,
  submitLabel,
  pendingLabel,
  minPasswordLength = 1,
  passwordHelp,
  onSubmit,
  footer,
}: {
  title: string;
  submitLabel: string;
  pendingLabel: string;
  minPasswordLength?: number;
  passwordHelp?: string;
  onSubmit: (email: string, password: string) => Promise<string | void>;
  footer: ReactNode;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const submit = useAsyncAction();
  const canSubmit = email.trim() !== "" && password.length >= minPasswordLength && !submit.pending;

  async function handleSubmit() {
    setMessage(null);
    await submit.run(async () => {
      const result = await onSubmit(email.trim(), password);
      if (result) {
        setMessage(result);
      } else {
        // The server components rendered while logged out, so re-render them for the new session.
        router.push("/");
        router.refresh();
      }
    });
  }

  return (
    <main className="flex flex-1 items-center justify-center">
      <Paper elevation={1} sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) handleSubmit();
          }}
        >
          <Typography variant="h5" component="h1">
            {title}
          </Typography>
          <TextField
            label="Email"
            type="email"
            size="small"
            fullWidth
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            size="small"
            fullWidth
            helperText={passwordHelp}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {submit.error && <Typography color="error">{submit.error}</Typography>}
          {message && <Typography color="success.main">{message}</Typography>}
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            {submit.pending ? pendingLabel : submitLabel}
          </Button>
          <Typography variant="body2">{footer}</Typography>
        </Stack>
      </Paper>
    </main>
  );
}
