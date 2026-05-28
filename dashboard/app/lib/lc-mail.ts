/**
 * Outbound email helper. Uses Resend if RESEND_API_KEY is configured,
 * otherwise falls back to console.log + returning the link so the dev /
 * dashboard can show it inline. Lets Phase 0a ship before the email
 * sending pipeline is fully set up.
 */

import { Resend } from "resend";

const FROM_ADDRESS = "LemonCake <noreply@lemoncake.xyz>";

export async function sendMagicLink(email: string, link: string): Promise<{ sent: boolean; previewUrl?: string }> {
  if (!process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[lc-mail] RESEND_API_KEY not set — magic link for ${email}: ${link}`);
    return { sent: false, previewUrl: link };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: "Your LemonCake login link",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a0f00;">
          <h2 style="margin: 0 0 12px; font-size: 20px;">Sign in to LemonCake</h2>
          <p style="margin: 0 0 20px; font-size: 14px; color: #555;">
            Click the button below to sign in and claim your workspace.
            This link expires in 15 minutes.
          </p>
          <p style="margin: 0 0 24px;">
            <a href="${link}" style="display: inline-block; background: #fffd43; color: #1a0f00; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">
              Sign in to LemonCake →
            </a>
          </p>
          <p style="margin: 0; font-size: 12px; color: #999;">
            If you didn't request this, ignore the email — nothing happens until you click the link.
          </p>
        </div>
      `,
      text: `Sign in to LemonCake: ${link}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`,
    });
    return { sent: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[lc-mail] Resend send failed:", err);
    return { sent: false, previewUrl: link };
  }
}
