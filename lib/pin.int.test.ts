import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { switchByPin, switchCandidates } from "./pin";

let kasir1: CurrentUser;
let kasir2: CurrentUser;
let kasirLain: CurrentUser;
let owner: CurrentUser;

const asUser = (u: { id: string; name: string; email: string; role: CurrentUser["role"]; branchId: string | null }): CurrentUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  branchId: u.branchId,
  branch: null,
});
const byEmail = (email: string) => db.user.findUniqueOrThrow({ where: { email } }).then(asUser);
const unlock = (id: string) => db.user.update({ where: { id }, data: { pinFailedCount: 0, pinLockedUntil: null } });

beforeAll(async () => {
  [kasir1, kasir2, kasirLain, owner] = await Promise.all([
    byEmail("kasir1.mdn01@demo.test"),
    byEmail("kasir2.mdn01@demo.test"),
    byEmail("kasir1.mdn02@demo.test"),
    byEmail("pemilik@demo.test"),
  ]);
});

afterAll(async () => {
  await unlock(kasir2.id);
  await db.$disconnect();
});

describe("ganti kasir dengan PIN", () => {
  it("kandidat: cabang yang sama, punya PIN, bukan diri sendiri", async () => {
    const list = await switchCandidates(kasir1);
    expect(list.map((c) => c.id)).toContain(kasir2.id);
    expect(list.map((c) => c.id)).not.toContain(kasir1.id);
    expect(list.map((c) => c.id)).not.toContain(kasirLain.id);
    expect(await switchCandidates(owner)).toEqual([]); // pemilik tidak terikat cabang
  });

  it("PIN benar berhasil; akun cabang lain dan PIN bukan angka ditolak", async () => {
    expect(await switchByPin(kasir1, kasir2.id, "2222")).toMatchObject({ ok: true, user: { id: kasir2.id } });
    expect(await switchByPin(kasir1, kasirLain.id, "1111")).toEqual({ ok: false, error: "Akun ini tidak bisa dipakai di perangkat ini." });
    expect(await switchByPin(kasir1, kasir2.id, "12ab")).toEqual({ ok: false, error: "PIN berupa 4 sampai 6 angka." });
  });

  it("lima kali salah mengunci 5 menit; PIN benar pun ditolak selama terkunci; berhasil mereset hitungan", async () => {
    await unlock(kasir2.id);
    for (const left of [4, 3, 2, 1]) {
      expect(await switchByPin(kasir1, kasir2.id, "0000")).toEqual({ ok: false, error: `PIN salah. Sisa ${left} percobaan sebelum dikunci 5 menit.` });
    }
    expect((await switchByPin(kasir1, kasir2.id, "0000")) as { error: string }).toMatchObject({ error: expect.stringContaining("dikunci 5 menit") });
    expect((await switchByPin(kasir1, kasir2.id, "2222")) as { error: string }).toMatchObject({ ok: false, error: expect.stringContaining("Coba lagi dalam 5 menit") });
    expect((await switchCandidates(kasir1)).find((c) => c.id === kasir2.id)?.locked).toBe(true);

    // Kunci lewat: PIN benar diterima dan hitungan kembali nol.
    await db.user.update({ where: { id: kasir2.id }, data: { pinLockedUntil: new Date(Date.now() - 1000) } });
    await switchByPin(kasir1, kasir2.id, "0000");
    expect((await switchByPin(kasir1, kasir2.id, "2222")).ok).toBe(true);
    expect(await db.user.findUniqueOrThrow({ where: { id: kasir2.id }, select: { pinFailedCount: true, pinLockedUntil: true } })).toEqual({
      pinFailedCount: 0,
      pinLockedUntil: null,
    });
  });

  it("10 tebakan salah serentak: hanya 5 yang benar-benar dicoba, sisanya ditolak karena terkunci", async () => {
    await unlock(kasir2.id);
    const guesses = Array.from({ length: 10 }, (_, i) => String(1000 + i));
    const results = await Promise.all(guesses.map((g) => switchByPin(kasir1, kasir2.id, g)));
    const errors = results.map((r) => (r.ok ? "OK" : r.error));
    expect(errors.filter((e) => e.startsWith("PIN salah"))).toHaveLength(5);
    expect(errors.filter((e) => e.includes("Coba lagi dalam"))).toHaveLength(5);
  });
});
