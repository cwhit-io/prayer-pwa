import { query } from "@/lib/postgres";

export type PrayerFriendSlot = {
  slot: number;
  name: string;
};

/** Always returns four slots (1–4), empty names if unset. */
export async function getPrayerFriendSlots(userId: string): Promise<PrayerFriendSlot[]> {
  const result = await query<{ slot: number; name: string }>(
    `select slot, name
     from prayer_friend_slots
     where user_id = $1
     order by slot asc`,
    [userId]
  );

  const bySlot = new Map(result.rows.map((row) => [Number(row.slot), row.name]));
  return [1, 2, 3, 4].map((slot) => ({
    slot,
    name: bySlot.get(slot)?.trim() ?? ""
  }));
}

export async function savePrayerFriendSlots(userId: string, names: string[]) {
  const slots = [1, 2, 3, 4].map((slot, index) => ({
    slot,
    name: (names[index] ?? "").trim().slice(0, 80)
  }));

  for (const item of slots) {
    if (!item.name) {
      await query(`delete from prayer_friend_slots where user_id = $1 and slot = $2`, [
        userId,
        item.slot
      ]);
      continue;
    }

    await query(
      `insert into prayer_friend_slots (user_id, slot, name, updated_at)
       values ($1, $2, $3, now())
       on conflict (user_id, slot)
       do update set name = excluded.name, updated_at = now()`,
      [userId, item.slot, item.name]
    );
  }
}
