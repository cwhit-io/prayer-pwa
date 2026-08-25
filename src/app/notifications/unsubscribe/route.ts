import { ensureNotificationPreferencesSchema } from "@/lib/notification-preferences";
import { verifyPledgeInvitationUnsubscribeToken } from "@/lib/notification-unsubscribe";
import { query } from "@/lib/postgres";

export const dynamic = "force-dynamic";

function responsePage(message: string, status = 200, token?: string) {
  return new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email preferences</title><body style="margin:0;background:#0a0a0a;color:#fff;font-family:Arial,sans-serif"><main style="max-width:560px;margin:10vh auto;padding:32px"><img src="https://fortwayneprays.org/header-logo@web.png" width="260" alt="Pray Like Crazy" style="display:block;max-width:100%;height:auto"><h1 style="margin-top:36px;text-transform:uppercase">Email preferences</h1><p style="color:#ccc;line-height:1.6">${message}</p>${token ? `<form method="post"><input type="hidden" name="token" value="${token}"><button type="submit" style="border:0;background:#ffd300;color:#000;padding:13px 20px;font-weight:bold;text-transform:uppercase;cursor:pointer">Stop pledge invitation emails</button></form>` : `<a href="https://fortwayneprays.org" style="color:#ffd300;font-weight:bold">Return to Fort Wayne Prays</a>`}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const userId = verifyPledgeInvitationUnsubscribeToken(token);
  if (!userId) return responsePage("This unsubscribe link is invalid or no longer active.", 400);

  // Confirmation prevents automated email link scanners from changing preferences.
  return responsePage("Confirm that you want to stop pledge invitation emails.", 200, token);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = typeof formData.get("token") === "string" ? String(formData.get("token")) : "";
  const userId = verifyPledgeInvitationUnsubscribeToken(token);
  if (!userId) return responsePage("This unsubscribe link is invalid or no longer active.", 400);

  await ensureNotificationPreferencesSchema();
  await query(
    `insert into user_notification_preferences (
       user_id, email_prayer_request_updates, email_pledge_invitations, email_progress_updates
     ) values ($1, false, false, false)
     on conflict (user_id) do update
     set email_pledge_invitations = false, updated_at = now()`,
    [userId]
  );
  return responsePage("Pledge invitation emails have been turned off. Login codes and preferences you selected separately are unchanged.");
}
