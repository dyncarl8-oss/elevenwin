import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWithdrawalNotification(params: {
  userId: string;
  username: string;
  amount: number;
  userEmail?: string;
}) {
  const { userId, username, amount, userEmail } = params;
  const amountFormatted = `$${(amount / 100).toFixed(2)}`;
  const notificationEmail = process.env.NOTIFICATION_EMAIL;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!notificationEmail) {
    console.error("[Email] NOTIFICATION_EMAIL not configured");
    return { success: false, error: "Notification email not configured" };
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: notificationEmail,
      subject: `Withdrawal Request - ${username} - ${amountFormatted}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
            New Withdrawal Request
          </h1>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #374151;">Request Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 120px;">Username:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #111827;">${username}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">User ID:</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 12px; color: #111827;">${userId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
                <td style="padding: 8px 0; font-weight: bold; font-size: 18px; color: #059669;">${amountFormatted}</td>
              </tr>
              ${userEmail ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">User Email:</td>
                <td style="padding: 8px 0; color: #111827;">${userEmail}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Requested At:</td>
                <td style="padding: 8px 0; color: #111827;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;">
              <strong>Action Required:</strong> Please process this withdrawal request manually through your Whop dashboard.
            </p>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
            This is an automated notification from Arena Wager.
          </p>
        </div>
      `,
    });

    console.log(`[Email] Withdrawal notification sent for ${username} - ${amountFormatted}`);
    return { success: true, data: result };
  } catch (error) {
    console.error("[Email] Failed to send withdrawal notification:", error);
    return { success: false, error: String(error) };
  }
}
