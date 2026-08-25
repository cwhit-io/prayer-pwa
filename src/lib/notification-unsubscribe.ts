import crypto from "node:crypto";
import { getNotificationSchedulerSecret } from "@/lib/notification-scheduler-auth";

const PLEDGE_INVITATION_SCOPE = "pledge-invitations";

export function createPledgeInvitationUnsubscribeToken(userId: string) {
  const secret = getNotificationSchedulerSecret();
  if (!secret) throw new Error("Notification signing secret is not configured.");
  const payload = `${userId}:${PLEDGE_INVITATION_SCOPE}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifyPledgeInvitationUnsubscribeToken(token: string) {
  const secret = getNotificationSchedulerSecret();
  if (!secret) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const [userId, scope, supplied] = decoded.split(":");
  if (!userId || scope !== PLEDGE_INVITATION_SCOPE || !supplied) return null;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${scope}`)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) return null;
  return userId;
}
