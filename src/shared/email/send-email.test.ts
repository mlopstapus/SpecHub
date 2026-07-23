import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/shared/logging";
import { sendEmail } from "./send-email";

const sendMailMock = vi.fn();
const createTransportMock = vi.fn((_options: unknown) => ({ sendMail: sendMailMock }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (options: unknown) => createTransportMock(options),
  },
}));

describe("sendEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sendMailMock.mockReset();
    createTransportMock.mockClear();
  });

  it("logs and resolves without sending when SMTP is not configured", async () => {
    vi.stubEnv("SMTP_HOST", "");
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

    await expect(
      sendEmail({ to: "new.hire@example.com", subject: "You're invited", text: "link" }),
    ).resolves.toBeUndefined();

    expect(createTransportMock).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new.hire@example.com",
        subject: "You're invited",
        text: "link",
      }),
      expect.stringMatching(/skipped/i),
    );
    infoSpy.mockRestore();
  });

  it("sends via nodemailer SMTP transport when configured", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "2525");
    vi.stubEnv("SMTP_USER", "user");
    vi.stubEnv("SMTP_PASS", "pass");
    vi.stubEnv("SMTP_FROM", "SkillCanon <no-reply@example.com>");
    sendMailMock.mockResolvedValueOnce({ messageId: "abc" });

    await sendEmail({ to: "new.hire@example.com", subject: "You're invited", text: "link" });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 2525,
        auth: { user: "user", pass: "pass" },
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "SkillCanon <no-reply@example.com>",
      to: "new.hire@example.com",
      subject: "You're invited",
      text: "link",
    });
  });

  it("propagates a send failure rather than swallowing it", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    sendMailMock.mockRejectedValueOnce(new Error("connection refused"));

    await expect(
      sendEmail({ to: "new.hire@example.com", subject: "subj", text: "body" }),
    ).rejects.toThrow("connection refused");
  });
});
