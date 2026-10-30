import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlertById, getHistoricalPrices, getLatestStockPrices, getPlaybookById } from "@/lib/actions";
import AlertPageView from "@/components/AlertPageView";

export default async function StepPage({
  params,
}: {
  params: Promise<{ id: string; stepId: string }>;
}) {
  const { id, stepId } = await params;
  const [playbook, step] = await Promise.all([getPlaybookById(Number(id)), getAlertById(Number(stepId))]);

  if (!playbook || !step || step.playbook_id !== playbook.id) {
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
        <AlertPageView alert={step} stock={stock} candles={candles} playbook={playbook} />
      </main>
    </div>
  );
}
