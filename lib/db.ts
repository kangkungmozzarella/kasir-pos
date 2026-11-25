import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL belum diatur. Salin .env.example ke .env lalu isi nilainya.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Satu instance per proses. Di dev, hot reload membuat modul ini dievaluasi ulang,
// jadi instance disimpan di globalThis agar pool koneksi tidak terus bertambah.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
