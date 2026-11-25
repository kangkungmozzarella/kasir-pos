import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";
import { UserFacingError } from "./actions";
import { db } from "./db";
import { resolveBranchScope } from "./permissions";
import { cashDifference, expectedCash } from "./shift-math";

type Tx = Prisma.TransactionClient;

export function getOpenShift(userId: string) {
  return db.shift.findFirst({
    where: { cashierId: userId, status: "OPEN" },
    include: { branch: { select: { id: true, name: true, code: true, taxRate: true, isActive: true } } },
  });
}

/**
 * Buka shift. Satu kasir maksimal satu shift OPEN: advisory lock per user membuat
 * dua permintaan bersamaan (mis. tombol diklik dua kali) berjalan bergantian,
 * dan yang kedua cukup mendapatkan shift yang sudah dibuka.
 */
export async function openShift(user: CurrentUser, input: { openingCash: number; branchId: string | null }) {
  const branchId = resolveBranchScope(user, input.branchId);
  if (!branchId) throw new UserFacingError("Pilih cabang tempat Anda berjaga.");

  const branch = await db.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true } });
  if (!branch) throw new UserFacingError("Cabang tidak ditemukan atau sudah nonaktif.");

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shift:${user.id}`}, 0))`;
    const existing = await tx.shift.findFirst({ where: { cashierId: user.id, status: "OPEN" } });
    if (existing) return existing;
    return tx.shift.create({ data: { branchId, cashierId: user.id, openingCash: input.openingCash } });
  });
}

export type ShiftRecap = Awaited<ReturnType<typeof loadRecap>>;

/** Siapa boleh melihat rekap shift: kasirnya sendiri, admin cabangnya, dan pemilik. */
function canSeeShift(user: CurrentUser, shift: { cashierId: string; branchId: string }) {
  if (user.role === "OWNER") return true;
  if (user.role === "ADMIN") return shift.branchId === user.branchId;
  return shift.cashierId === user.id;
}

async function loadRecap(client: Tx | typeof db, shiftId: string) {
  const shift = await client.shift.findUnique({
    where: { id: shiftId },
    select: {
      id: true,
      status: true,
      branchId: true,
      cashierId: true,
      openingCash: true,
      expectedCash: true,
      countedCash: true,
      note: true,
      openedAt: true,
      closedAt: true,
      branch: { select: { name: true, code: true } },
      cashier: { select: { name: true } },
    },
  });
  if (!shift) return null;

  // Agregat di database: satu query per jenis angka, bukan per transaksi.
  const [byMethod, completed, voided, pending] = await Promise.all([
    client.payment.groupBy({
      by: ["method"],
      where: { status: "PAID", sale: { shiftId, status: "COMPLETED" } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    client.sale.aggregate({ where: { shiftId, status: "COMPLETED" }, _sum: { total: true }, _count: { _all: true } }),
    client.sale.findMany({
      where: { shiftId, status: "VOIDED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, invoiceNo: true, total: true, voidReason: true, voidedAt: true, voidedBy: { select: { name: true } } },
    }),
    client.sale.findMany({
      where: { shiftId, status: "PENDING_PAYMENT" },
      select: { id: true, invoiceNo: true, total: true },
    }),
  ]);

  const method = (m: "CASH" | "QRIS" | "CARD") => {
    const row = byMethod.find((r) => r.method === m);
    return { amount: row?._sum.amount ?? 0, count: row?._count._all ?? 0 };
  };
  const cash = method("CASH");
  // Shift yang sudah ditutup memakai angka yang dicatat saat tutup, supaya rekap tidak
  // berubah walau ada void sesudahnya (void sesudah tutup ditampilkan terpisah).
  const expected = shift.expectedCash ?? expectedCash(shift.openingCash, cash.amount);

  return {
    ...shift,
    salesCount: completed._count._all,
    revenue: completed._sum.total ?? 0,
    methods: { CASH: cash, QRIS: method("QRIS"), CARD: method("CARD") },
    expected,
    difference: shift.countedCash === null ? null : cashDifference(shift.countedCash, expected),
    voided,
    pending,
  };
}

/** Rekap shift untuk ditampilkan, atau null bila tidak ada / tidak boleh dilihat. */
export async function getShiftRecap(user: CurrentUser, shiftId: string) {
  const recap = await loadRecap(db, shiftId);
  return recap && canSeeShift(user, recap) ? recap : null;
}

/**
 * Tutup shift milik kasir sendiri. Baris Shift dikunci (FOR UPDATE) supaya checkout yang
 * sedang berjalan selesai dulu (checkout memegang kunci FOR SHARE pada shift yang sama),
 * dan checkout sesudahnya melihat shift sudah ditutup.
 */
export async function closeShift(user: CurrentUser, input: { countedCash: number; note: string | null }) {
  return db.$transaction(async (tx) => {
    const open = await tx.shift.findFirst({ where: { cashierId: user.id, status: "OPEN" }, select: { id: true } });
    if (!open) throw new UserFacingError("Tidak ada shift yang sedang terbuka.");
    await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${open.id} FOR UPDATE`;

    const recap = (await loadRecap(tx, open.id))!;
    if (recap.status !== "OPEN") throw new UserFacingError("Shift ini sudah ditutup.");
    if (recap.pending.length > 0) {
      throw new UserFacingError(
        `Transaksi ${recap.pending[0].invoiceNo} masih menunggu pembayaran. Selesaikan atau batalkan dulu sebelum tutup shift.`,
      );
    }

    await tx.shift.update({
      where: { id: open.id },
      data: {
        status: "CLOSED",
        expectedCash: recap.expected,
        countedCash: input.countedCash,
        note: input.note,
        closedAt: new Date(),
      },
    });
    return { shiftId: open.id, difference: cashDifference(input.countedCash, recap.expected) };
  });
}
