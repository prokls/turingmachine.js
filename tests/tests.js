// ----------------------------- test helpers -----------------------------

QUnit.test("def tests", function(assert) {
  assert.ok(def(undefined, 1) === 1);
  assert.ok(def(undefined, null) === null);
  assert.ok(typeof def(undefined, {1: 3}) === "object");
  assert.ok(def(2, 1) === 2);
});
