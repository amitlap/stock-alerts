"use client";

import { Stack, Typography } from "@mui/material";
import AddPlaybookForm from "./AddPlaybookForm";
import PlaybooksList from "./PlaybooksList";
import type { Playbook } from "@/lib/actions";

export default function PlaybooksPanel({
  playbooks,
  userEmail,
}: {
  playbooks: Playbook[];
  userEmail: string;
}) {
  return (
    <>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5" component="h1">
          My Playbooks
        </Typography>
        <AddPlaybookForm userEmail={userEmail} />
      </Stack>
      <PlaybooksList playbooks={playbooks} />
    </>
  );
}
