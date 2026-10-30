import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAlertsByPlaybook,
  getHistoricalPrices,
  getLatestStockPrices,
  getPlaybookById,
  getTransitionsByPlaybook,
} from "@/lib/actions";
import StepPageView from "@/components/StepPageView";

export default async function StepPage({
  params,
}: {
  params: Promise<{ id: string; stepId: string }>;
}) {
  const { id, stepId } = await params;
  const playbook = await getPlaybookById(Number(id));
  if (!playbook) {
    notFound();
  }

  const [steps, transitions] = await Promise.all([
    getAlertsByPlaybook(playbook.id),
    getTransitionsByPlaybook(playbook.id),
  ]);
  const step = steps.find((s) => s.id === Number(stepId));
  if (!step) {
    notFound();
  }

  const [[stock], candles] = await Promise.all([
    getLatestStockPrices([step.stock]),
    getHistoricalPrices(step.stock),
  ]);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Link href={`/playbooks/${playbook.id}`} className="text-sm text-zinc-500 hover:underline">
          ← Back to {playbook.name || "playbook"}
        </Link>
        <StepPageView
          alert={step}
          stock={stock}
          candles={candles}
          playbook={playbook}
          steps={steps}
          transitions={transitions}
        />
      </main>
    </div>
  );
}
