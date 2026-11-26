import { z } from "zod";
import { isValidEan13 } from "./ean13";
import { manageableRoles } from "./permissions";
import { ROLES } from "./roles";

/**
 * "12.500", "12500", "Rp 12.500" -> 12500. Mengembalikan null bila bukan nominal
 * Rupiah bulat (mis. ada koma desimal atau huruf).
 */
export function parseRupiah(input: string): number | null {
  const cleaned = input.replace(/^\s*rp\.?\s*/i, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned.replace(/\./g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(1, { error: `${label} wajib diisi.` })
    .max(max, { error: `${label} maksimal ${max} karakter.` });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} maksimal ${max} karakter.` })
    .transform((v) => v || null);

export const rupiah = (label: string) =>
  z.string({ error: `${label} wajib diisi.` }).transform((v, ctx) => {
    if (v.trim() === "") {
      ctx.addIssue({ code: "custom", message: `${label} wajib diisi.` });
      return z.NEVER;
    }
    const n = parseRupiah(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: `${label} harus nominal Rupiah tanpa desimal, mis. 12.500.` });
      return z.NEVER;
    }
    return n;
  });

const optionalRupiah = (label: string) =>
  z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const n = parseRupiah(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: `${label} harus nominal Rupiah tanpa desimal, atau dikosongkan.` });
      return z.NEVER;
    }
    return n;
  });

const wholeNumber = (label: string, { min = 0, max = 1_000_000 } = {}) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .regex(/^-?\d+$/, { error: `${label} harus bilangan bulat.` })
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(min, { error: `${label} minimal ${min}.` })
        .max(max, { error: `${label} maksimal ${max}.` }),
    );

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

// ---------------------------------------------------------------------------
//  Katalog
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: text("Nama kategori", 60),
});

export const productSchema = z.object({
  name: text("Nama produk", 120),
  sku: text("SKU", 40).regex(/^[A-Za-z0-9._-]+$/, {
    error: "SKU hanya boleh huruf, angka, titik, garis bawah, dan tanda minus.",
  }),
  barcode: optionalText(14, "Barcode").refine(
    (v) => v === null || (/^\d{8,14}$/.test(v) && (v.length !== 13 || isValidEan13(v))),
    { error: "Barcode harus 8 sampai 14 digit angka; untuk 13 digit, digit ceknya harus valid (EAN-13)." },
  ),
  unit: text("Satuan", 20),
  price: rupiah("Harga jual"),
  cost: rupiah("Harga modal"),
  categoryId: z.string().transform((v) => v || null),
  isActive: checkbox,
});

// ---------------------------------------------------------------------------
//  Stok
// ---------------------------------------------------------------------------

export const stockInSchema = z.object({
  quantity: wholeNumber("Jumlah masuk", { min: 1, max: 100_000 }),
  note: optionalText(200, "Catatan"),
});

export const stockOpnameSchema = z.object({
  counted: wholeNumber("Stok hasil hitung", { min: 0, max: 1_000_000 }),
  note: text("Alasan penyesuaian", 200),
});

export const branchStockSettingsSchema = z.object({
  minStock: wholeNumber("Stok minimum", { min: 0, max: 100_000 }),
  priceOverride: optionalRupiah("Harga khusus cabang"),
});

// ---------------------------------------------------------------------------
//  Pengguna
// ---------------------------------------------------------------------------

const pin = z
  .string()
  .trim()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4,6}$/.test(v), { error: "PIN harus 4 sampai 6 digit angka." });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Format email belum benar." }).max(120));

const password = z.string().min(8, { error: "Kata sandi minimal 8 karakter." }).max(72, {
  error: "Kata sandi maksimal 72 karakter.",
});

const managedRole = z.enum(ROLES).refine((r) => manageableRoles("OWNER").includes(r), {
  error: "Role tidak valid.",
});

export const userCreateSchema = z.object({
  name: text("Nama", 80),
  email,
  role: managedRole,
  branchId: z.string().min(1, { error: "Pilih cabang." }),
  password,
  pin,
});

export const userUpdateSchema = z.object({
  name: text("Nama", 80),
  email,
  role: managedRole,
  branchId: z.string().min(1, { error: "Pilih cabang." }),
  isActive: checkbox,
  // Kosong = tidak diubah.
  password: z
    .string()
    .transform((v) => v || null)
    .pipe(password.nullable()),
  pin,
  clearPin: checkbox,
});

// ---------------------------------------------------------------------------
//  Kasir
// ---------------------------------------------------------------------------

export const openShiftSchema = z.object({
  openingCash: rupiah("Modal awal"),
  branchId: z.string().transform((v) => v || null),
});

const int = (label: string, max: number) =>
  z
    .number({ error: `${label} harus angka.` })
    .int({ error: `${label} harus bilangan bulat.` })
    .min(0, { error: `${label} tidak boleh negatif.` })
    .max(max, { error: `${label} terlalu besar.` });

/** Isi keranjang dari layar kasir. Harga TIDAK dikirim klien; server mengambilnya sendiri. */
export const cartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: int("Jumlah", 10_000).min(1, { error: "Jumlah minimal 1." }),
        discount: int("Diskon baris", 1_000_000_000),
      }),
    )
    .min(1, { error: "Keranjang masih kosong." })
    .max(200, { error: "Maksimal 200 baris per transaksi." })
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, {
      error: "Produk yang sama muncul dua kali di keranjang.",
    }),
  transactionDiscount: int("Diskon transaksi", 1_000_000_000),
  /** Total yang dilihat kasir; ditolak bila berbeda dengan hitungan server. */
  expectedTotal: int("Total", 10_000_000_000),
});

export const checkoutSchema = cartSchema.extend({
  tendered: int("Uang diterima", 10_000_000_000),
});

export const amountSchema = int("Nominal", 10_000_000_000).min(1, { error: "Nominal minimal Rp 1." });

export type CartInput = z.infer<typeof cartSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Ambil nilai string dari FormData untuk dikirim ke schema (null -> undefined). */
export function formValues(formData: FormData, keys: readonly string[]): Record<string, string | undefined> {
  return Object.fromEntries(
    keys.map((k) => {
      const v = formData.get(k);
      return [k, typeof v === "string" ? v : undefined];
    }),
  );
}

export const closeShiftSchema = z.object({
  countedCash: rupiah("Uang yang dihitung"),
  note: optionalText(200, "Catatan"),
});

export const voidSchema = z.object({
  reason: z
    .string({ error: "Alasan pembatalan wajib diisi." })
    .trim()
    .min(5, { error: "Tulis alasan pembatalan, minimal 5 karakter." })
    .max(200, { error: "Alasan maksimal 200 karakter." }),
});

/** Transfer stok antar-cabang. Dikirim sebagai objek dari form transfer (bukan FormData). */
export const transferSchema = z
  .object({
    fromBranchId: z.string().nullable(),
    toBranchId: z.string({ error: "Pilih cabang tujuan." }).min(1, { error: "Pilih cabang tujuan." }),
    note: z.string().trim().max(200, { error: "Catatan maksimal 200 karakter." }).transform((v) => v || null),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          qty: int("Jumlah", 100_000).min(1, { error: "Jumlah minimal 1." }),
        }),
      )
      .min(1, { error: "Tambahkan minimal satu produk." })
      .max(100, { error: "Maksimal 100 produk per transfer." })
      .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, {
        error: "Produk yang sama muncul dua kali.",
      }),
  });
export type TransferInput = z.infer<typeof transferSchema>;
