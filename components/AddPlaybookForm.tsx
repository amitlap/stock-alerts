"use client";

import { useState } from "react";
import { Button, TextField, Typography } from "@mui/material";
import { ConditionFields } from "./AlertFields";
import FormDialog from "./FormDialog";
import { useNewPlaybook } from "./useNewPlaybook";

// Dialog for creating a playbook with its first step, then opening it.
export default function AddPlaybookForm({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const draft = useNewPlaybook(userEmail);

  function handleOpen() {
    draft.reset();
    setOpen(true);
  }

  async function handleSave() {
    if (await draft.create()) setOpen(false);
  }

  return (
    <>
      <Button variant="contained" onClick={handleOpen}>
        New Playbook
      </Button>
      <FormDialog
        open={open}
        title="New Playbook"
        onClose={() => setOpen(false)}
        onSave={handleSave}
        saving={draft.save.pending}
        canSave={draft.canSave}
        error={draft.save.error}
        maxWidth="sm"
      >
        <TextField
          label="Name"
          size="small"
          fullWidth
          value={draft.name}
          onChange={(e) => draft.setName(e.target.value)}
        />
        <TextField
          label="Description (optional)"
          size="small"
          fullWidth
          multiline
          minRows={2}
          value={draft.description}
          onChange={(e) => draft.setDescription(e.target.value)}
        />
        <Typography variant="subtitle2">First step — start watching when</Typography>
        <ConditionFields value={draft.firstStep} onChange={draft.setFirstStep} />
      </FormDialog>
    </>
  );
}
