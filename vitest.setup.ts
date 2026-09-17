import { vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));
