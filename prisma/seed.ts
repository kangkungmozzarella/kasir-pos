/**
 * Data contoh untuk demo. Semua nama toko, produk, dan akun bersifat fiktif.
 * Barcode memakai awalan GS1 "20" (khusus pemakaian internal toko), jadi tidak
 * bertabrakan dengan barcode produk asli.
 *
 * Jalankan: pnpm db:seed  (aman diulang: data lama dihapus dulu)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import { computeTotals, effectivePrice } from "../lib/pricing";
import { jakartaDateKey } from "../lib/format";
import { makeEan13 } from "../lib/ean13";
import { DEMO_PASSWORD } from "../lib/demo-accounts";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// PRNG deterministik supaya hasil seed selalu sama.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261125);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
function pickWeighted<T>(items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let r = rand() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
//  Master data
// ---------------------------------------------------------------------------


const BRANCHES = [
  {
    code: "MDN01",
    name: "Toko Contoh Medan Kota",
    address: "Jl. Contoh No. 1, Medan Kota, Medan",
    phone: "061-000-0001",
    traffic: 1.0,
  },
  {
    code: "MDN02",
    name: "Toko Contoh Medan Baru",
    address: "Jl. Contoh No. 2, Medan Baru, Medan",
    phone: "061-000-0002",
    traffic: 0.75,
  },
] as const;

type P = { name: string; unit: string; price: number; cost: number; pop: number };

// pop = seberapa sering dibeli (bobot relatif saat membangkitkan transaksi)
const CATALOG: Record<string, P[]> = {
  Sembako: [
    { name: "Beras Pandan Wangi 5 kg", unit: "karung", price: 78000, cost: 71000, pop: 4 },
    { name: "Beras Medium 5 kg", unit: "karung", price: 68000, cost: 62000, pop: 5 },
    { name: "Gula Pasir 1 kg", unit: "pcs", price: 18500, cost: 16800, pop: 7 },
    { name: "Minyak Goreng Sawit 2 L", unit: "pouch", price: 38000, cost: 34500, pop: 5 },
    { name: "Minyak Goreng Sawit 1 L", unit: "pouch", price: 19500, cost: 17600, pop: 7 },
    { name: "Telur Ayam Ras 10 butir", unit: "pak", price: 28000, cost: 25000, pop: 8 },
    { name: "Tepung Terigu Serbaguna 1 kg", unit: "pcs", price: 13500, cost: 11800, pop: 4 },
    { name: "Garam Beryodium 250 g", unit: "pcs", price: 4000, cost: 3100, pop: 3 },
  ],
  Minuman: [
    { name: "Air Mineral 600 ml", unit: "botol", price: 4000, cost: 2800, pop: 12 },
    { name: "Air Mineral 1,5 L", unit: "botol", price: 7000, cost: 5200, pop: 6 },
    { name: "Teh Melati Celup isi 25", unit: "kotak", price: 7500, cost: 6100, pop: 4 },
    { name: "Kopi Bubuk Robusta 165 g", unit: "pcs", price: 16000, cost: 13200, pop: 4 },
    { name: "Kopi Susu Sachet isi 10", unit: "renceng", price: 15500, cost: 13000, pop: 6 },
    { name: "Minuman Teh Melati 350 ml", unit: "botol", price: 5000, cost: 3800, pop: 9 },
    { name: "Susu UHT Cokelat 200 ml", unit: "kotak", price: 6500, cost: 5300, pop: 7 },
    { name: "Susu Kental Manis 370 g", unit: "kaleng", price: 13000, cost: 11200, pop: 3 },
    { name: "Sirup Cocopandan 460 ml", unit: "botol", price: 21000, cost: 17800, pop: 2 },
    { name: "Minuman Isotonik 500 ml", unit: "botol", price: 7500, cost: 5900, pop: 5 },
  ],
  "Makanan Ringan": [
    { name: "Keripik Singkong Balado 150 g", unit: "pcs", price: 12000, cost: 9500, pop: 5 },
    { name: "Kacang Tanah Kulit 250 g", unit: "pcs", price: 14000, cost: 11000, pop: 3 },
    { name: "Biskuit Kelapa 300 g", unit: "pcs", price: 11500, cost: 9300, pop: 4 },
    { name: "Wafer Cokelat 140 g", unit: "pcs", price: 9000, cost: 7200, pop: 6 },
    { name: "Roti Tawar Kupas", unit: "pcs", price: 17000, cost: 14000, pop: 5 },
    { name: "Kerupuk Udang Mentah 250 g", unit: "pcs", price: 15000, cost: 12000, pop: 2 },
    { name: "Cokelat Batang 62 g", unit: "pcs", price: 12500, cost: 10000, pop: 4 },
    { name: "Permen Jahe 125 g", unit: "pcs", price: 8000, cost: 6200, pop: 3 },
  ],
  "Mi & Makanan Instan": [
    { name: "Mi Instan Goreng", unit: "bungkus", price: 3500, cost: 2900, pop: 14 },
    { name: "Mi Instan Kuah Ayam Bawang", unit: "bungkus", price: 3300, cost: 2750, pop: 10 },
    { name: "Mi Instan Kuah Soto", unit: "bungkus", price: 3300, cost: 2750, pop: 8 },
    { name: "Bihun Jagung 175 g", unit: "pcs", price: 6500, cost: 5100, pop: 3 },
    { name: "Sarden Saus Tomat 155 g", unit: "kaleng", price: 11000, cost: 9100, pop: 4 },
    { name: "Kornet Sapi 198 g", unit: "kaleng", price: 26000, cost: 22000, pop: 2 },
    { name: "Oat Instan 800 g", unit: "pcs", price: 52000, cost: 45000, pop: 1 },
  ],
  "Bumbu Dapur": [
    { name: "Kecap Manis 520 ml", unit: "botol", price: 24000, cost: 20500, pop: 4 },
    { name: "Saus Sambal 335 ml", unit: "botol", price: 14500, cost: 11800, pop: 4 },
    { name: "Kaldu Bubuk Ayam 100 g", unit: "pcs", price: 6000, cost: 4700, pop: 5 },
    { name: "Lada Bubuk 15 g", unit: "sachet", price: 3500, cost: 2600, pop: 3 },
    { name: "Santan Kemasan 65 ml", unit: "pcs", price: 3500, cost: 2700, pop: 6 },
    { name: "Bumbu Nasi Goreng 20 g", unit: "sachet", price: 3000, cost: 2200, pop: 4 },
    { name: "Terasi Udang 100 g", unit: "pcs", price: 9000, cost: 7000, pop: 2 },
    { name: "Bawang Goreng 100 g", unit: "pcs", price: 16000, cost: 12500, pop: 2 },
  ],
  "Kebersihan Rumah": [
    { name: "Sabun Cuci Piring Jeruk Nipis 780 ml", unit: "pouch", price: 15500, cost: 12800, pop: 4 },
    { name: "Deterjen Bubuk 800 g", unit: "pcs", price: 22000, cost: 18500, pop: 4 },
    { name: "Pewangi Pakaian 900 ml", unit: "pouch", price: 17500, cost: 14500, pop: 3 },
    { name: "Pembersih Lantai 800 ml", unit: "pouch", price: 14000, cost: 11500, pop: 2 },
    { name: "Tisu Wajah 250 lembar", unit: "pak", price: 13500, cost: 11000, pop: 4 },
    { name: "Kantong Sampah 60x80 isi 10", unit: "pak", price: 9500, cost: 7000, pop: 2 },
  ],
  "Perawatan Diri": [
    { name: "Sabun Mandi Batang 85 g", unit: "pcs", price: 4500, cost: 3500, pop: 6 },
    { name: "Sampo Sachet isi 12", unit: "renceng", price: 9000, cost: 7200, pop: 5 },
    { name: "Pasta Gigi 190 g", unit: "pcs", price: 14500, cost: 11800, pop: 4 },
    { name: "Sikat Gigi Bulu Lembut", unit: "pcs", price: 8000, cost: 6000, pop: 3 },
    { name: "Sabun Cair Mandi 450 ml", unit: "botol", price: 24500, cost: 20500, pop: 2 },
    { name: "Minyak Kayu Putih 60 ml", unit: "botol", price: 23000, cost: 19000, pop: 2 },
    { name: "Bedak Bayi 100 g", unit: "pcs", price: 11000, cost: 8800, pop: 2 },
  ],
};

// Jam buka 07.00 sampai 22.00. Bobot keramaian per jam: sore dan malam paling ramai.
const HOUR_WEIGHT: Record<number, number> = {
  7: 3, 8: 4, 9: 4, 10: 4, 11: 5, 12: 6, 13: 5, 14: 5,
  15: 6, 16: 8, 17: 10, 18: 10, 19: 9, 20: 7, 21: 4,
};
const HOURS = Object.keys(HOUR_WEIGHT).map(Number);
const DAYS_OF_HISTORY = 30;
const OPENING_CASH = 500_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Tengah malam WIB (UTC+7) untuk tanggal `daysAgo` hari sebelum hari ini. */
function jakartaMidnight(daysAgo: number): Date {
  const key = jakartaDateKey(new Date());
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(4, 6));
  const d = Number(key.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d) - 7 * HOUR_MS - daysAgo * DAY_MS);
}

function cashTendered(amount: number): number {
  const options = [amount];
  for (const step of [5_000, 10_000, 50_000, 100_000]) {
    options.push(Math.ceil(amount / step) * step);
  }
  return options[randInt(0, options.length - 1)];
}

async function reset() {
  // Urutan mengikuti foreign key: anak dulu, induk belakangan.
  await db.stockTransferItem.deleteMany();
  await db.stockTransfer.deleteMany();
  await db.payment.deleteMany();
  await db.saleItem.deleteMany();
  await db.sale.deleteMany();
  await db.invoiceCounter.deleteMany();
  await db.shift.deleteMany();
  await db.stockMovement.deleteMany();
  await db.branchStock.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.user.deleteMany();
  await db.branch.deleteMany();
}

async function main() {
  console.log("Menghapus data lama...");
  await reset();

  // --- Cabang ---------------------------------------------------------------
  const branches = [];
  for (const b of BRANCHES) {
    branches.push({
      ...(await db.branch.create({
        data: { code: b.code, name: b.name, address: b.address, phone: b.phone, taxRate: 11 },
      })),
      traffic: b.traffic,
    });
  }

  // --- Pengguna -------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await db.user.create({
    data: { name: "Pemilik (demo)", email: "pemilik@demo.test", passwordHash, role: "OWNER" },
  });

  const staff = new Map<string, { admin: string; cashiers: string[] }>();
  for (const b of branches) {
    const tag = b.code.toLowerCase();
    const area = b.name.replace("Toko Contoh ", "");
    const admin = await db.user.create({
      data: { name: `Admin ${area}`, email: `admin.${tag}@demo.test`, passwordHash, role: "ADMIN", branchId: b.id },
    });
    const cashiers: string[] = [];
    for (const n of [1, 2]) {
      const c = await db.user.create({
        data: {
          name: `Kasir ${n} ${area}`,
          email: `kasir${n}.${tag}@demo.test`,
          passwordHash,
          pin: await bcrypt.hash(String(n).repeat(4), 10), // PIN demo: 1111 / 2222
          role: "CASHIER",
          branchId: b.id,
        },
      });
      cashiers.push(c.id);
    }
    staff.set(b.id, { admin: admin.id, cashiers });
  }

  // --- Kategori & produk ----------------------------------------------------
  type SeedProduct = { id: string; price: number; cost: number; pop: number; name: string };
  const products: SeedProduct[] = [];
  let skuNo = 1;
  for (const [categoryName, items] of Object.entries(CATALOG)) {
    const category = await db.category.create({ data: { name: categoryName } });
    for (const item of items) {
      const n = skuNo++;
      const product = await db.product.create({
        data: {
          sku: `SKU-${String(n).padStart(4, "0")}`,
          barcode: makeEan13(`20${String(n).padStart(10, "0")}`),
          name: item.name,
          unit: item.unit,
          price: item.price,
          cost: item.cost,
          categoryId: category.id,
        },
      });
      products.push({ id: product.id, price: item.price, cost: item.cost, pop: item.pop, name: item.name });
    }
  }
  console.log(`${branches.length} cabang, ${products.length} produk.`);

  // Harga khusus beberapa produk di cabang kedua (sewa lebih mahal).
  const overrides = new Map<string, number>();
  for (const p of products.filter((_, i) => i % 9 === 4)) {
    overrides.set(`${branches[1].id}:${p.id}`, p.price + 500);
  }
  const priceAt = (branchId: string, p: SeedProduct) => effectivePrice(p.price, overrides.get(`${branchId}:${p.id}`));

  // --- Riwayat penjualan 30 hari ---------------------------------------------
  const shifts: Prisma.ShiftCreateManyInput[] = [];
  const sales: Prisma.SaleCreateManyInput[] = [];
  const saleItems: Prisma.SaleItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const movements: Prisma.StockMovementCreateManyInput[] = [];
  const counters: Prisma.InvoiceCounterCreateManyInput[] = [];
  const sold = new Map<string, number>(); // "branchId:productId" -> qty

  for (let daysAgo = DAYS_OF_HISTORY; daysAgo >= 1; daysAgo--) {
    const midnight = jakartaMidnight(daysAgo);
    const weekday = new Date(midnight.getTime() + 7 * HOUR_MS).getUTCDay(); // 0 = Minggu
    const dayFactor = weekday === 0 || weekday === 6 ? 1.5 : weekday === 5 ? 1.15 : 1;
    const dateKey = jakartaDateKey(midnight);

    for (const branch of branches) {
      const { cashiers } = staff.get(branch.id)!;
      // Kasir bergantian pegang shift pagi/sore setiap hari.
      const [morningCashier, eveningCashier] = daysAgo % 2 === 0 ? cashiers : [...cashiers].reverse();
      const shiftDefs = [
        { id: randomUUID(), cashierId: morningCashier, from: 7, to: 15, cash: 0 },
        { id: randomUUID(), cashierId: eveningCashier, from: 15, to: 22, cash: 0 },
      ];

      const count = Math.round(45 * branch.traffic * dayFactor * (0.8 + rand() * 0.4));
      const times = Array.from({ length: count }, () => {
        const hour = pickWeighted(HOURS, (h) => HOUR_WEIGHT[h]);
        return new Date(midnight.getTime() + hour * HOUR_MS + randInt(0, HOUR_MS - 1));
      }).sort((a, b) => a.getTime() - b.getTime());

      times.forEach((createdAt, idx) => {
        const hourWib = Math.floor((createdAt.getTime() - midnight.getTime()) / HOUR_MS);
        const shift = hourWib < 15 ? shiftDefs[0] : shiftDefs[1];

        // Pilih 1 sampai 6 produk berbeda, paling sering 2 atau 3.
        const lineCount = pickWeighted([1, 2, 3, 4, 5, 6], (n) => [3, 5, 5, 3, 2, 1][n - 1]);
        const chosen = new Set<SeedProduct>();
        while (chosen.size < lineCount) chosen.add(pickWeighted(products, (p) => p.pop));

        const lines = [...chosen].map((p) => {
          const unitPrice = priceAt(branch.id, p);
          const qty = p.price <= 5000 ? randInt(1, 5) : randInt(1, 2);
          // Sesekali ada potongan baris 10% (dibulatkan ke ratusan).
          const discount = rand() < 0.04 ? Math.floor((unitPrice * qty * 0.1) / 100) * 100 : 0;
          return { p, unitPrice, qty, discount };
        });

        const subtotalPreview = lines.reduce((s, l) => s + l.unitPrice * l.qty - l.discount, 0);
        const transactionDiscount = subtotalPreview > 100_000 && rand() < 0.05 ? 5_000 : 0;
        const totals = computeTotals(lines, { taxRate: branch.taxRate, transactionDiscount });

        const saleId = randomUUID();
        const seq = idx + 1;
        sales.push({
          id: saleId,
          invoiceNo: `${branch.code}-${dateKey}-${String(seq).padStart(4, "0")}`,
          branchId: branch.id,
          shiftId: shift.id,
          cashierId: shift.cashierId,
          status: "COMPLETED",
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          createdAt,
          completedAt: createdAt,
        });

        lines.forEach((l, i) => {
          saleItems.push({
            saleId,
            productId: l.p.id,
            productName: l.p.name,
            unitPrice: l.unitPrice,
            unitCost: l.p.cost,
            quantity: l.qty,
            discount: l.discount,
            lineTotal: totals.lines[i].lineTotal,
          });
          movements.push({
            branchId: branch.id,
            productId: l.p.id,
            type: "SALE",
            quantity: -l.qty,
            refId: saleId,
            userId: shift.cashierId,
            createdAt,
          });
          const key = `${branch.id}:${l.p.id}`;
          sold.set(key, (sold.get(key) ?? 0) + l.qty);
        });

        const method = pickWeighted(["CASH", "QRIS", "CARD"] as const, (m) => ({ CASH: 60, QRIS: 28, CARD: 12 })[m]);
        const base = { saleId, amount: totals.total, status: "PAID" as const, createdAt, paidAt: createdAt };
        if (method === "CASH") {
          const tendered = cashTendered(totals.total);
          payments.push({ ...base, method, tendered, change: tendered - totals.total });
          shift.cash += totals.total;
        } else if (method === "QRIS") {
          payments.push({ ...base, method, providerRef: `MOCK-QR-${randomUUID()}` });
        } else {
          payments.push({
            ...base,
            method,
            providerRef: `MOCK-CARD-${randomUUID()}`,
            cardLast4: String(randInt(0, 9999)).padStart(4, "0"),
            approvalCode: String(randInt(0, 999999)).padStart(6, "0"),
          });
        }
      });

      counters.push({ branchId: branch.id, date: dateKey, lastSeq: count });

      for (const s of shiftDefs) {
        const expectedCash = OPENING_CASH + s.cash;
        // Sebagian besar kas pas; sesekali selisih kecil.
        const diff = rand() < 0.85 ? 0 : randInt(-10, 5) * 1_000;
        shifts.push({
          id: s.id,
          branchId: branch.id,
          cashierId: s.cashierId,
          status: "CLOSED",
          openingCash: OPENING_CASH,
          expectedCash,
          countedCash: expectedCash + diff,
          note: diff !== 0 ? "Selisih kas saat tutup shift" : null,
          openedAt: new Date(midnight.getTime() + s.from * HOUR_MS),
          closedAt: new Date(midnight.getTime() + s.to * HOUR_MS),
        });
      }
    }
  }

  // --- Stok per cabang --------------------------------------------------------
  // Stok akhir ditentukan dulu, lalu stok awal = stok akhir + total terjual,
  // supaya riwayat StockMovement selalu cocok dengan BranchStock.quantity.
  const stocks: Prisma.BranchStockCreateManyInput[] = [];
  const initialPurchaseAt = jakartaMidnight(DAYS_OF_HISTORY + 1);
  let lowCount = 0;
  for (const branch of branches) {
    const { admin } = staff.get(branch.id)!;
    for (const p of products) {
      const key = `${branch.id}:${p.id}`;
      const minStock = p.pop >= 8 ? 24 : p.pop >= 4 ? 12 : 6;
      const isLow = rand() < 0.12; // sengaja di bawah minimum agar peringatan stok menipis muncul
      const finalQty = isLow ? randInt(0, minStock - 1) : randInt(minStock + 5, minStock * 5);
      if (isLow) lowCount++;
      stocks.push({
        branchId: branch.id,
        productId: p.id,
        quantity: finalQty,
        minStock,
        priceOverride: overrides.get(key) ?? null,
      });
      movements.push({
        branchId: branch.id,
        productId: p.id,
        type: "PURCHASE",
        quantity: finalQty + (sold.get(key) ?? 0),
        note: "Stok awal (data contoh)",
        userId: admin,
        createdAt: new Date(initialPurchaseAt.getTime() + 8 * HOUR_MS),
      });
    }
  }

  console.log("Menyimpan transaksi...");
  const chunk = async <T>(rows: T[], fn: (batch: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 2000) await fn(rows.slice(i, i + 2000));
  };
  await db.branchStock.createMany({ data: stocks });
  await chunk(shifts, (data) => db.shift.createMany({ data }));
  await chunk(sales, (data) => db.sale.createMany({ data }));
  await chunk(saleItems, (data) => db.saleItem.createMany({ data }));
  await chunk(payments, (data) => db.payment.createMany({ data }));
  await chunk(movements, (data) => db.stockMovement.createMany({ data }));
  await db.invoiceCounter.createMany({ data: counters });

  console.log(
    `${shifts.length} shift, ${sales.length} transaksi, ${saleItems.length} item, ` +
      `${lowCount} stok di bawah minimum.`,
  );
  console.log(`Selesai. Kata sandi semua akun demo: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
