import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Siapkan database khusus test, terpisah dari data demo:
 * buat bila belum ada, terapkan migrasi (tanpa menghapus apa pun), lalu isi data seed.
 * Seed mengosongkan tabel lebih dulu, jadi hanya boleh berjalan di database test lokal.
 */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  const dbName = url.pathname.slice(1);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !dbName.endsWith("_test")) {
    throw new Error(`Integration test hanya boleh memakai database lokal berakhiran _test, bukan ${url.hostname}/${dbName}.`);
  }

  const admin = new Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: url.toString() };
  execSync("pnpm prisma migrate deploy", { env, stdio: "pipe" });
  execSync("pnpm tsx prisma/seed.ts", { env, stdio: "pipe" });
}
