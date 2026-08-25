import assert from "node:assert/strict";
import test from "node:test";
import { APP_CAPABILITIES, hasCapability } from "../src/lib/permissions.ts";

test("guest and member have no staff capabilities", () => {
  for (const capability of APP_CAPABILITIES) {
    assert.equal(hasCapability(undefined, capability), false);
    assert.equal(hasCapability("member", capability), false);
  }
});

test("Prayer Team can manage content and participant entries without progress or moderation", () => {
  assert.equal(hasCapability("prayer_team", "staff:access"), true);
  assert.equal(hasCapability("prayer_team", "prayer-content:manage"), true);
  assert.equal(hasCapability("prayer_team", "member-entries:manage"), true);
  assert.equal(hasCapability("prayer_team", "people:add"), true);
  assert.equal(hasCapability("prayer_team", "member-progress:read"), false);
  assert.equal(hasCapability("prayer_team", "community-requests:moderate"), false);
  assert.equal(hasCapability("prayer_team", "private-requests:read"), false);
});

test("admin can view progress and moderate community requests but not sensitive settings", () => {
  assert.equal(hasCapability("admin", "member-progress:read"), true);
  assert.equal(hasCapability("admin", "community-requests:moderate"), true);
  assert.equal(hasCapability("admin", "people:add"), true);
  assert.equal(hasCapability("admin", "private-requests:read"), false);
  assert.equal(hasCapability("admin", "campaign-settings:manage"), false);
  assert.equal(hasCapability("admin", "notifications:manage"), false);
  assert.equal(hasCapability("admin", "directory:manage"), false);
  assert.equal(hasCapability("admin", "roles:manage"), false);
});

test("superadmin has every application capability", () => {
  for (const capability of APP_CAPABILITIES) {
    assert.equal(hasCapability("superadmin", capability), true);
  }
});
