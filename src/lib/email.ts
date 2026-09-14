/** SMTP (Mailpit locally). From-address: SMTP_FROM. */
import nodemailer from "nodemailer";

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transport().sendMail({
      from: process.env.SMTP_FROM || "Beacon <noreply@beacon.local>",
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email send failed", error);
    return false;
  }
}
