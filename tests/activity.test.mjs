import assert from "node:assert/strict";
import test from "node:test";
import { sessionActivityTitle } from "../src/lib/activity-copy.ts";

test("session activity copy varies by duration", () => {
  assert.equal(sessionActivityTitle(1), "Someone paused to pray");
  assert.equal(sessionActivityTitle(4), "Someone paused to pray");
  assert.equal(sessionActivityTitle(5), "Someone interceded in prayer");
  assert.equal(sessionActivityTitle(15), "Someone interceded in prayer");
  assert.equal(sessionActivityTitle(16), "Someone spent 16 minutes in prayer");
  assert.equal(sessionActivityTitle(26), "Someone spent 26 minutes in prayer");
});
