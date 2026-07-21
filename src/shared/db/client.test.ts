import { describe, expect, it } from "vitest";
import { getConnectionString } from "./client";

describe("getConnectionString", () => {
  it("throws when the env var is missing", () => {
    expect(() => getConnectionString("DATABASE_URL", {})).toThrow(/missing/i);
  });

  it("throws when the env var is empty", () => {
    expect(() =>
      getConnectionString("DATABASE_URL", { DATABASE_URL: "" }),
    ).toThrow(/missing/i);
  });

  it("throws when the env var still equals the documented placeholder", () => {
    expect(() =>
      getConnectionString("DATABASE_URL", {
        DATABASE_URL:
          "postgresql://REPLACE_ME_APP_ROLE:REPLACE_ME_PASSWORD@localhost:5432/spechub",
      }),
    ).toThrow(/placeholder/i);
  });

  it("returns the value when it is a real, non-placeholder connection string", () => {
    expect(
      getConnectionString("DATABASE_URL", {
        DATABASE_URL: "postgresql://app_role:s3cret@localhost:5432/spechub",
      }),
    ).toBe("postgresql://app_role:s3cret@localhost:5432/spechub");
  });
});
