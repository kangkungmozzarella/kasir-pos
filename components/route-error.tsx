"use client";

import { Button } from "@/components/ui/button";

export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <div role="alert" className="max-w-lg rounded-xl border bg-card p-6">
      <h1 className="text-lg font-semibold">Halaman ini gagal dimuat</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Biasanya karena koneksi ke database terputus sebentar. Coba muat ulang; bila tetap gagal, laporkan ke admin
        {digest ? (
          <>
            {" "}
            dengan kode <code className="font-mono">{digest}</code>
          </>
        ) : null}
        .
      </p>
      <Button className="mt-4" onClick={() => retry()}>
        Muat ulang
      </Button>
    </div>
  );
}
