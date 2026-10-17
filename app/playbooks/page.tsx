import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Paper, Typography } from "@mui/material";
import UserHeader from "@/components/UserHeader";
import PlaybooksPanel from "@/components/PlaybooksPanel";

export default async function PlaybooksPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only show playbooks belonging to the signed-in user.
  const { data: playbooks, error } = user?.email
    ? await supabase
        .from("playbooks")
        .select("id, created_at, description, email, name")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <UserHeader userEmail={user?.email ?? null} />
      </div>
      <main className="flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Paper component="section" elevation={1} sx={{ p: 4 }}>
          {!user?.email ? (
            <>
              <Typography variant="h5" component="h1" gutterBottom>
                My Playbooks
              </Typography>
              <Typography color="text.secondary">Log in to see your playbooks.</Typography>
            </>
          ) : error ? (
            <>
              <Typography variant="h5" component="h1" gutterBottom>
                My Playbooks
              </Typography>
              <Typography color="error">Failed to load playbooks: {error.message}</Typography>
            </>
          ) : (
            <PlaybooksPanel playbooks={playbooks ?? []} userEmail={user.email} />
          )}
        </Paper>
      </main>
    </div>
  );
}
