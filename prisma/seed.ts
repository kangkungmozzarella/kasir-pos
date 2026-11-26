/**
 * Data contoh untuk demo. Jalankan: pnpm db:seed (aman diulang: data lama dihapus dulu).
 * Isinya ada di lib/demo-seed.ts supaya bisa dipakai juga oleh reset demo terjadwal.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { seedDemo } from "../lib/demo-seed";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

seedDemo(db)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
