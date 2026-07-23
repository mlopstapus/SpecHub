import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/shared/config";
import { logger } from "@/shared/logging";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends an email via the generic self-host SMTP fallback
 * (`context/third-party-services.md`) when configured; otherwise logs the
 * full message and resolves without sending (FR-005) — this *is* the
 * self-host log-fallback behavior, not a stub. A configured send that fails
 * (bad credentials, unreachable host, etc.) rejects rather than being
 * swallowed here — callers that need best-effort semantics (e.g.
 * `inviteUser`) catch around this call themselves (research.md §4).
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    logger.info(message, "Email delivery skipped: no SMTP provider configured");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transporter.sendMail({
    from: smtp.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
