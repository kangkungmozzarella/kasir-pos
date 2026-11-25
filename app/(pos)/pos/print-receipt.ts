/**
 * Cetak struk tanpa meninggalkan layar kasir: muat halaman struk ke iframe
 * tersembunyi, lalu halaman itu sendiri memanggil window.print() setelah tampil.
 */
export function printReceipt(saleId: string) {
  document.getElementById("receipt-print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "receipt-print-frame";
  frame.title = "Struk untuk dicetak";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  frame.src = `/receipt/${saleId}?embed=1`;
  document.body.appendChild(frame);
}
