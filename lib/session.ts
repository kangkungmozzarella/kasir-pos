import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./session-config";

export async function getSession() {
  // iron-session membandingkan masa berlaku cookie dengan jam saat ini (Date.now()).
  // Dengan Cache Components, itu harus terjadi saat request, bukan saat prerender.
  await connection();
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}
