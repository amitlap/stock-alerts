"use client";

import { useState } from "react";
import { Button, TextField } from "@mui/material";
import { addPlaybook } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";
import FormDialog from "./FormDialog";

export default function AddPlaybookForm({ userEmail }: { userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const save = useAsyncAction();

  const canSave = name.trim() !== "" && description.trim() !== "";

  function handleOpen() {
    setName("");
    setDescription("");
    save.setError(null);
    setOpen(true);
  }

  async function handleSave() {
    const saved = await save.run(() =>
      addPlaybook({ name: name.trim(), description: description.trim(), email: userEmail }),
    );
    if (saved) setOpen(false);
  }

  return (
    <>
      <Button variant="contained" onClick={handleOpen}>
        Add Playbook
      </Button>
      <FormDialog
        open={open}
        title="Add Playbook"
        onClose={() => setOpen(false)}
        onSave={handleSave}
        saving={save.pending}
        canSave={canSave}
        error={save.error}
      >
        <TextField label="Name" size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Description"
          size="small"
          fullWidth
          multiline
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormDialog>
    </>
  );
}
