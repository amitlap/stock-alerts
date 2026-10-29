"use client";

import AddPlaybookForm from "./AddPlaybookForm";
import PageHeader from "./PageHeader";
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
      <PageHeader title="My Playbooks">
        <AddPlaybookForm userEmail={userEmail} />
      </PageHeader>
      <PlaybooksList playbooks={playbooks} />
    </>
  );
}
