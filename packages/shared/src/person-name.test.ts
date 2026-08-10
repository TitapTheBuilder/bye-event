import { describe, expect, it } from "vitest";
import { formatPersonName, getPersonInitials } from "./person-name";

describe("person name helpers", () => {
  it("formats available name parts without extra whitespace", () => {
    expect(formatPersonName(" Ada ", " Lovelace ")).toBe("Ada Lovelace");
    expect(formatPersonName(null, "Lovelace")).toBe("Lovelace");
    expect(formatPersonName(null, null)).toBe("");
  });

  it("builds initials from separate name fields", () => {
    expect(getPersonInitials("Ada", "Lovelace")).toBe("AL");
    expect(getPersonInitials("علی", "رضایی")).toBe("عر");
  });
});
