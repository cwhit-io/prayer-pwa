import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_ACCOUNT_ENABLED,
  DEMO_ACCOUNT_NAME,
  DEMO_LOGIN_CODE,
  DEMO_PHONE_NORMALIZED,
  isDemoLoginCode,
  isDemoLoginContact,
  isDemoPhone
} from "../src/lib/demo-account.ts";

test("demo account is Alex with a six-zero login code", () => {
  assert.equal(DEMO_ACCOUNT_NAME, "Alex");
  assert.equal(DEMO_LOGIN_CODE, "000000");
  assert.equal(DEMO_PHONE_NORMALIZED, "+12602767404");
});

test("demo login is disabled", () => {
  assert.equal(DEMO_ACCOUNT_ENABLED, false);
  assert.equal(isDemoLoginContact("phone", "+12602767404"), false);
});

test("demo phone matches common US formats", () => {
  for (const value of ["260-276-7404", "(260) 276-7404", "2602767404", "+1 260 276 7404", "+12602767404"]) {
    assert.equal(isDemoPhone(value), true, value);
  }
  assert.equal(isDemoPhone("260-555-1212"), false);
  assert.equal(isDemoLoginContact("email", "+12602767404"), false);
});

test("only 000000 is the demo login code", () => {
  assert.equal(isDemoLoginCode("000000"), true);
  assert.equal(isDemoLoginCode(" 000000 "), true);
  assert.equal(isDemoLoginCode("000001"), false);
});
