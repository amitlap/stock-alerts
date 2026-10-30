"use client";

import { Typography } from "@mui/material";
import AddPlaybookForm from "./AddPlaybookForm";
import PageHeader from "./PageHeader";
import PlaybooksList from "./PlaybooksList";
import type { PlaybookWithSteps } from "@/lib/actions";

export default function PlaybooksPanel({
  playbooks,
  userEmail,
}: {
  playbooks: PlaybookWithSteps[];
  userEmail: string;
}) {
  return (
    <>
      <PageHeader title="My Playbooks">
        <AddPlaybookForm userEmail={userEmail} />
      </PageHeader>
      {playbooks.length === 0 ? (
        <Typography color="text.secondary">
          No playbooks yet. Create one with the first price level you want to watch, then add the steps that follow.
        </Typography>
      ) : (
        <PlaybooksList playbooks={playbooks} />
      )}
    </>
  );
}
