import { notFound } from "next/navigation";
import { Paper, Typography } from "@mui/material";
import { getAlertById } from "@/lib/actions";
import AlertDetailForm from "@/components/AlertDetailForm";

export default async function AlertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const alert = await getAlertById(Number(id));

  if (!alert) {
    notFound();
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Paper component="section" elevation={1} sx={{ p: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Alert Details
          </Typography>
          <AlertDetailForm alert={alert} />
        </Paper>
      </main>
    </div>
  );
}
