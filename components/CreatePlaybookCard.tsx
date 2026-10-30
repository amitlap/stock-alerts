"use client";

import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import { ConditionFields } from "./AlertFields";
import { useNewPlaybook } from "./useNewPlaybook";

// Dashboard's first panel: create a playbook and its first step without opening a dialog.
export default function CreatePlaybookCard({ userEmail, isFirst }: { userEmail: string; isFirst: boolean }) {
  const draft = useNewPlaybook(userEmail);

  return (
    <Paper
      component="section"
      elevation={1}
      sx={{ p: 3, borderTop: 4, borderColor: "primary.main" }}
    >
      <Typography variant="h6" component="h2">
        {isFirst ? "Create your first playbook" : "Start a new playbook"}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Name your plan and the first price level to watch. You&apos;ll add the steps that follow on the next page.
      </Typography>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.canSave) draft.create();
        }}
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", md: "minmax(180px, 1fr) minmax(320px, 1.6fr) auto" },
          alignItems: "start",
        }}
      >
        <TextField
          label="Playbook name"
          placeholder="e.g. QQQ step-up buying"
          size="small"
          fullWidth
          value={draft.name}
          onChange={(e) => draft.setName(e.target.value)}
        />
        <ConditionFields value={draft.firstStep} onChange={draft.setFirstStep} />
        <Button type="submit" variant="contained" disabled={!draft.canSave || draft.save.pending} sx={{ height: 40 }}>
          {draft.save.pending ? "Creating..." : "Create"}
        </Button>
        <TextField
          label="Description (optional)"
          size="small"
          fullWidth
          value={draft.description}
          onChange={(e) => draft.setDescription(e.target.value)}
          sx={{ gridColumn: { md: "1 / 3" } }}
        />
      </Box>
      {draft.save.error && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {draft.save.error}
        </Typography>
      )}
    </Paper>
  );
}
