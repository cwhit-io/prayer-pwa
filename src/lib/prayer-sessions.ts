import { enqueuePrayerSessionWriteback } from "@/lib/planning-center-writeback";
import { query } from "@/lib/postgres";

export async function createPrayerSession(input: {
  /** null = guest minutes that still count toward the church campaign total */
  userId: string | null;
  promptId: string | null;
  minutes: number;
  startedAt: Date;
  endedAt: Date;
  entryType: "timer" | "manual";
  notes: string | null;
}) {
  const result = await query<{ id: string }>(
    `insert into prayer_sessions (
       user_id,
       prompt_id,
       minutes,
       started_at,
       ended_at,
       entry_type,
       notes
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      input.userId,
      input.promptId,
      input.minutes,
      input.startedAt,
      input.endedAt,
      input.entryType,
      input.notes
    ]
  );

  const session = result.rows[0];

  // Phase 4.5 writeback queue — no-op until field map rows are enabled with PCO field IDs.
  if (input.userId && session?.id) {
    try {
      await enqueuePrayerSessionWriteback({
        userId: input.userId,
        minutes: input.minutes,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        sessionId: session.id
      });
    } catch {
      // Never block prayer logging on writeback queue failures.
    }
  }

  return session;
}
