import { describe, expect, it } from "vitest";
import { createLogger, logger } from "./index";

describe("createLogger", () => {
  it("defaults to info level when LOG_LEVEL is unset", () => {
    expect(createLogger({}).level).toBe("info");
  });

  it("respects a configured LOG_LEVEL", () => {
    expect(createLogger({ LOG_LEVEL: "debug" }).level).toBe("debug");
  });
});

describe("logger", () => {
  it("exposes the standard pino-style logging methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});
