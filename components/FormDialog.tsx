"use client";

import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  type DialogProps,
} from "@mui/material";

// A dialog with a stacked form body, an error line, and Cancel / Save actions.
export default function FormDialog({
  open,
  title,
  onClose,
  onSave,
  saving,
  canSave = true,
  error,
  maxWidth = "xs",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  canSave?: boolean;
  error?: string | null;
  maxWidth?: DialogProps["maxWidth"];
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={maxWidth}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {children}
          {error && <Typography color="error">{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={!canSave || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
