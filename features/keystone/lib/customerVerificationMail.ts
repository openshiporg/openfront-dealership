import { createTransport } from 'nodemailer'
import { emailButton, emailLayout, emailMuted, emailParagraph } from "./email-layout"

// Same SMTP settings as the password reset mail (./mail.ts); no new configuration.
function transport() {
  return createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || undefined,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })
}

export function storefrontBaseUrl() {
  return process.env.SMTP_STORE_LINK || ''
}

export async function sendCustomerEmailVerification(to: string, url: string) {
  await transport().sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: 'Confirm your email to link your requests',
    html: emailLayout({
      preheader: 'Confirm this email address.',
      title: 'Confirm your email',
      body: `${emailParagraph('Confirm this email address to link requests made with it to your account.')}
${emailButton('Confirm email', url)}
${emailMuted('If you did not request this email you can safely ignore it.')}`,
    }),
  })
}
