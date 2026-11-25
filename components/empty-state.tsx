/** State kosong: selalu jelaskan kenapa kosong dan apa langkah berikutnya. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function LoadingText({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="py-8 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
