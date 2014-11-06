// ----------------------------- test helpers -----------------------------

QUnit.test("def tests", function (assert) {
  assert.ok(def(undefined, 1) === 1);
  assert.ok(def(undefined, null) === null);
  assert.ok(typeof def(undefined, {1: 3}) === "object");
  assert.ok(def(2, 1) === 2);
});

QUnit.test("cmp tests", function (assert) {
  assert.ok(cmp(1, 2) === -1);
  assert.ok(cmp(2, 2) === 0);
  assert.ok(cmp(3, 2) === 1);
  assert.ok(cmp("alice", "bob") === -1);
  assert.ok(cmp("bob", "bob") === 0);
  assert.ok(cmp("bob", "alice") === 1);
});

QUnit.test("compare symbol", function (assert) {
  // definition by convention
  assert.ok(symbol("a").cmp(symbol("b")) === -1);
  assert.ok(symbol("b").cmp(symbol("b")) === 0);
  assert.ok(symbol("c").cmp(symbol("b")) === 1);

  assert.ok(symbol(null).cmp(symbol(undefined)) === 0);
  assert.ok(symbol("").cmp(symbol(undefined)) === 0);
  assert.ok(symbol("").cmp(symbol(" ")) === 0);
  assert.ok(symbol("   ").cmp(symbol(" ")) === 0);
  assert.ok(symbol("\t\n").cmp(symbol(" ")) === 0);
  assert.ok(symbol("x ").cmp(symbol("x")) === 0);
  assert.ok(symbol(1).cmp(symbol("1")) === 0);
  assert.ok(symbol(1.58).cmp(symbol(1)) !== 0);
});

QUnit.test("isin tests", function (assert) {
  var a = [1, 2, 3, 4, 5, 6, 7];
  assert.ok(isIn(1, a));
  assert.ok(isIn(7, a));
  assert.ok(!isIn(10, a));
  assert.ok(!isIn("7", a));

  var b = [null, 0];
  assert.ok(isIn(null, b));
  assert.ok(isIn(0, b));
  assert.ok(!isIn("0", b));
  assert.ok(!isIn(undefined, b));
});

QUnit.test("keys tests", function (assert) {
  var a = { 1: 3, 5: 6, 8: 9, "laksjd": 22 };
  assert.deepEqual(keys(a), ["1", "5", "8", "laksjd"]);

  var B = function (v) {
    var set = function () { return 9; };
    var abc = function () { return 10; };
    var xy = function () { return v; };
    return { set: set, abc: abc, xy: xy };
  }
  B.__proto__ = a;  // only ECMAScript 'optional normative'

  // return only own-descriptors
  assert.deepEqual(keys(B("_")), ["set", "abc", "xy"]);
});

QUnit.test("arrayCmp tests", function (assert) {
  assert.ok(arrayCmp([1, 2, 3], [1, 2, 3]) === 0);
  assert.ok(arrayCmp([1, 2, 3], ["1", 2, 3]) !== 0);
  assert.ok(arrayCmp([null], [undefined]) !== 0);
  assert.ok(arrayCmp([90], [1, 2, 3]) === -1);

  var c = function (a, b) { return cmp(typeof a, typeof b); };
  assert.ok(arrayCmp([1, null, undefined, "asd"], [20, {}, undefined, "h"], c) === 0);

  var d = function (a, b) { return symbol(a).cmp(symbol(b)); };
  assert.ok(arrayCmp([" ", "   ", undefined, "\t"], [" ", " ", " ", " "], d) === 0);
});

QUnit.test("repeat tests", function (assert) {
  assert.ok(repeat("a", 5) === "aaaaa");
  assert.ok(repeat("0", 0) === "");
  assert.ok(repeat("??", 2) === "????");
  assert.ok(repeat("\n\n", 3) === "\n\n\n\n\n\n");
  assert.ok(repeat("x", -1) === "");
});

QUnit.test("require tests", function (assert) {
  assert.ok(require(true, "a") === undefined);
  assert.throws(function () { require(false, "a") }, Error);
  assert.throws(function () { require(false, "a") }, /a/);

  assert.throws(function () { require(undefined, "c") }, Error);
  assert.throws(function () { require(undefined, "c") }, /c/);
});

QUnit.test("repr tests", function (assert) {
  assert.ok(repr(5).match(/5/));
  assert.ok(repr("hello").match(/hello/));
});

QUnit.test("deepCopy tests", function (assert) {
  var a = [1, "aksjd", 1];
  var b = deepCopy(a);

  a[1] = 0;
  assert.ok(b[1] === "aksjd");

  var c = [1, [2, 9], {3: 5}, "?", [null, undefined, 6]];
  var d = deepCopy(c);

  c[1][1] = "9";
  c[2][9] = 10;
  c[4][0] = undefined;
  assert.ok(d[1][1] === 9);
  assert.ok(d[2][9] === undefined);
  assert.ok(d[4][0] === null);
});

// ------------------------ data structure helpers -------------------------

QUnit.test("OrderedSet constructor", function (assert) {
  var set = new OrderedSet([1, 3, 1]);
  assert.ok(set.size() === 2);
});

QUnit.test("OrderedSet constructor various datatypes", function (assert) {
  var set = new OrderedSet([null, 0, undefined, {}]);
  assert.ok(set.size() === 4);
});

QUnit.test("OrderedSet.push duplicates", function (assert) {
  var set = new OrderedSet();
  set.push(1);
  set.push(1);
  set.push(1);
  assert.ok(set.size() === 1);
});

QUnit.test("OrderedSet.push ordered", function (assert) {
  var set = new OrderedSet();
  set.push(1);
  set.push(2);
  set.push(-1);

  var prev = -Infinity;
  var json = set.toJSON();
  for (var i in json) {
    assert.ok(prev < json[i]);
    prev = json[i];
  }
});

QUnit.test("OrderedSet.remove duplicates", function (assert) {
  var set = new OrderedSet();
  set.push(1);
  set.push(1);
  set.push(1);
  set.remove(1);

  assert.ok(set.size() === 0);
});

QUnit.test("OrderedSet.contains", function (assert) {
  var set = new OrderedSet([1, 3]);
  set.push(2);
  assert.ok(set.contains(1));
  assert.ok(set.contains(2));
  assert.ok(set.contains(3));
});

QUnit.test("OrderedSet.equals", function (assert) {
  var set1 = new OrderedSet([1, 3]);
  var set2 = new OrderedSet([3]);
  set2.push(1);

  assert.ok(set1.equals(set2));
});

QUnit.test("OrderedSet.fromJSON", function (assert) {
  var set = new OrderedSet([1, 7, 8, 3]);
  set.fromJSON([4, 5, 9]);
  assert.ok(set.contains(9));
  assert.ok(set.contains(5));
  assert.ok(set.contains(4));
  assert.ok(!set.contains(1));
  assert.ok(!set.contains(7));
  assert.ok(!set.contains(8));
  assert.ok(!set.contains(3));
});

QUnit.test("OrderedSet comparison function", function (assert) {
  var set = new OrderedSet([1], function (a, b) { return -cmp(a, b); });
  set.push(8);
  set.push(3);

  assert.ok(set.size() === 3);
  var json = set.toJSON();
  var prev = Infinity;
  for (var i in json) {
    assert.ok(prev > json[i]);
    prev = json[i];
  }
});

// TODO: UnorderedSet

QUnit.test("Queue", function (assert) {
  var q = new Queue();
  assert.ok(q.isEmpty());
  q.push(5);
  q.push(2);
  assert.ok(!q.isEmpty());
  assert.ok(q.pop() === 5);
  assert.ok(q.pop() === 2);
});

QUnit.test("Queue intial_values", function (assert) {
  var q = new Queue([1, 8, 9]);
  assert.ok(!q.isEmpty());
  q.push(5);
  assert.ok(q.pop() === 1);
  assert.ok(q.pop() === 8);
  assert.ok(q.pop() === 9);
  assert.ok(q.pop() === 5);
});

QUnit.test("CountingQueue usecase 1", function (assert) {
  var q = new CountingQueue();
  q.inc();
  q.inc();
  q.dec();
  assert.ok(q.total() === 3);
  assert.ok(q.pop() === +2);
  assert.ok(q.pop() === -1);
});

QUnit.test("CountingQueue usecase 2", function (assert) {
  var q = new CountingQueue();
  q.inc();
  q.dec();
  q.inc();
  assert.ok(q.total() === 3);
  assert.ok(q.pop() === +1);
  assert.ok(q.pop() === -1);
  assert.ok(q.pop() === +1);
});

// ------------------------------ TM objects ------------------------------

QUnit.test("Symbol", function (assert) {
  var values = [0, "0", "1", "a", "bb", "abc ", " \t "];
  for (var i in values) {
    if (isSymbol(values[i]))
      requireSymbol(values[i]);
    else {
      requireSymbol(symbol(values[i]));
      assert.ok(isSymbol(symbol(values[i])));
    }
  }

  assert.ok(symbol("a").cmp(symbol("a")) === 0);
  assert.ok(symbol(0).cmp(symbol(1)) === -1);
});

QUnit.test("State", function (assert) {
  var values = ["-", "_", "Start", "End", "x", "Z1"];
  for (var i in values) {
    if (isState(values[i]))
      requireState(values[i]);
    else {
      requireState(state(values[i]));
      assert.ok(isState(state(values[i])));
    }
    assert.ok(state(values[i]).equals(state(values[i])));
  }
});

QUnit.test("Motion", function (assert) {
  assert.ok(motion("Left").equals(motion("l")));
  assert.ok(motion("Right").equals(motion("r")));
  assert.ok(motion("Stop").equals(motion("s")));

  requireMotion(motion("l"));
});

QUnit.test("Position", function (assert) {
  var p = position(5);
  var p2 = position(5);
  var p3 = position(6);
  p3 = p3.sub(position(1));

  assert.throws(function () { position("asd") }, Error);

  assert.ok(p.equals(p2));
  assert.ok(p2.equals(p3));
  assert.ok(p3.equals(p));

  assert.ok(isPosition(p));
  assert.ok(isPosition(p2));
  assert.ok(isPosition(p3));

  requirePosition(p);
  requirePosition(p2);
  requirePosition(p3);
});

QUnit.test("InstrTuple", function (assert) {
  assert.throws(function () { instrtuple(5, 6, 7) }, Error);
  assert.throws(function () { instrtuple("5", "left", state("as")) }, Error);
});

// InstrTuple
// isInstruction(obj)
// requireInstruction(obj)
// instrtuple(a, b, c)

// Program
// Tape
// RecordedTape
// ExtendedTape
// UserFriendlyTape
// Machine
// AnimatedTuringMachine

// ---------------------------- module.foswiki ----------------------------
