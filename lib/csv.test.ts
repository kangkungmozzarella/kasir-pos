import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "./csv";

describe("csv", () => {
  it("angka apa adanya, teks biasa tanpa kutip", () => {
    expect(csvRow(["MDN01-20261125-0001", 42180, null])).toBe("MDN01-20261125-0001;42180;\r\n");
  });

  it("pemisah, kutip, dan baris baru dibungkus kutip ganda", () => {
    expect(csvCell("Salah; input")).toBe('"Salah; input"');
    expect(csvCell('Kata "pembeli"')).toBe('"Kata ""pembeli"""');
    expect(csvCell("baris\nbaru")).toBe('"baris\nbaru"');
  });

  it("teks yang bisa dibaca sebagai rumus dinetralkan", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+62812")).toBe("'+62812");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@user")).toBe("'@user");
  });
});
