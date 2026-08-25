import assert from "node:assert/strict";
import test from "node:test";
import { decodeImportedBytes, repairImportedText } from "../src/lib/text.ts";

test("repairs possessive and contraction replacement characters", () => {
  assert.equal(repairImportedText("God�s kingdom"), "God’s kingdom");
  assert.equal(repairImportedText("Bear one another�s burdens"), "Bear one another’s burdens");
  assert.equal(repairImportedText("don�t"), "don’t");
  assert.equal(repairImportedText("we�re"), "we’re");
});

test("repairs opening and closing quotes from replacement characters", () => {
  assert.equal(
    repairImportedText("Pray, �Your kingdom come, your will be done in Fort Wayne as it is in heaven.� Ask God"),
    "Pray, “Your kingdom come, your will be done in Fort Wayne as it is in heaven.” Ask God"
  );
  assert.equal(
    repairImportedText("He said to him, �We have found the Messiah.�"),
    "He said to him, “We have found the Messiah.”"
  );
  assert.equal(repairImportedText("Philip said to him, �Come and see.�"), "Philip said to him, “Come and see.”");
});

test("repairs em dashes between words from replacement characters", () => {
  assert.equal(
    repairImportedText("Confess anything that has taken God's place in your affections�comfort, approval"),
    "Confess anything that has taken God's place in your affections—comfort, approval"
  );
  assert.equal(
    repairImportedText("Thank God for the Sabbath rest He offers�rest for your body"),
    "Thank God for the Sabbath rest He offers—rest for your body"
  );
});

test("maps Windows-1252 C1 controls and UTF-8 mojibake", () => {
  assert.equal(repairImportedText("God\u0092s"), "God’s");
  assert.equal(repairImportedText("\u0093Come and see.\u0094"), "“Come and see.”");
  assert.equal(repairImportedText("God\u00E2\u20AC\u2122s"), "God’s");
});

test("decodes Windows-1252 CSV bytes instead of inserting replacement characters", () => {
  const windows = Uint8Array.from(Buffer.from("God\x92s kingdom, \x93Come.\x94, work\x97paid", "latin1"));
  assert.equal(decodeImportedBytes(windows), "God’s kingdom, “Come.”, work—paid");

  const utf8 = new TextEncoder().encode("God’s kingdom");
  assert.equal(decodeImportedBytes(utf8), "God’s kingdom");
});
