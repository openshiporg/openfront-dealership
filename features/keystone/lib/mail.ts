'use server' 

import { createTransport, getTestMessageUrl } from "nodemailer";
import type { PasswordResetPath } from './passwordResetPath';
import { emailButton, emailLayout, emailMuted, emailPanel, emailParagraph } from "./email-layout";

// Utility function to get base URL for emails
function getBaseUrlForEmails(): string {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }

  // Fallback warning - this should be set in production
  console.warn('SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.');
  return '';
}

const transport = createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || undefined,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

function passwordResetEmail({ url }: { url: string }): string {
  return emailLayout({
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`,
  });
}

export async function sendPasswordResetEmail(resetToken: string, to: string, baseUrl?: string, resetPath: PasswordResetPath = '/account/reset'): Promise<void> {
  // Use provided baseUrl or fall back to utility function
  const frontendUrl = baseUrl || getBaseUrlForEmails();

  // email the user a token
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}${resetPath}?token=${encodeURIComponent(resetToken)}`,
    }),
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`📧 Message Sent!  Preview it at ${getTestMessageUrl(info as any)}`);
  }
}

/** Receipt for a test-drive or service request: the dealership still confirms the time. */
export async function sendRequestReceiptEmail(
  to: string,
  details: { dealershipName: string; kind: 'test_drive' | 'service'; what: string; whenLabel: string; requestNumber: string; customerName: string; url: string },
): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return { sent: false, error: 'not_configured' }
  const escape = (value: string) => value.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string)
  const noun = details.kind === 'test_drive' ? 'test drive' : 'service appointment'
  try {
    const info = await transport.sendMail({
      to,
      from: process.env.SMTP_FROM,
      subject: `${details.dealershipName}: we received your ${noun} request`,
      html: emailLayout({
        storeName: details.dealershipName,
        preheader: `We received your ${noun} request.`,
        title: `We received your ${noun} request`,
        body: `${emailParagraph(`Hi ${escape(details.customerName)}, ${escape(details.dealershipName)} received your ${noun} request. We will contact you to confirm the time.`)}
${emailPanel(`<strong>${escape(details.what)}</strong><br>Requested time: ${escape(details.whenLabel)}<br>Request number: ${escape(details.requestNumber)}`)}
${details.url ? emailButton(`Visit ${details.dealershipName}`, details.url) : ''}`,
      }),
    });
    return { sent: true, messageId: [String((info as any)?.messageId || ''), String((info as any)?.response || '').slice(0,120)].filter(Boolean).join(' | ') };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'send_failed' };
  }
}

/** Deposit confirmation: names the car, the amount, that it is held, and the next step. */
export async function sendReservationConfirmationEmail(
  to: string,
  details: { dealershipName: string; customerName: string; vehicle: string; stockNumber: string; depositLabel: string; salesperson: string; phone: string; address: string; reference: string; vehicleUrl: string; accountUrl: string },
): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return { sent: false, error: 'not_configured' }
  const escape = (value: string) => value.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string)
  const who = details.salesperson ? `${escape(details.salesperson)} from our sales team` : 'Our sales team'
  const call = details.phone ? ` If you'd rather not wait, call us at ${escape(details.phone)}.` : ''
  const lines = [
    `<strong>${escape(details.vehicle)}</strong>`,
    details.stockNumber ? `Stock ${escape(details.stockNumber)}` : '',
    `Deposit paid: ${escape(details.depositLabel)} (refundable, counts toward your purchase)`,
    `Reference: ${escape(details.reference)}`,
  ].filter(Boolean).join('<br>')
  try {
    const info = await transport.sendMail({
      to,
      from: process.env.SMTP_FROM,
      subject: `${details.dealershipName}: your ${details.vehicle} is reserved`,
      html: emailLayout({
        storeName: details.dealershipName,
        preheader: `Your ${details.vehicle} is reserved.`,
        title: 'Your vehicle is reserved',
        body: `${emailParagraph(`Hi ${escape(details.customerName)}, thanks for your deposit. We've taken the ${escape(details.vehicle)} off the market for you.`)}
${emailPanel(lines)}
${emailParagraph(`<strong>What happens next:</strong> ${who} will call you shortly to confirm the details and set a time to sign and take delivery.${call}`)}
${details.address ? emailMuted(`${escape(details.dealershipName)}<br>${escape(details.address)}`) : ''}
${details.accountUrl ? emailButton('View your reservation', details.accountUrl) : ''}`,
      }),
    });
    return { sent: true, messageId: [String((info as any)?.messageId || ''), String((info as any)?.response || '').slice(0,120)].filter(Boolean).join(' | ') };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'send_failed' };
  }
}
