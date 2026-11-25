/** Bentuk hasil server action yang dipakai form (useActionState). Aman diimpor dari klien. */
export type ActionState = {
  ok?: boolean;
  /** Pesan sukses untuk toast. */
  message?: string;
  /** Pesan error umum di atas form. */
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Nilai yang dikirim, supaya form tidak kosong lagi saat validasi gagal. */
  values?: Record<string, string | undefined>;
  /** Berubah setiap submit, supaya efek di klien (toast, reset) terpicu walau pesannya sama. */
  at?: number;
};

export const initialActionState: ActionState = {};
