import { createTransport } from 'nodemailer'

// Same SMTP settings as the password reset mail (./mail.ts); no new configuration.
function transport() {
  return createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || undefined,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
}

export function storefrontBaseUrl() {
  return process.env.SMTP_STORE_LINK || ''
}

export async function sendCustomerEmailVerification(to: string, url: string) {
  const safeUrl = escapeHtml(url)
  await transport().sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: 'Confirm your email to link your requests',
    html: `
      <body style="background:#f9f9f9;">
        <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background:#ffffff;max-width:600px;margin:auto;border-radius:10px;">
          <tr><td align="center" style="font-size:18px;font-family:Helvetica,Arial,sans-serif;color:#444444;">Confirm this email address to link requests made with it to your account.</td></tr>
          <tr><td align="center" style="padding:20px 0;"><a href="${safeUrl}" target="_blank" style="font-size:18px;font-family:Helvetica,Arial,sans-serif;color:#ffffff;background:#346df1;text-decoration:none;border-radius:5px;padding:10px 20px;display:inline-block;font-weight:bold;">Confirm email</a></td></tr>
          <tr><td align="center" style="font-size:16px;font-family:Helvetica,Arial,sans-serif;color:#444444;">If you did not request this email you can safely ignore it.</td></tr>
        </table>
      </body>
    `,
  })
}
