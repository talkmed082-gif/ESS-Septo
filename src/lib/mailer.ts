import "server-only";
import nodemailer from "nodemailer";

// SMTP 설정(환경 변수)이 다 있을 때만 메일을 보낸다 — Gmail이면 SMTP_HOST=smtp.gmail.com,
// SMTP_PORT=465, SMTP_USER=계정, SMTP_PASS=앱 비밀번호. 없으면 false를 돌려준다.
export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail({ to, subject, text }: { to: string; subject: string; text: string }): Promise<boolean> {
  if (!isMailConfigured()) return false;
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
    return true;
  } catch (e) {
    // 메일 서버 오류 원문(계정 정보가 섞일 수 있음) 대신 종류만 남긴다.
    console.error("[mail] send failed", e instanceof Error ? e.name : "unknown");
    return false;
  }
}
