"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ReceiptWidth } from "./receipt";

const KEY = "kasir.receiptWidth";
const EVENT = "kasir:receipt-width";

function read(): ReceiptWidth {
  try {
    return localStorage.getItem(KEY) === "80" ? "80" : "58";
  } catch {
    return "58"; // localStorage bisa diblokir (mode privat); pakai default
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Lebar kertas struk, disimpan per perangkat (setiap kasir bisa punya printer berbeda). */
export function useReceiptWidth() {
  const width = useSyncExternalStore(subscribe, read, () => "58" as const);
  const setWidth = useCallback((w: ReceiptWidth) => {
    try {
      localStorage.setItem(KEY, w);
    } catch {
      // abaikan; pilihan tetap berlaku sampai halaman dimuat ulang
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [width, setWidth] as const;
}
