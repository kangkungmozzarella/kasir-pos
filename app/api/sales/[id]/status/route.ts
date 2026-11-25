import { assertUser, AuthError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getSaleState } from "@/lib/sale-flow";
import { toClientState } from "@/app/(pos)/pos/client-state";

/**
 * Status transaksi untuk polling dari layar kasir (tiap 2 detik saat menunggu QRIS).
 * Route handler, bukan server action: server action diproses berurutan per klien,
 * jadi polling lewat action akan menahan aksi kasir yang lain.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/sales/[id]/status">) {
  try {
    const user = await assertUser(PERMISSIONS["pos:use"]);
    const { id } = await ctx.params;
    const state = await getSaleState(id, user);
    if (!state) return Response.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
    return Response.json(toClientState(state), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AuthError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
