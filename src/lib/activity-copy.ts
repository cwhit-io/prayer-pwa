/** Anonymous homepage copy for a saved prayer session, varied by duration. */
export function sessionActivityTitle(minutes: number) {
  if (minutes <= 4) {
    return "Someone paused to pray";
  }
  if (minutes <= 15) {
    return "Someone interceded in prayer";
  }
  return `Someone spent ${minutes} minutes in prayer`;
}
