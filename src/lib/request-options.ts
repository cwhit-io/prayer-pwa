/** Shared request form options (safe for client + server). */

export const requestCategories = [
  "Personal",
  "Family",
  "Church",
  "Health",
  "Work",
  "School",
  "Missions",
  "Community",
  "Thanksgiving",
  "Other"
] as const;

export const requestVisibilities = [
  { value: "church_anonymous", label: "Community board" },
  { value: "prayer_team", label: "Private prayer" }
] as const;
