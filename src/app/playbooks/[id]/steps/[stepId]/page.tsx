import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaybook } from "@/backend/data";
import { getHistoricalPrices, getLatestStockPrices } from "@/backend/prices";
import StepPageView from "@/frontend/components/StepPageView";

export default async function StepPage({
  params,
}: {
  params: Promise<{ id: string; stepId: string }>;
}) {
  const { id, stepId } = await params;
  const detail = await getPlaybook(Number(id));
  const step = detail?.steps.find((s) => s.id === Number(stepId));
  if (!detail || !step) {
    notFound();
  }
  const { playbook, steps, transitions } = detail;

  const [[stock], candles] = await Promise.all([
    getLatestStockPrices([step.stock]),
    getHistoricalPrices(step.stock),
  ]);

  return (
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
        isOwner={detail.isOwner}
      />
    </main>
  );
}
