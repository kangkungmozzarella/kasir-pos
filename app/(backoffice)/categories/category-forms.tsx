"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field";
import { fieldError, FormError, initial, useActionFeedback } from "@/components/form-bits";
import { initialActionState } from "@/lib/action-state";
import { createCategory, deleteCategory, renameCategory } from "./actions";

export function CreateCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useActionFeedback(state, () => formRef.current?.reset());
  const err = fieldError(state, "name");

  return (
    <form ref={formRef} action={action} className="rounded-xl border bg-card p-4">
      <label htmlFor="new-category" className="text-sm font-medium">
        Kategori baru
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id="new-category"
          name="name"
          placeholder="Nama kategori"
          defaultValue={state.ok ? "" : initial(state, "name", "")}
          aria-invalid={!!err || undefined}
          aria-describedby={err ? "new-category-error" : undefined}
          className="sm:max-w-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Tambah kategori"}
        </Button>
      </div>
      <FieldError id="new-category-error" className="mt-2">
        {err}
      </FieldError>
    </form>
  );
}

export function CategoryRow({ id, name, productCount }: { id: string; name: string; productCount: number }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [renameState, renameAction, renaming] = useActionState(renameCategory.bind(null, id), initialActionState);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string>();
  useActionFeedback(renameState, () => setEditing(false));

  // Baris ini hilang dari halaman begitu hapus berhasil, jadi toast dipanggil langsung
  // dari hasil action, bukan lewat efek komponen yang sudah tidak ada.
  function remove() {
    startDelete(async () => {
      const result = await deleteCategory(id, initialActionState);
      if (result.ok) toast.success(result.message);
      else setDeleteError(result.error);
    });
  }
  const inputId = `category-${id}`;
  const err = fieldError(renameState, "name");

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form action={renameAction} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <label htmlFor={inputId} className="sr-only">
            Nama kategori
          </label>
          <div className="flex-1 sm:max-w-sm">
            <Input
              id={inputId}
              name="name"
              defaultValue={initial(renameState, "name", name)}
              aria-invalid={!!err || undefined}
              autoFocus
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            />
            <FieldError className="mt-1">{err}</FieldError>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={renaming}>
              {renaming ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Batal
            </Button>
          </div>
        </form>
        <FormError state={renameState} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name}</p>
        {productCount > 0 ? (
          <Link
            href={`/products?category=${id}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {productCount} produk
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada produk</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setEditing(true)} aria-label={`Ganti nama kategori ${name}`}>
          Ganti nama
        </Button>
        {productCount === 0 &&
          (confirming ? (
            <div className="flex gap-2">
              <Button variant="destructive" disabled={deleting} onClick={remove} autoFocus>
                {deleting ? "Menghapus..." : `Ya, hapus ${name}`}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Batal
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)} aria-label={`Hapus kategori ${name}`}>
              Hapus
            </Button>
          ))}
      </div>
      {deleteError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {deleteError}
        </p>
      )}
    </li>
  );
}
