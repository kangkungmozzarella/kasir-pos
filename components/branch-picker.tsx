import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelectOption } from "@/components/ui/native-select";

/** Pilihan cabang untuk Pemilik (form GET). Admin tidak melihat ini karena cabangnya tetap. */
export function BranchPicker({
  branches,
  value,
  action,
  keep = {},
}: {
  branches: { id: string; name: string }[];
  value: string;
  action: string;
  keep?: Record<string, string>;
}) {
  return (
    <form method="get" action={action} className="flex items-center gap-2">
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="branch" className="text-sm font-medium">
        Cabang
      </label>
      <AutoSubmitSelect id="branch" name="branch" defaultValue={value} className="w-56">
        {branches.map((b) => (
          <NativeSelectOption key={b.id} value={b.id}>
            {b.name}
          </NativeSelectOption>
        ))}
      </AutoSubmitSelect>
      <noscript>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Tampilkan
        </button>
      </noscript>
    </form>
  );
}
