import assert from "node:assert/strict";
import { createResumeAutosave } from "../src/resume-autosave.mjs";

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const writes = [], states = [], errors = [];
let release, fail = false;
const writer = createResumeAutosave({ delay: 10,
  write: async (snapshot) => {
    writes.push(snapshot);
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
    if (fail) throw new Error("offline");
  },
  onState: state => states.push(state), onError: error => errors.push(error.message),
});
writer.update({ title: "loaded" });
await wait(20);
assert.equal(writes.length, 0, "hydration must not write a new version");
writer.update({ title: "first keystroke" });
writer.update({ title: "pause" });
await wait(20);
assert.deepEqual(writes, [{ title: "pause" }], "rapid edits must be debounced");
writer.update({ title: "latest edit" });
assert.equal(writes.length, 1, "no concurrent writer while request is in flight");
release();
await writer.flush();
assert.deepEqual(writes.at(-1), { title: "latest edit" });
assert.equal(writer.dirty(), false);
assert.equal(states.at(-1), "saved");
fail = true;
writer.update({ title: "offline edit" });
assert.equal(await writer.flush(), false);
assert.equal(writer.dirty(), true);
assert.equal(states.at(-1), "error");
assert.deepEqual(errors, ["offline"]);
await wait(20);
assert.equal(writes.length, 3, "failure must not loop retries or show success");
fail = false;
assert.equal(await writer.flush(), true);
assert.equal(writer.dirty(), false);
writer.update({ title: "leave immediately" });
await writer.flush();
assert.deepEqual(writes.at(-1), { title: "leave immediately" }, "navigation flush saves pending edits without debounce delay");
writer.update({ title: "temporary" });
writer.update({ title: "leave immediately" });
await wait(20);
assert.equal(writes.length, 5, "reverting to persisted content must not create a version");
console.log("Resume autosave passed: hydration, debounce, serialized latest edits, visible failure/retry, navigation flush, no-op suppression.");
