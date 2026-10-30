"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField, Typography } from "@mui/material";
import { addPlaybook } from "@/lib/actions";
import { useAsyncAction } from "@/lib/hooks";
import { parsePrice } from "@/lib/stockUtils";
import { ConditionFields, EMPTY_CONDITION } from "./AlertFields";
import FormDialog from "./FormDialog";

// Creates a playbook with its first step, then opens it.
export default function AddPlaybookForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [firstStep, setFirstStep] = useState(EMPTY_CONDITION);
  const save = useAsyncAction();

  const price = parsePrice(firstStep.price);
  const canSave = name.trim() !== "" && firstStep.stock.trim() !== "" && price !== null;

  function handleOpen() {
    setName("");
    setDescription("");
    setFirstStep(EMPTY_CONDITION);
    save.setError(null);
    setOpen(true);
  }

  async function handleSave() {
    if (price === null) return;
    await save.run(async () => {
      const playbook = await addPlaybook(
        { name, description, email: userEmail },
        { stock: firstStep.stock, operator: firstStep.operator, price },
      );
      setOpen(false);
      router.push(`/playbooks/${playbook.id}`);
    });
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
        saving={save.pending}
        canSave={canSave}
        error={save.error}
        maxWidth="sm"
      >
        <TextField label="Name" size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Description (optional)"
          size="small"
          fullWidth
          multiline
          minRows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Typography variant="subtitle2">First step — start watching when</Typography>
        <ConditionFields value={firstStep} onChange={setFirstStep} />
      </FormDialog>
    </>
  );
}
