import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getReceipt } from "@/lib/receipt-data";
import { ReceiptView } from "./receipt-view";

export const metadata: Metadata = { title: "Struk" };

export default function ReceiptPage(props: PageProps<"/receipt/[saleId]">) {
  return (
    <main className="min-h-dvh bg-muted print:bg-white">
      <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Memuat struk...</p>}>
        <ReceiptContent {...props} />
      </Suspense>
    </main>
  );
}

async function ReceiptContent({ params, searchParams }: PageProps<"/receipt/[saleId]">) {
  const user = await requireUser(PERMISSIONS["pos:use"]);
  const [{ saleId }, sp] = await Promise.all([params, searchParams]);
  const data = await getReceipt(saleId, user);
  if (!data) notFound();
  return <ReceiptView data={data} embed={sp.embed === "1"} backHref="/pos" />;
}
