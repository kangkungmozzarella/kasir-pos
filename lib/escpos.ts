import type { ReceiptData } from "@/components/receipt/receipt";
import { formatDateTime, formatNumber } from "./format";

/**
 * Builder perintah ESC/POS untuk printer struk thermal. Menghasilkan byte untuk dikirim
 * ke printer (Web Serial) sekaligus pratinjau teks, supaya hasilnya bisa diperiksa
 * tanpa printer. Lebar 32 kolom untuk kertas 58 mm, 48 kolom untuk 80 mm (font A).
 */

export type Columns = 32 | 48;

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Printer thermal murah umumnya hanya mengenal ASCII (code page 437). Huruf beraksen
 * dibuang aksennya, spasi tak terputus jadi spasi, karakter lain jadi "?".
 */
export function toPrintable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[  ]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?");
}

/** Pecah teks menjadi baris selebar `width`, memotong di spasi bila bisa. */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let rest = toPrintable(text).trimEnd(); // spasi awal dipertahankan untuk indentasi
  while (rest.length > width) {
    const cut = rest.lastIndexOf(" ", width);
    const at = cut > width / 2 ? cut : width;
    out.push(rest.slice(0, at).trimEnd());
    rest = rest.slice(at).trimStart();
  }
  out.push(rest);
  return out;
}

export class EscPos {
  private bytes: number[] = [];
  private lines: string[] = [];
  private alignment: "left" | "center" | "right" = "left";
  private double = false;

  constructor(readonly columns: Columns) {}

  /** ESC @: reset printer ke pengaturan awal. */
  init() {
    this.bytes.push(ESC, 0x40);
    this.alignment = "left";
    this.double = false;
    return this;
  }

  /** ESC a n: 0 kiri, 1 tengah, 2 kanan. */
  align(a: "left" | "center" | "right") {
    this.alignment = a;
    this.bytes.push(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2);
    return this;
  }

  /** ESC E n: tebal. */
  bold(on: boolean) {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  /** GS ! n: lebar dan tinggi ganda. Satu baris muat setengah kolom. */
  doubleSize(on: boolean) {
    this.double = on;
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  private get width() {
    return this.double ? this.columns / 2 : this.columns;
  }

  /** Satu baris teks (dipecah otomatis bila terlalu panjang). */
  line(text = "") {
    for (const part of text === "" ? [""] : wrap(text, this.width)) {
      for (const ch of part) this.bytes.push(ch.charCodeAt(0));
      this.bytes.push(LF);
      this.lines.push(this.preview(part));
    }
    return this;
  }

  /** Kiri dan kanan dalam satu baris; bila tidak muat, kanan turun ke baris berikutnya. */
  row(left: string, right: string) {
    const l = toPrintable(left);
    const r = toPrintable(right);
    const w = this.width;
    if (l.length + 1 + r.length <= w) return this.line(l + " ".repeat(w - l.length - r.length) + r);
    this.line(l);
    return this.line(r.padStart(w));
  }

  separator(char = "-") {
    return this.line(char.repeat(this.width));
  }

  feed(n = 1) {
    for (let i = 0; i < n; i++) this.line();
    return this;
  }

  /** GS V 66 n: dorong kertas n baris lalu potong sebagian. */
  cut() {
    this.bytes.push(GS, 0x56, 0x42, 3);
    this.lines.push("- - - potong - - -".padStart(Math.floor((this.columns + 18) / 2)));
    return this;
  }

  /** Pratinjau baris sesuai perataan (huruf ganda ditampilkan dengan spasi di antaranya). */
  private preview(text: string) {
    const shown = this.double ? text.split("").join(" ") : text;
    const pad = this.columns - shown.length;
    if (pad <= 0 || this.alignment === "left") return shown;
    return this.alignment === "center" ? " ".repeat(Math.floor(pad / 2)) + shown : " ".repeat(pad) + shown;
  }

  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }

  text(): string {
    return this.lines.join("\n");
  }
}

const PAYMENT_LABEL = { CASH: "Tunai", QRIS: "QRIS", CARD: "Kartu" } as const;

/** Struk yang sama dengan komponen <Receipt>, dalam bentuk ESC/POS. */
export function receiptToEscPos(data: ReceiptData, columns: Columns) {
  const n = formatNumber;
  const p = new EscPos(columns).init();

  p.align("center").bold(true).line(data.store.name).bold(false);
  if (data.store.address) p.line(data.store.address);
  if (data.store.phone) p.line(`Telp ${data.store.phone}`);
  p.align("left").separator();
  p.row("No", data.invoiceNo).row("Waktu", formatDateTime(data.createdAt)).row("Kasir", data.cashierName);
  if (data.status === "VOIDED") p.align("center").bold(true).line("*** DIBATALKAN ***").bold(false).align("left");
  p.separator();

  for (const item of data.items) {
    p.line(item.name);
    p.row(`${n(item.qty)} x ${n(item.unitPrice)}`, n(item.qty * item.unitPrice));
    if (item.discount > 0) p.row("  Diskon", `-${n(item.discount)}`);
  }
  p.separator();
  p.row("Subtotal", n(data.subtotal));
  if (data.discountTotal > 0) p.row("Diskon", `-${n(data.discountTotal)}`);
  if (data.taxRate > 0) p.row(`PPN ${data.taxRate}%`, n(data.taxTotal));
  p.bold(true).row("TOTAL", `Rp ${n(data.total)}`).bold(false);
  p.separator();

  for (const pay of data.payments) {
    p.row(PAYMENT_LABEL[pay.method], n(pay.method === "CASH" && pay.tendered != null ? pay.tendered : pay.amount));
    if (pay.method === "CASH" && pay.change != null) p.row("Kembalian", n(pay.change));
    if (pay.method === "QRIS" && pay.providerRef) p.row("Ref", pay.providerRef.slice(-12));
    if (pay.method === "CARD") {
      if (pay.cardLast4) p.row("Kartu", `**** ${pay.cardLast4}`);
      if (pay.approvalCode) p.row("Approval", pay.approvalCode);
    }
  }
  p.separator().align("center");
  if (data.store.footer) p.line(data.store.footer);
  if (data.payments.some((x) => x.method !== "CASH")) p.line("Pembayaran non-tunai: simulasi demo");
  p.align("left").feed(2).cut();
  return { bytes: p.build(), text: p.text() };
}
