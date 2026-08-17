import { test } from "node:test";
import assert from "node:assert/strict";
import { darkColors, lightColors } from "./tokens";

/**
 * `lightColors`/`darkColors` are hand-copied from `packages/ui/src/tokens.css`
 * (see that file's own comment on why there is no shared JS export to import
 * instead) — the one failure mode a hand-sync like this actually has is the
 * two objects drifting apart (a key added/renamed in one but not the other),
 * which silently produces `undefined` wherever a component reads a token
 * that "the other" theme doesn't define. This test only guards that one
 * failure mode; it does not (and cannot) verify the hex values themselves
 * still match tokens.css — that is a manual re-check, same as any other
 * hand-copied constant in this codebase.
 */
test("lightColors and darkColors expose exactly the same set of token keys", () => {
  const lightKeys = Object.keys(lightColors).sort();
  const darkKeys = Object.keys(darkColors).sort();
  assert.deepEqual(darkKeys, lightKeys);
});

test("every token value is a non-empty string", () => {
  for (const [key, value] of Object.entries(lightColors)) {
    assert.equal(typeof value, "string", `lightColors.${key}`);
    assert.ok(value.length > 0, `lightColors.${key}`);
  }
  for (const [key, value] of Object.entries(darkColors)) {
    assert.equal(typeof value, "string", `darkColors.${key}`);
    assert.ok(value.length > 0, `darkColors.${key}`);
  }
});
