/**
 * Kirim byte ke printer struk lewat Web Serial (Chrome/Edge desktop). Printer thermal
 * USB biasanya muncul sebagai port serial; izin port diminta sekali lalu diingat browser.
 */

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
};
type SerialLike = { getPorts(): Promise<SerialPortLike[]>; requestPort(): Promise<SerialPortLike> };

function serial(): SerialLike | undefined {
  return typeof navigator !== "undefined" ? (navigator as Navigator & { serial?: SerialLike }).serial : undefined;
}

export function isSerialSupported(): boolean {
  return !!serial();
}

export class SerialPrintError extends Error {}

export async function printViaSerial(bytes: Uint8Array, { baudRate = 9600 } = {}) {
  const api = serial();
  if (!api) throw new SerialPrintError("Browser ini tidak mendukung Web Serial. Pakai Chrome atau Edge di komputer.");

  let port: SerialPortLike;
  try {
    // Port yang pernah diizinkan dipakai lagi tanpa bertanya; selain itu browser menampilkan pilihan port.
    port = (await api.getPorts())[0] ?? (await api.requestPort());
  } catch {
    throw new SerialPrintError("Tidak ada printer yang dipilih.");
  }

  try {
    await port.open({ baudRate });
  } catch {
    throw new SerialPrintError("Printer tidak bisa dibuka. Pastikan tersambung dan tidak sedang dipakai aplikasi lain.");
  }
  try {
    const writer = port.writable!.getWriter();
    try {
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  } finally {
    await port.close();
  }
}
