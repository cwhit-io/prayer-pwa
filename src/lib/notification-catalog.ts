/**
 * Built-in notification catalog — seed source for admin management.
 * Frequency options and merge tags are documented per type.
 */

export type NotificationFrequency =
  | "on_event"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "manual";

export type NotificationAudience =
  | "members"
  | "admins"
  | "prayer_team"
  | "all_users"
  | "system";

export type NotificationDefinitionSeed = {
  key: string;
  label: string;
  description: string;
  category: "member" | "leader" | "system" | "campaign";
  supportsEmail: boolean;
  supportsSms: boolean;
  defaultFrequency: NotificationFrequency;
  defaultAudience: NotificationAudience;
  /** System types stay on for login/auth; admin can still edit templates. */
  isSystem: boolean;
  sortOrder: number;
  defaultEnabled: boolean;
  defaultEmailEnabled: boolean;
  defaultSmsEnabled: boolean;
  mergeTags: string[];
  defaultSubject: string;
  defaultEmailText: string;
  defaultEmailHtml: string;
  defaultSmsBody: string;
};

export const NOTIFICATION_FREQUENCIES: Array<{
  value: NotificationFrequency;
  label: string;
  hint: string;
}> = [
  { value: "on_event", label: "When it happens", hint: "Triggered by app events" },
  { value: "daily", label: "Daily", hint: "Once per day at the send hour" },
  { value: "weekly", label: "Weekly", hint: "Once per week on the chosen day" },
  { value: "biweekly", label: "Every 2 weeks", hint: "Every other week" },
  { value: "monthly", label: "Monthly", hint: "Once per month" },
  { value: "manual", label: "Manual only", hint: "Admin blast / test only" }
];

export const NOTIFICATION_AUDIENCES: Array<{ value: NotificationAudience; label: string }> = [
  { value: "members", label: "Members" },
  { value: "admins", label: "Admins" },
  { value: "prayer_team", label: "Prayer team" },
  { value: "all_users", label: "All signed-in users" },
  { value: "system", label: "System (auth flows)" }
];

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" }
];

export const NOTIFICATION_CATALOG: NotificationDefinitionSeed[] = [
  {
    key: "login_code",
    label: "Login authorization code",
    description: "Six-digit code sent when someone signs in with email or phone.",
    category: "system",
    supportsEmail: true,
    supportsSms: true,
    defaultFrequency: "on_event",
    defaultAudience: "system",
    isSystem: true,
    sortOrder: 10,
    defaultEnabled: true,
    defaultEmailEnabled: true,
    defaultSmsEnabled: true,
    mergeTags: ["{{code}}", "{{minutes}}", "{{contact}}"],
    defaultSubject: "Your Pray Like Crazy login code",
    defaultEmailText:
      "Your Pray Like Crazy login code is {{code}}. It expires in {{minutes}} minutes.",
    defaultEmailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff">
  <p style="color:#ffd300;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px">Pray Like Crazy</p>
  <h1 style="font-size:28px;text-transform:uppercase;margin:12px 0">Your login code</h1>
  <p style="font-size:32px;font-weight:900;letter-spacing:.2em;color:#ffd300">{{code}}</p>
  <p style="color:#bbb">Expires in {{minutes}} minutes. If you did not request this, you can ignore this message.</p>
</div>`,
    defaultSmsBody: "Pray Like Crazy code: {{code}} (expires in {{minutes}} min)"
  },
  {
    key: "pledge_reminder",
    label: "Pledge reminder",
    description: "Gentle nudge for people with a pledge who may be behind on minutes.",
    category: "member",
    supportsEmail: true,
    supportsSms: true,
    defaultFrequency: "weekly",
    defaultAudience: "members",
    isSystem: false,
    sortOrder: 20,
    defaultEnabled: false,
    defaultEmailEnabled: true,
    defaultSmsEnabled: false,
    mergeTags: ["{{name}}", "{{pledged_minutes}}", "{{prayed_minutes}}", "{{app_url}}"],
    defaultSubject: "A quiet invitation to pray this week",
    defaultEmailText:
      "Hi {{name}},\n\nYou pledged {{pledged_minutes}} minutes. So far you have logged {{prayed_minutes}}. Open the app when you are ready: {{app_url}}\n\n— Pray Like Crazy",
    defaultEmailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff">
  <p style="color:#ffd300;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px">Pray Like Crazy</p>
  <h1 style="font-size:26px;text-transform:uppercase">Hi {{name}}</h1>
  <p style="color:#ccc;line-height:1.6">You pledged <strong style="color:#fff">{{pledged_minutes}}</strong> minutes. You have logged <strong style="color:#ffd300">{{prayed_minutes}}</strong> so far.</p>
  <p style="margin-top:24px"><a href="{{app_url}}" style="background:#ffd300;color:#000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:900;text-transform:uppercase">Open PRAY</a></p>
</div>`,
    defaultSmsBody: "Pray Like Crazy: {{name}}, {{prayed_minutes}}/{{pledged_minutes}} min logged. {{app_url}}"
  },
  {
    key: "weekly_digest",
    label: "Weekly prayer digest",
    description: "Campaign progress snapshot and a simple call to pray.",
    category: "campaign",
    supportsEmail: true,
    supportsSms: false,
    defaultFrequency: "weekly",
    defaultAudience: "members",
    isSystem: false,
    sortOrder: 30,
    defaultEnabled: false,
    defaultEmailEnabled: true,
    defaultSmsEnabled: false,
    mergeTags: ["{{name}}", "{{church_minutes}}", "{{goal_minutes}}", "{{app_url}}"],
    defaultSubject: "This week in Pray Like Crazy",
    defaultEmailText:
      "Hi {{name}},\n\nThe church has offered {{church_minutes}} of {{goal_minutes}} minutes.\nJoin in: {{app_url}}\n",
    defaultEmailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff">
  <p style="color:#ffd300;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px">Weekly digest</p>
  <h1 style="font-size:26px;text-transform:uppercase">Hi {{name}}</h1>
  <p style="color:#ccc;line-height:1.6">Together we have offered <strong style="color:#ffd300">{{church_minutes}}</strong> minutes toward <strong>{{goal_minutes}}</strong>.</p>
  <p style="margin-top:24px"><a href="{{app_url}}" style="background:#ffd300;color:#000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:900;text-transform:uppercase">Pray now</a></p>
</div>`,
    defaultSmsBody: ""
  },
  {
    key: "request_prayed_for",
    label: "Someone prayed for your request",
    description:
      "Email the requester when another person prays for their request (only if they opted in on their profile).",
    category: "member",
    supportsEmail: true,
    supportsSms: true,
    defaultFrequency: "on_event",
    defaultAudience: "members",
    isSystem: false,
    sortOrder: 40,
    defaultEnabled: true,
    defaultEmailEnabled: true,
    defaultSmsEnabled: false,
    mergeTags: ["{{name}}", "{{request_title}}", "{{prayer_count}}", "{{app_url}}"],
    defaultSubject: "Someone prayed for “{{request_title}}”",
    defaultEmailText:
      "Hi {{name}},\n\nSomeone just prayed for your request “{{request_title}}”. Total prayers: {{prayer_count}}.\n{{app_url}}\n",
    defaultEmailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff">
  <p style="color:#ffd300;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px">You are not alone</p>
  <h1 style="font-size:24px;text-transform:uppercase">Someone prayed</h1>
  <p style="color:#ccc">Hi {{name}}, someone prayed for <strong style="color:#fff">{{request_title}}</strong>.</p>
  <p style="color:#ffd300;font-weight:900">{{prayer_count}} total prayers</p>
</div>`,
    defaultSmsBody: "Pray Like Crazy: someone prayed for “{{request_title}}” ({{prayer_count}} total)."
  },
  {
    key: "new_board_request",
    label: "New community board request",
    description: "Alert prayer team / admins when a request is published to the board.",
    category: "leader",
    supportsEmail: true,
    supportsSms: true,
    defaultFrequency: "on_event",
    defaultAudience: "prayer_team",
    isSystem: false,
    sortOrder: 50,
    defaultEnabled: true,
    defaultEmailEnabled: true,
    defaultSmsEnabled: false,
    mergeTags: ["{{request_title}}", "{{category}}", "{{app_url}}"],
    defaultSubject: "New board request: {{request_title}}",
    defaultEmailText:
      "A new community prayer request was published.\n\nTitle: {{request_title}}\nCategory: {{category}}\n{{app_url}}\n",
    defaultEmailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff">
  <p style="color:#ffd300;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px">Prayer team</p>
  <h1 style="font-size:24px;text-transform:uppercase">New board request</h1>
  <p style="color:#fff;font-weight:900">{{request_title}}</p>
  <p style="color:#aaa">{{category}}</p>
  <p style="margin-top:20px"><a href="{{app_url}}" style="color:#ffd300">Open board</a></p>
</div>`,
    defaultSmsBody: "New board request: {{request_title}} — {{app_url}}"
  },
  {
    key: "campaign_announcement",
    label: "Campaign announcement",
    description: "One-off or manual campaign message. Use for milestones and special invites.",
    category: "campaign",
    supportsEmail: true,
    supportsSms: true,
    defaultFrequency: "manual",
    defaultAudience: "all_users",
    isSystem: false,
    sortOrder: 60,
    defaultEnabled: true,
    defaultEmailEnabled: true,
    defaultSmsEnabled: false,
    mergeTags: ["{{name}}", "{{headline}}", "{{body}}", "{{app_url}}"],
    defaultSubject: "{{headline}}",
    defaultEmailText: "Hi {{name}},\n\n{{body}}\n\n{{app_url}}\n",
    defaultEmailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff">
  <p style="color:#ffd300;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px">Pray Like Crazy</p>
  <h1 style="font-size:28px;text-transform:uppercase">{{headline}}</h1>
  <p style="color:#ccc;line-height:1.7">{{body}}</p>
  <p style="margin-top:24px"><a href="{{app_url}}" style="background:#ffd300;color:#000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:900;text-transform:uppercase">Open app</a></p>
</div>`,
    defaultSmsBody: "{{headline}} — {{app_url}}"
  },
  {
    key: "leader_follow_up",
    label: "Leader follow-up reminder",
    description: "Reminder for admins/prayer team about open care items (future Phase 6 hooks).",
    category: "leader",
    supportsEmail: true,
    supportsSms: false,
    defaultFrequency: "weekly",
    defaultAudience: "admins",
    isSystem: false,
    sortOrder: 70,
    defaultEnabled: false,
    defaultEmailEnabled: true,
    defaultSmsEnabled: false,
    mergeTags: ["{{name}}", "{{open_count}}", "{{app_url}}"],
    defaultSubject: "Follow-up check-in ({{open_count}} open)",
    defaultEmailText:
      "Hi {{name}},\n\nThere are {{open_count}} items that may need follow-up.\n{{app_url}}\n",
    defaultEmailHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff">
  <p style="color:#ffd300;font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px">Leaders</p>
  <h1 style="font-size:24px;text-transform:uppercase">Follow-up check-in</h1>
  <p style="color:#ccc">Hi {{name}}, <strong style="color:#ffd300">{{open_count}}</strong> items may need attention.</p>
</div>`,
    defaultSmsBody: ""
  }
];

export function getCatalogEntry(key: string) {
  return NOTIFICATION_CATALOG.find((item) => item.key === key) ?? null;
}

export function applyMergeTags(template: string, vars: Record<string, string | number | null | undefined>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => {
    const value = vars[name];
    return value == null ? "" : String(value);
  });
}
