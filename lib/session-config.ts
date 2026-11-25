import type { SessionOptions } from "iron-session";
import type { Role } from "./roles";

export type SessionData = {
  userId: string;
  role: Role;
  branchId: string | null;
};

export const SESSION_COOKIE = "kasir_session";
const TWELVE_HOURS = 60 * 60 * 12;

export function sessionOptions(): SessionOptions {
  const password = process.env.AUTH_SECRET;
  if (!password || password.length < 32) {
    throw new Error("AUTH_SECRET belum diatur atau kurang dari 32 karakter.");
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    ttl: TWELVE_HOURS, // kira-kira satu hari kerja dua shift
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}
