import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Paper, Typography } from "@mui/material";
import AddPlaybookForm from "@/components/AddPlaybookForm";
import PageHeader from "@/components/PageHeader";
import PlaybooksList from "@/components/PlaybooksList";
import { getPlaybooksWithSteps } from "@/lib/actions";
import { getErrorMessage } from "@/lib/stockUtils";

export default async function PlaybooksPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let playbooks: Awaited<ReturnType<typeof getPlaybooksWithSteps>> = [];
  let error: string | null = null;
  if (user?.email) {
    try {
      playbooks = await getPlaybooksWithSteps(user.email);
    } catch (err) {
      error = getErrorMessage(err);
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Paper component="section" elevation={1} sx={{ p: 4 }}>
          <PageHeader title="My Playbooks">{user?.email && <AddPlaybookForm userEmail={user.email} />}</PageHeader>
          {!user?.email ? (
            <Typography color="text.secondary">Log in to see your playbooks.</Typography>
          ) : error ? (
            <Typography color="error">Failed to load playbooks: {error}</Typography>
          ) : playbooks.length === 0 ? (
            <Typography color="text.secondary">
              No playbooks yet. Create one with the first price level you want to watch, then add the steps that
              follow.
            </Typography>
          ) : (
            <PlaybooksList playbooks={playbooks} />
          )}
        </Paper>
      </main>
    </div>
  );
}
