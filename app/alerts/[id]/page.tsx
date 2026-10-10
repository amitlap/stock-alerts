import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlertById, getLatestStockPrices } from "@/lib/actions";
import AlertPageView from "@/components/AlertPageView";

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

  const [stock] = await getLatestStockPrices([alert.stock]);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Back to alerts
        </Link>
        <AlertPageView alert={alert} stock={stock} />
      </main>
    </div>
  );
}
