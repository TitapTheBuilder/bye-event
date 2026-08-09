import { describe, expect, it } from "vitest";
import { isNavigationItemActive } from "./navigation";

describe("isNavigationItemActive", () => {
  it("does not activate Scan while viewing Scanned visitors", () => {
    expect(isNavigationItemActive("/scanned", "/scan")).toBe(false);
    expect(isNavigationItemActive("/scanned", "/scanned")).toBe(true);
  });

  it("matches only the same route segment and its child routes", () => {
    expect(isNavigationItemActive("/scan", "/scan")).toBe(true);
    expect(isNavigationItemActive("/scan/manual", "/scan")).toBe(true);
    expect(isNavigationItemActive("/scanner", "/scan")).toBe(false);
    expect(isNavigationItemActive("/", "/")).toBe(true);
    expect(isNavigationItemActive("/profile", "/")).toBe(false);
  });
});
