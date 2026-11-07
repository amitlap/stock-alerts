import { Paper, Stack, Typography } from "@mui/material";
import NewPlaybookChips from "@/frontend/components/NewPlaybookChips";
import PageHeader from "@/frontend/components/PageHeader";
import PlaybooksList from "@/frontend/components/PlaybooksList";
import { getPlaybooks, getUser } from "@/backend/data";
import type { PlaybookWithSteps } from "@/shared/types";
import { getErrorMessage } from "@/shared/format";

export default async function PlaybooksPage() {
  const user = await getUser();

  let playbooks: PlaybookWithSteps[] = [];
  let error: string | null = null;
  try {
    playbooks = await getPlaybooks();
  } catch (err) {
    error = getErrorMessage(err);
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Paper component="section" elevation={1} sx={{ p: 4 }}>
          <PageHeader title="My Playbooks" />
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
      </main>
    </div>
  );
}
