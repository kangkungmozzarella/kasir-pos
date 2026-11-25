import { redirect } from "next/navigation";

// proxy.ts sudah mengarahkan "/" ke beranda sesuai role. Ini cadangan bila proxy dilewati.
export default function Home() {
  redirect("/login");
}
