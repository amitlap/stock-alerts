import { Paper, Stack, Typography } from "@mui/material";
import NewPlaybookChips from "@/frontend/components/NewPlaybookChips";
import PageHeader from "@/frontend/components/PageHeader";
import PlaybooksList from "@/frontend/components/PlaybooksList";
import ViewersButton from "@/frontend/components/ViewersButton";
import { getPlaybooks, getSharedPlaybooks, getUser, getViewers } from "@/backend/data";
import type { PlaybookWithSteps } from "@/shared/types";
import { getErrorMessage } from "@/shared/format";

export default async function PlaybooksPage() {
  const user = await getUser();

  let playbooks: PlaybookWithSteps[] = [];
  let shared: PlaybookWithSteps[] = [];
  let viewers: string[] = [];
  let error: string | null = null;
  try {
    [playbooks, shared, viewers] = await Promise.all([getPlaybooks(), getSharedPlaybooks(), getViewers()]);
  } catch (err) {
    error = getErrorMessage(err);
  }

  return (
    <main className="flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 gap-3">
      <Paper component="section" elevation={1} sx={{ p: 4 }}>
        <PageHeader title="My Playbooks">{user?.email && !error && <ViewersButton viewers={viewers} />}</PageHeader>
        {!user?.email ? (
          <Typography color="text.secondary">Log in to see your playbooks.</Typography>
        ) : error ? (
          <Typography color="error">Failed to load playbooks: {error}</Typography>
        ) : playbooks.length === 0 ? (
          <Stack spacing={2}>
            <NewPlaybookChips userEmail={user.email} />
            <Typography color="text.secondary">No playbooks yet — pick a type above to create one.</Typography>
          </Stack>
        ) : (
          <PlaybooksList playbooks={playbooks} header={<NewPlaybookChips userEmail={user.email} />} />
        )}
      </Paper>
      {shared.length > 0 && (
        <Paper component="section" elevation={1} sx={{ p: 4 }}>
          <PageHeader section title="Shared with me" />
          <PlaybooksList playbooks={shared} shared />
        </Paper>
      )}
    </main>
  );
}
