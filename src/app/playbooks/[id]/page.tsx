import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaybook, getPlaybookComments, getUser } from "@/backend/data";
import PlaybookComments from "@/frontend/components/PlaybookComments";
import PlaybookDetailView from "@/frontend/components/PlaybookDetailView";

export default async function PlaybookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // ?edit=<stepId> opens that step's editor, e.g. from "Edit in playbook" on a step's page.
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  const detail = await getPlaybook(Number(id));
  if (!detail) {
    notFound();
  }
  const { playbook, steps, transitions, isOwner } = detail;
  const [comments, user] = await Promise.all([getPlaybookComments(playbook.id), getUser()]);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-4 flex-1">
        <Link href="/playbooks" className="text-sm text-zinc-500 hover:underline">
          ← Back to playbooks
        </Link>
        <PlaybookDetailView
          playbook={playbook}
          linkedAlerts={steps}
          transitions={transitions}
          isOwner={isOwner}
          initialEditStepId={edit && isOwner ? Number(edit) : undefined}
          comments={
            <PlaybookComments
              playbookId={playbook.id}
              comments={comments}
              currentEmail={user?.email}
              isOwner={isOwner}
              isPublic={playbook.is_public}
            />
          }
        />
      </main>
    </div>
  );
}
