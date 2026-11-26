import { describe, expect, it } from "vitest";
import type { ReceiptData } from "@/components/receipt/receipt";
import { EscPos, receiptToEscPos, toPrintable, wrap } from "./escpos";

const data: ReceiptData = {
  store: { name: "Toko Contoh Medan Kota", address: "Jl. Contoh No. 1, Medan", phone: "061-000000", footer: "Terima kasih telah berbelanja!" },
  invoiceNo: "MDN01-20261126-0042",
  createdAt: new Date("2026-11-26T03:15:00Z"),
  cashierName: "Kasir 1 Medan Kota",
  status: "COMPLETED",
  items: [
    { name: "Gula Pasir 1 kg", qty: 2, unitPrice: 18_500, discount: 0, lineTotal: 37_000 },
    { name: "Minyak Goreng Sawit 2 L kemasan pouch hemat keluarga", qty: 1, unitPrice: 38_000, discount: 3_800, lineTotal: 34_200 },
  ],
  subtotal: 71_200,
  discountTotal: 0,
  taxRate: 11,
  taxTotal: 7_832,
  total: 79_032,
  payments: [{ method: "CASH", amount: 79_032, tendered: 100_000, change: 20_968, providerRef: null, cardLast4: null, approvalCode: null }],
};

const bytesOf = (b: Uint8Array) => Array.from(b);

describe("ESC/POS", () => {
  it("perintah dasar: init, rata tengah, tebal, ukuran ganda, potong", () => {
    const b = bytesOf(new EscPos(32).init().align("center").bold(true).doubleSize(true).line("A").cut().build());
    expect(b.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(b.slice(2, 5)).toEqual([0x1b, 0x61, 1]);
    expect(b.slice(5, 8)).toEqual([0x1b, 0x45, 1]);
    expect(b.slice(8, 11)).toEqual([0x1d, 0x21, 0x11]);
    expect(b.slice(11, 13)).toEqual([0x41, 0x0a]);
    expect(b.slice(-4)).toEqual([0x1d, 0x56, 0x42, 3]);
  });

  it("kiri-kanan diratakan penuh; bila tidak muat, nilai turun ke baris berikutnya", () => {
    expect(new EscPos(32).row("Subtotal", "71.200").text()).toBe("Subtotal" + " ".repeat(18) + "71.200");
    const t = new EscPos(32).row("Nama pelanggan yang sangat panjang", "123.456").text().split("\n");
    expect(t).toEqual(["Nama pelanggan yang sangat", "panjang", "123.456".padStart(32)]);
  });

  it("hanya ASCII yang dikirim ke printer", () => {
    expect(toPrintable("Rp 12.500 Café — ✓")).toBe("Rp 12.500 Cafe - ?");
    const bytes = bytesOf(receiptToEscPos({ ...data, store: { ...data.store, name: "Kopi Café" } }, 32).bytes);
    expect(bytes.every((x) => x < 0x80)).toBe(true);
  });

  it("baris panjang dipecah di spasi", () => {
    expect(wrap("Minyak Goreng Sawit 2 L kemasan pouch hemat keluarga", 32)).toEqual(["Minyak Goreng Sawit 2 L kemasan", "pouch hemat keluarga"]);
  });

  it.each([32, 48] as const)("struk %i kolom: tidak ada baris melebihi lebar kertas, isi lengkap", (cols) => {
    const { text, bytes } = receiptToEscPos(data, cols);
    const lines = text.split("\n").filter((l) => !l.includes("potong"));
    expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(cols);
    expect(text).toContain("MDN01-20261126-0042");
    expect(text).toMatch(/TOTAL\s+Rp 79\.032/);
    expect(text).toMatch(/Kembalian\s+20\.968/);
    expect(text).toMatch(/ {2}Diskon\s+-3\.800/);
    expect(text).toContain("Terima kasih telah berbelanja!");
    expect(bytesOf(bytes).slice(-4)).toEqual([0x1d, 0x56, 0x42, 3]);
  });

  it("pratinjau 32 kolom stabil", () => {
    expect(receiptToEscPos(data, 32).text).toMatchInlineSnapshot(`
      "     Toko Contoh Medan Kota
          Jl. Contoh No. 1, Medan
              Telp 061-000000
      --------------------------------
      No           MDN01-20261126-0042
      Waktu         26 Nov 2026, 10.15
      Kasir         Kasir 1 Medan Kota
      --------------------------------
      Gula Pasir 1 kg
      2 x 18.500                37.000
      Minyak Goreng Sawit 2 L kemasan
      pouch hemat keluarga
      1 x 38.000                38.000
        Diskon                  -3.800
      --------------------------------
      Subtotal                  71.200
      PPN 11%                    7.832
      TOTAL                  Rp 79.032
      --------------------------------
      Tunai                    100.000
      Kembalian                 20.968
      --------------------------------
       Terima kasih telah berbelanja!


             - - - potong - - -"
    `);
  });
});
