import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/fresh-session", () => ({
  loadFreshSessionUser: vi.fn(),
}));

describe("errorResponse", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("maps HttpError status", async () => {
    const { errorResponse, HttpError } = await import("@/lib/http");
    const res = errorResponse(new HttpError(403, "Forbidden"));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("maps ZodError to 400", async () => {
    const { errorResponse } = await import("@/lib/http");
    const err = new ZodError([
      {
        code: "custom",
        path: ["updatedAt"],
        message: "updatedAt is required",
      },
    ]);
    const res = errorResponse(err);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "updatedAt is required" });
  });
});
