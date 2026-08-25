import fs from "node:fs";

export function getNotificationSchedulerSecret() {
  const credentialPath = process.env.CREDENTIALS_DIRECTORY
    ? `${process.env.CREDENTIALS_DIRECTORY}/notification-scheduler-secret`
    : null;
  return (
    process.env.NOTIFICATION_SCHEDULER_SECRET ||
    (credentialPath && fs.existsSync(credentialPath)
      ? fs.readFileSync(credentialPath, "utf8").trim()
      : null)
  );
}
