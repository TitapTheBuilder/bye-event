import { db, getUpload } from "@repo/db";
import { readUploadedFile, resolveUploadPath } from "@/lib/uploads";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@repo/db", () => ({ db: {}, getUpload: vi.fn() }));
vi.mock("@/lib/uploads", () => ({
  readUploadedFile: vi.fn(),
  resolveUploadPath: vi.fn(),
}));

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe("GET /uploads/[...path]", () => {
  beforeEach(() => {
    vi.mocked(getUpload).mockReset();
    vi.mocked(readUploadedFile).mockReset();
    vi.mocked(resolveUploadPath).mockReset();
    vi.mocked(resolveUploadPath).mockReturnValue("C:\\uploads\\logos\\logo.png");
    vi.mocked(getUpload).mockResolvedValue(undefined);
  });

  it("serves raster files with a derived content type and safe headers", async () => {
    vi.mocked(readUploadedFile).mockResolvedValue(Buffer.from("canonical-png"));

    const response = await GET(
      new Request("https://admin.example/uploads/logos/logo.png"),
      context(["logos", "logo.png"]),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(getUpload).toHaveBeenCalledWith(db, "logos/logo.png");
  });

  it("does not serve SVG paths", async () => {
    vi.mocked(resolveUploadPath).mockReturnValue("C:\\uploads\\logos\\logo.svg");

    const response = await GET(
      new Request("https://admin.example/uploads/logos/logo.svg"),
      context(["logos", "logo.svg"]),
    );

    expect(response.status).toBe(404);
    expect(getUpload).not.toHaveBeenCalled();
    expect(readUploadedFile).not.toHaveBeenCalled();
  });
});
