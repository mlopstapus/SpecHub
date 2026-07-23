import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signSessionJwt, verifySessionJwt } from "./jwt";

describe("signSessionJwt / verifySessionJwt", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "a-real-signing-secret-for-tests");
    vi.stubEnv("JWT_EXPIRY_HOURS", "24");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("verifies a token it signed itself, returning sub/role", async () => {
    const sub = randomUUID();
    const token = await signSessionJwt({ sub, role: "admin" });

    const claims = await verifySessionJwt(token);

    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe(sub);
    expect(claims?.role).toBe("admin");
  });

  it("rejects an expired token", async () => {
    vi.stubEnv("JWT_EXPIRY_HOURS", "1");
    vi.useFakeTimers();
    try {
      const token = await signSessionJwt({ sub: randomUUID(), role: "member" });
      vi.advanceTimersByTime(2 * 60 * 60 * 1000); // 2 hours, past the 1-hour expiry

      const claims = await verifySessionJwt(token);

      expect(claims).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a tampered/wrong-signature token", async () => {
    const token = await signSessionJwt({ sub: randomUUID(), role: "member" });
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "b" : "a");

    const claims = await verifySessionJwt(tampered);

    expect(claims).toBeNull();
  });

  it("rejects a garbage string", async () => {
    expect(await verifySessionJwt("not-a-jwt")).toBeNull();
  });

  it("throws when JWT_SECRET is missing before attempting to sign", async () => {
    vi.stubEnv("JWT_SECRET", "");

    await expect(
      signSessionJwt({ sub: randomUUID(), role: "member" }),
    ).rejects.toThrow(/missing/i);
  });

  it("throws when JWT_SECRET is the documented placeholder before attempting to sign", async () => {
    vi.stubEnv("JWT_SECRET", "REPLACE_ME_JWT_SECRET");

    await expect(
      signSessionJwt({ sub: randomUUID(), role: "member" }),
    ).rejects.toThrow(/placeholder/i);
  });

  it("throws when JWT_SECRET is missing before attempting to verify", async () => {
    const token = await signSessionJwt({ sub: randomUUID(), role: "member" });
    vi.stubEnv("JWT_SECRET", "");

    await expect(verifySessionJwt(token)).rejects.toThrow(/missing/i);
  });
});
