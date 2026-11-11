"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { addViewer, removeViewer } from "@/backend/actions";
import { useAsyncAction } from "@/frontend/hooks";

// "Viewers": the friends who can see all of this user's public playbooks.
export default function ViewersButton({ viewers }: { viewers: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const saving = useAsyncAction();

  async function handleAdd() {
    if (await saving.run(() => addViewer(email))) {
      setEmail("");
      router.refresh();
    }
  }

  async function handleRemove(viewer: string) {
    if (await saving.run(() => removeViewer(viewer))) router.refresh();
  }

  return (
    <>
      <Button size="small" variant="outlined" onClick={() => setOpen(true)}>
        Viewers ({viewers.length})
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Viewers</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            These people can see and comment on all your public playbooks. They can&apos;t change them.
          </Typography>
          <Stack
            component="form"
            direction="row"
            spacing={1}
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            <TextField
              label="Friend's email"
              type="email"
              size="small"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" variant="contained" disabled={saving.pending || !email.trim()}>
              Add
            </Button>
          </Stack>
          {saving.error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {saving.error}
            </Typography>
          )}
          {viewers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              No viewers yet.
            </Typography>
          ) : (
            <List dense sx={{ mt: 1 }}>
              {viewers.map((viewer) => (
                <ListItem
                  key={viewer}
                  disableGutters
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      color="error"
                      aria-label={`Remove ${viewer}`}
                      disabled={saving.pending}
                      onClick={() => handleRemove(viewer)}
                      sx={{ fontSize: 13 }}
                    >
                      ✕
                    </IconButton>
                  }
                >
                  <ListItemText primary={viewer} slotProps={{ primary: { noWrap: true } }} />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
