import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getAlertsByPlaybook, getPlaybookById } from "@/lib/actions";
import PlaybookDetailView from "@/components/PlaybookDetailView";

export default async function PlaybookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playbook = await getPlaybookById(Number(id));

  if (!playbook) {
    notFound();
  }

  const supabase = createClient(await cookies());
  const [linkedAlerts, { data: availableAlerts }] = await Promise.all([
    getAlertsByPlaybook(playbook.id),
    supabase
      .from("alerts")
      .select("id, created_at, stock, email, price, operator, isActive")
      .eq("email", playbook.email)
      .is("playbook_id", null),
  ]);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4 flex-1">
        <Link href="/playbooks" className="text-sm text-zinc-500 hover:underline">
          ← Back to playbooks
        </Link>
        <PlaybookDetailView
          playbook={playbook}
          linkedAlerts={linkedAlerts}
          availableAlerts={availableAlerts ?? []}
        />
      </main>
    </div>
  );
}
