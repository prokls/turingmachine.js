var tostate = function (v) { return state(v); }
var tomotion = function (v) { return motion(v); }
var tosymbol = function (v) { return symbol(v); }

// ----------------------------- test helpers -----------------------------
QUnit.module("helpers");

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

  require(true);
  require(true, "Hello World");
  require(def(undefined, 5) === 5);
  require(def(6, 5) === 6);
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

QUnit.test("inherit tests", function (assert) {
  var ctor = function () {
    return { truth : 41, failure : true, method : function() { return 1; } };
  };
  var obj = new ctor();
  obj.failure = false;

  var obj2 = inherit(obj, { truth : 42 });

  assert.ok(obj2.failure === false);
  assert.ok(obj2.truth === 42);
  assert.ok(obj2.method() === 1);
});

// ------------------------ data structure helpers -------------------------
QUnit.module("data structures");

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

QUnit.test("OrderedSet.remove return value", function (assert) {
  var s4 = new OrderedSet([6]);
  assert.ok(s4.contains(6));
  assert.ok(s4.remove(6));
  assert.ok(!s4.remove(6));
  assert.ok(s4.push(2));
  assert.ok(!s4.push(2));
  assert.ok(s4.push(4));
  assert.ok(s4.push(6));
  assert.ok(s4.push(8));
  assert.ok(s4.remove(6));
  assert.ok(s4.size() === 3);
  assert.ok(s4.contains(4) && !s4.contains(6) && s4.contains(8));
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

QUnit.test("UnorderedSet constructor", function (assert) {
  var set = new UnorderedSet([1, 3, 1]);
  assert.ok(set.size() === 2);
});

QUnit.test("UnorderedSet constructor various datatypes", function (assert) {
  var set = new UnorderedSet([null, 0, undefined, {}]);
  assert.ok(set.size() === 4);
});

QUnit.test("UnorderedSet.push duplicates", function (assert) {
  var set = new UnorderedSet();
  set.push(1);
  set.push(1);
  set.push(1);
  assert.ok(set.size() === 1);
});

QUnit.test("UnorderedSet.remove duplicates", function (assert) {
  var set = new UnorderedSet();
  set.push(1);
  set.push(1);
  set.push(1);
  set.remove(1);

  assert.ok(set.size() === 0);
});

QUnit.test("UnorderedSet.remove return value", function (assert) {
  var s4 = new UnorderedSet([6]);
  assert.ok(s4.contains(6));
  assert.ok(s4.remove(6));
  assert.ok(!s4.remove(6));
  assert.ok(s4.push(2));
  assert.ok(!s4.push(2));
  assert.ok(s4.push(4));
  assert.ok(s4.push(6));
  assert.ok(s4.push(8));
  assert.ok(s4.remove(6));
  assert.ok(s4.size() === 3);
  assert.ok(s4.contains(4) && !s4.contains(6) && s4.contains(8));
});

QUnit.test("UnorderedSet.contains", function (assert) {
  var set = new UnorderedSet([1, 3]);
  set.push(2);
  assert.ok(set.contains(1));
  assert.ok(set.contains(2));
  assert.ok(set.contains(3));
});

QUnit.test("UnorderedSet.equals", function (assert) {
  var set1 = new UnorderedSet([1, 3]);
  var set2 = new UnorderedSet([3]);
  set2.push(1);

  assert.ok(set1.equals(set2));
});

QUnit.test("UnorderedSet.fromJSON", function (assert) {
  var set = new UnorderedSet([1, 7, 8, 3]);
  set.fromJSON([4, 5, 9]);
  assert.ok(set.contains(9));
  assert.ok(set.contains(5));
  assert.ok(set.contains(4));
  assert.ok(!set.contains(1));
  assert.ok(!set.contains(7));
  assert.ok(!set.contains(8));
  assert.ok(!set.contains(3));
});

QUnit.test("UnorderedSet comparison function", function (assert) {
  var set = new UnorderedSet([1], function (a, b) { return -cmp(a, b); });
  set.push(8);
  set.push(3);

  assert.ok(set.size() === 3);
});

QUnit.test("UnorderedSet auto", function (assert) {
  var from = -5, to = 100;
  for (var i = 0; i < 20; i++) {
    var s = new OrderedSet();
    for (var j = 0; j < i; j++) {
      s.push(j);
    }
    assert.ok(s.size() === i);
    for (var j = from; j < to; j++) {
      assert.ok(s.contains(j) === (0 <= j && j < i));
    }
    for (var j = 0; j < i; j++) {
      assert.ok(s.size() === i - j);
      assert.ok(s.remove(j));
    }
    assert.ok(s.size() === 0);
  }
});

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
QUnit.module("TM objects");

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

QUnit.test("Symbol.cmp", function (assert) {
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

  assert.ok(!isState({}));
  assert.ok(state("-").equals(state("-")));
});

QUnit.test("Motion", function (assert) {
  assert.ok(motion("Left").equals(motion("l")));
  assert.ok(motion("Right").equals(motion("r")));
  assert.ok(motion("Stop").equals(motion("s")));

  requireMotion(motion("l"));

  var m1 = motion("L");
  var m2 = motion("R");
  var m3 = mot.LEFT;
  var m4 = motion("LEFT");

  assert.ok(m1.equals(m1));
  assert.ok(!m1.equals(m2));
  assert.ok(m1.equals(m3));
  assert.ok(m1.equals(m4));

  assert.ok(isMotion(m1));
  assert.ok(isMotion(m2));
  assert.ok(isMotion(m3));
  assert.ok(isMotion(m4));
  assert.ok(!isMotion({}));
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

  var p4 = position(5);
  var p5 = position(-5);
  var p6 = position(5);
  assert.ok(p4.equals(p6));
  assert.ok(p4.sub(10).equals(p5));
  assert.ok(p5.add(10).equals(p4));

  assert.ok(isPosition(p4));
  assert.ok(isPosition(p5));
  assert.ok(isPosition(p6));
  assert.ok(!isPosition(undefined));
});

QUnit.test("InstrTuple", function (assert) {
  assert.throws(function () { instrtuple(5, 6, 7) }, Error);
  assert.throws(function () { instrtuple("5", "left", state("as")) }, Error);
  assert.throws(function () { requireInstrTuple(5) }, Error);

  assert.ok(isInstrTuple(instrtuple(symbol(5), motion("l"), state("st"))));
  assert.ok(isInstrTuple(instrtuple(symbol("_"), motion("s"), state("End"))));

  requireInstrTuple(instrtuple(symbol("_"), motion("s"), state("End")));
});

// ------------------------------ Program tests -----------------------------

QUnit.test("Program", function (assert) {
  var prg = new Program();
  var d = instrtuple(symbol("d"), motion("l"), state("d"));
  assert.ok(prg.size() === 0);
  assert.ok(prg.isProgram);

  prg.set(symbol("a"), state("a"), symbol("b"), motion("l"), state("b"));
  prg.set(symbol("c"), state("c"), d);

  assert.ok(prg.exists(symbol("a"), state("a")));
  assert.ok(!prg.exists(symbol("a"), state("b")));
  assert.ok(!prg.exists(symbol("b"), state("a")));
  assert.ok(!prg.exists(symbol("b"), state("b")));
  assert.ok(prg.exists(symbol("c"), state("c")));
  assert.ok(!prg.exists(symbol("c"), state("d")));

  assert.ok(prg.get(symbol("c"), state("c")).equals(d));
  assert.ok(prg.size() === 2);

  // getFromSymbols
  var from_sym = prg.getFromSymbols().toJSON();
  assert.ok(from_sym.length === 2);
  if (from_sym[0].equals(symbol("a")))
    assert.ok(from_sym[1].equals(symbol("c")));
  else
    assert.ok(from_sym[1].equals(symbol("a")));

  // getFromStates
  var from_states = prg.getFromStates().toJSON();
  assert.ok(from_states.length === 2);
  if (from_states[0].equals(symbol("a")))
    assert.ok(from_states[1].equals(symbol("c")));
  else
    assert.ok(from_states[1].equals(symbol("a")));

  var j = prg.toJSON();
  var prg2 = new Program();
  prg2.fromJSON(j);

  assert.ok(prg2.exists(symbol("a"), state("a")));
  assert.ok(!prg2.exists(symbol("a"), state("b")));
  assert.ok(!prg2.exists(symbol("b"), state("a")));
  assert.ok(!prg2.exists(symbol("b"), state("b")));
  assert.ok(prg2.exists(symbol("c"), state("c")));
  assert.ok(!prg2.exists(symbol("c"), state("d")));

  prg.clear();
  assert.ok(prg.size() === 0);
  assert.ok(prg2.size() === 2);
});

QUnit.test("Program get/set", function (assert) {
  var prg = new Program();
  var states = [state("S1"), state("S2"),
                state("end"), state("?")];
  var moves = [motion("l"), motion("Right"),
               motion("Left"), motion("R")];
  var symbols = ['a', '0', null, false, 'long'].map(tosymbol);

  for (var i = 0; i < states.length; i++)
    for (var k = 0; k < symbols.length; k++) {
      var j = (((i + 3) * 9 * k) % moves.length);
      var instr = instrtuple(symbols[k], moves[j], states[i]);
      prg.set(symbols[k], states[i], instr);
    }

  for (var i = 0; i < states.length; i++)
    for (var k = 0; k < symbols.length; k++) {
      var j = (((i + 3) * 9 * k) % moves.length);
      var instr = instrtuple(symbols[k], moves[j], states[i]);
      var value = prg.get(symbols[k], states[i]);
      if (typeof value === 'undefined')
        assert.ok(false, "Did not find value");
      assert.ok(instr.equals(value));
    }
})

QUnit.test("Program clear", function (assert) {
  var prg = new Program();
  var states = ["S1", "S2", "end", "?"].map(tostate);
  var moves = ["l", "Right", "Left", "R"].map(tomotion);
  var symbols = ['a', 0, 'null', false, 'long'].map(tosymbol);

  for (var i = 0; i < states.length; i++)
    for (var k = 0; k < symbols.length; k++) {
      var j = (((i + 3) * 9 * k) % moves.length);
      var instr = new InstrTuple(symbols[k], moves[j], states[i]);
      prg.set(symbols[k], states[i], instr);
      assert.ok(prg.exists(symbols[k], states[i]));
    }

  prg.clear();

  for (var i = 0; i < states.length; i++)
    for (var k = 0; k < symbols.length; k++) {
      assert.ok(!prg.exists(symbols[k], states[i]));
    }
});

QUnit.test("Program toString", function (assert) {
  var prg = new Program();
  var states = ["S1", "S2", "end", "?"].map(tostate);
  var moves = ["l", "Right", "Left", "R"].map(tomotion);
  var symbols = ['a', 0, 'null', false, 'long'].map(tosymbol);

  for (var i = 0; i < states.length; i++)
    for (var k = 0; k < symbols.length; k++) {
      var j = (((i + 3) * 9 * k) % moves.length);
      var instr = new InstrTuple(symbols[k], moves[j], states[i]);
      prg.set(symbols[k], states[i], instr);
    }

  var str = prg.toString();

  assert.ok(str.indexOf("end") !== -1);
  assert.ok(str.indexOf("S2") !== -1);
  assert.ok(str.indexOf("long") !== -1);
  assert.ok(str.indexOf("a") !== -1);
  assert.ok(str.indexOf(null) !== -1);
});

QUnit.test("Program import/export", function (assert) {
  var prg = new Program();
  var states = ["S1", "S2", "end", "?"].map(tostate);
  var moves = ["l", "Right", "Left", "R"].map(tomotion);
  var symbols = ['a', 0, 'null', false, 'long'].map(tosymbol);

  for (var i = 0; i < states.length; i++)
    for (var k = 0; k < symbols.length; k++) {
      var j = (((i + 3) * 9 * k) % moves.length);
      var instr = new InstrTuple(symbols[k], moves[j], states[i]);
      prg.set(symbols[k], states[i], instr);
    }

  var json = prg.toJSON();
  var prg2 = new Program();
  prg2.fromJSON(json);

  for (var i = 0; i < states.length; i++)
    for (var k = 0; k < symbols.length; k++) {
      var j = (((i + 3) * 9 * k) % moves.length);
      var instr = new InstrTuple(symbols[k], moves[j], states[i]);
      var value = prg2.get(symbols[k], states[i]);

      if (typeof value === 'undefined')
        assert.ok(false, "Value is missing after export-import");
      assert.ok(value.equals(instr), "Different value retrieved");
    }
});

// ------------------------------ Tape tests ------------------------------
QUnit.module("tapes");

function tapeSimpleRL(assert, t) {
  t.write(symbol(4));
  t.right();
  assert.ok(t.cursor().equals(position(1)));
  t.write(symbol(5));
  assert.ok(t.read().equals(symbol(5)));
  t.left();
  assert.ok(t.read().equals(symbol(4)));
  assert.ok(t.cursor().equals(position(0)));
  assert.ok(t.begin().equals(position(0)));
  assert.ok(t.end().equals(position(1)));
}

function tapeSimpleLR(assert, t) {
  t.write(symbol(4));
  t.left();
  assert.ok(t.cursor().equals(position(-1)));
  t.write(symbol(5));
  assert.ok(t.read().equals(symbol(5)));
  t.right();
  assert.ok(t.read().equals(symbol(4)));
  assert.ok(t.cursor().equals(position(0)));
  assert.ok(t.begin().equals(position(-1)));
  assert.ok(t.end().equals(position(0)));
}

function tapeWalk(assert, t) {
  for (var i = 0; i < 100; i++)
    t.left();
  assert.ok(t.read().equals(symbol('42')));
  t.write(symbol('43'));
  for (var i = 0; i < 200; i++)
    t.right();
  assert.ok(t.read().equals(symbol('42')));
  t.write(symbol('44'));
  assert.ok(t.size() === 201);
}

function tapeSwitchBlankSymbol(assert, t) {
  function read() {
    var values = [];
    t.left();
    values.push(t.read());
    t.right();
    values.push(t.read());
    t.right();
    values.push(t.read());
    t.left();
    return values;
  }

  t.setBlankSymbol(symbol("Y"));
  // | 8 |* *| 9 |
  t.left();
  t.write(symbol("8"));
  t.right();
  t.right();
  t.write(symbol("9"));
  t.left();

  var vals1 = read();
  assert.ok(vals1[0].equals(symbol("8")));
  assert.ok(vals1[1].equals(symbol("Y")));
  assert.ok(vals1[2].equals(symbol("9")));

  t.setBlankSymbol(symbol("x"));

  var vals2 = read();
  assert.ok(vals2[0].equals(symbol("8")));
  assert.ok(vals2[1].equals(symbol("x")));
  assert.ok(vals2[2].equals(symbol("9")));
}

function tapeMathWalkWithImportExport(assert, t) {
  for (var i = 0; i < 100; i++)
  {
    if (i % 34 !== 0)
      t.write(symbol((i + 37) % 41));
    t.right();
  }

  assert.ok(t.cursor().equals(position(100)));
  assert.ok(t.begin().equals(position(1)));
  assert.ok(t.end().equals(t.cursor()));
  assert.ok(t.size() === 100);
  t.left();
  var dump = t.toJSON();

  t = new Tape();
  t.fromJSON(dump);
  t.right();
  assert.ok(t.cursor().equals(position(100)));
  assert.ok(t.begin().equals(position(1)));
  assert.ok(t.end().equals(t.cursor()));
  assert.ok(t.size() === 100);
  t.left();

  for (var i = 99; i >= 0; i--)
  {
    if (i % 34 === 0)
      assert.ok(t.read().equals(symbol(true)));
    else
      assert.ok(t.read().equals(symbol((i + 37) % 41)));
    t.left();
    t.left();
    t.right();
  }
}

function tapeSimpleHumanReadableString(assert, t) {
  var test = "0,9,8,7,6,5, *4*,3,a,2,1";
  var symbs = ['0', '9', '8', '7', '6', '5', '4',
               '3', 'a', '2', '1'];
  t.fromHumanString(test);

  assert.ok(t.cursor().equals(position(0)));
  assert.ok(t.size() === 11);
  assert.ok(t.begin().equals(position(-6)));
  assert.ok(t.end().equals(position(4)));

  for (var i = 0; i < 6; i++)
    t.left();
  for (var i = 0; i < symbs.length; i++) {
    assert.ok(t.read().equals(symbol(symbs[i])));
    assert.ok(t.cursor().equals(position(i - 6)));
    t.right();
  }
}

function tapeGenericTest(assert, inst, inst2) {
  // check initial state
  assert.ok(inst.cursor().equals(position(0)));
  assert.ok(inst.getBlankSymbol().equals(symbol("_")));
  assert.ok(inst.begin().equals(position(0)));
  assert.ok(inst.end().equals(position(0)));
  assert.ok(inst.size() === 1);

  var st = [18, 16, 14, 12, 10, 8, 6, 4, 2,
            "_", 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

  for (var i = 1; i < 20; i++) {
    for (var j = 0; j < i; j++)
      if (i % 2 === 0)
        inst.left();
      else
        inst.right();

    assert.ok(inst.read().equals(symbol("_")));
    inst.write(symbol(i));
    assert.ok(inst.read().equals(symbol(i)));
  }

  // check final state
  assert.ok(inst.cursor().equals(position(10)));
  for (var i = 10; i >= -9; i--) {
    assert.ok(inst.read().equals(symbol(st[i + 9])));
    assert.ok(inst.cursor().equals(position(i)));
    inst.left();
  }
  assert.ok(inst.begin().equals(position(-10)));
  assert.ok(inst.end().equals(position(10)));
  assert.ok(inst.size() === st.length + 1);
  assert.ok(inst.cursor().equals(position(-10)));

  inst2.fromJSON(inst.toJSON());
  for (var i = -10; i < 10; i++)
    inst2.right();

  // check final state of second instance
  assert.ok(inst2.cursor().equals(position(10)));
  for (var i = 10; i >= -9; i--) {
    assert.ok(inst2.read().equals(symbol(st[i + 9])));
    assert.ok(inst2.cursor().equals(position(i)));
    inst2.left();
  }
  assert.ok(inst2.begin().equals(position(-10)));
  assert.ok(inst2.end().equals(position(10)));
  assert.ok(inst2.size() === st.length + 1);
  assert.ok(inst2.cursor().equals(position(-10)));
}

QUnit.test("Tape all", function (assert) {
  tapeSimpleRL(assert, new Tape());
  tapeSimpleLR(assert, new Tape());
  tapeWalk(assert, new Tape(symbol('42')));
  tapeSwitchBlankSymbol(assert, new Tape(symbol("42")));
  tapeMathWalkWithImportExport(assert, new Tape(symbol(true)));
  tapeSimpleHumanReadableString(assert, new Tape());
  tapeGenericTest(assert, new Tape(symbol("_")), new Tape(symbol("_")));
});

// Tape
// RecordedTape
// ExtendedTape
// UserFriendlyTape
// Machine
// AnimatedTuringMachine

// --------------------------- module.humantape ---------------------------
QUnit.module("humantape module");

QUnit.test("humantape simple", function (assert) {
  var tape = new Tape(symbol('7'));
  humantape.read(tape, "0,0,0,1");
  assert.ok(tape.read().equals(symbol('0')));
  tape.right();
  assert.ok(tape.read().equals(symbol('0')));
  tape.right();
  assert.ok(tape.read().equals(symbol('0')));
  tape.right();
  assert.ok(tape.read().equals(symbol('1')));
  tape.right();
  assert.ok(tape.read().equals(symbol('7')));
});

QUnit.test("humantape multichar", function (assert) {
  var tape = new Tape(symbol('7'));
  humantape.read(tape, "__,_,?,''");
  assert.ok(tape.read().equals(symbol('__')));
  tape.right();
  assert.ok(tape.read().equals(symbol('_')));
  tape.right();
  assert.ok(tape.read().equals(symbol('?')));
  tape.right();
  assert.ok(tape.read().equals(symbol("''")));
});

QUnit.test("humantape whitespace", function (assert) {
  var tape = new Tape(symbol('7'));
  humantape.read(tape, " a ,\t,   ");
  assert.ok(tape.read().equals(symbol('a')));
  tape.right();
  assert.ok(tape.read().equals(symbol('\t')));
  tape.right();
  assert.ok(tape.read().equals(symbol(' ')));
});

QUnit.test("humantape blank='a'", function (assert) {
  var tape = new Tape(symbol('2'));
  humantape.read(tape, 'blank=\"a\",0,1');
  tape.left();
  assert.ok(tape.read().equals(symbol('a')));
  tape.right();
  assert.ok(tape.read().equals(symbol('0')));
  tape.right();
  assert.ok(tape.read().equals(symbol('1')));
  tape.right();
  assert.ok(tape.read().equals(symbol('a')));
});

// ---------------------------- module.foswiki ----------------------------
QUnit.module("foswiki module");

QUnit.test("foswiki simple", function (assert) {
  var check = function (tm) {
    assert.ok(tm.getTape().getBlankSymbol().equals(symbol("_")));
    assert.ok(tm.getProgram().exists(symbol("a"), state("Start")));
    assert.ok(tm.getProgram().exists(symbol("b"), state("Start")));
    assert.ok(tm.getProgram().exists(symbol("_"), state("Start")));
    assert.ok(!tm.getProgram().exists(symbol("c"), state("Start")));
    assert.ok(tm.getTape().read().equals(symbol("0")));
    assert.ok(tm.getProgram().get(symbol("a"), state("Start")).equals(
      instrtuple(symbol("0"), motion("R"), state("Start"))
    ));
    assert.ok(
      UnorderedSet(tm.getFinalStates().map(toStr))
        .equals(["End", "Ende", "Stop"])
    );
    assert.ok(tm.getState().equals(state("Start")));
    assert.ok(tm.getMachineName() === "Machine name 1992-12-12");
    assert.ok(tm.getStep() === 0);
  };

  var text = "   $ __Tape__: 0,1\n" +
             "   $ __Final states__: End, Ende, Stop\n" +
             "   $ __Name__: Machine name 1992-12-12\n" +
             "\n" +
             "|       | a             |  b          | _             |\n" +
             "| Start | 0 - R - Start | 1 - R - End | 0 - L - Start |\n";

  var tm = defaultTuringMachine();
  foswiki.read(tm, text);

  check(tm);
});

QUnit.test("foswiki advanced", function (assert) {
  var text = "   $ __Tape__: _0_,1,1,*1*,0,0\n" +
             "   $ __Final states__: End, *Ende*,Stop\n" +
             "   $ __State__: Start\n" +
             "   $ __Name__: Example\n" +
             "\n" +
             "| | *a* | *b* | *c* |\n" +
             "| *Start* | 0 - R - Start | 1 - *R* - End | _0_ - S - S0 |\n" +
             "| *S0* | 1 - L - Start | 0 - __R__ - =S1= | ==0== - S - S1 |\n" +
             "| S1 | 1 - R - Start | 0 - L - End | 0 - S - End |\n";

  var tape = new UserFriendlyTape(symbol('?'), 1);
  tape.fromHumanString('blank="<",0,9,7,6,5,4,3,2,1');
  var prg = new Program();
  var fs = [state('SomeTarget')];
  var tm = new TuringMachine(prg, tape, fs, state("Somewhere"), 100);

  foswiki.read(tm, text);

  function check(tm) {
    assert.ok(tm.getTape().read().equals(symbol('1')));
    assert.ok(tm.getTape().toJSON()['data'].length === 6);
    assert.ok(tm.getTape().read(position(1)).equals(symbol('0')));
    assert.ok(
      UnorderedSet(tm.getFinalStates().map(toStr))
        .equals(["End", "Ende", "Stop"])
    );
    assert.ok(tm.getState().equals(state('Start')));
    assert.ok(tm.getMachineName() === 'Example');

    assert.ok(tm.getProgram().get(symbol("a"), state("Start")).equals(
      instrtuple(symbol("0"), motion("R"), state("Start"))
    ));
    assert.ok(tm.getProgram().get(symbol("b"), state("Start")).equals(
      instrtuple(symbol("1"), motion("R"), state("End"))
    ));
    assert.ok(tm.getProgram().get(symbol("c"), state("Start")).equals(
      instrtuple(symbol("0"), motion("S"), state("S0"))
    ));
    assert.ok(tm.getProgram().get(symbol("a"), state("S0")).equals(
      instrtuple(symbol("1"), motion("L"), state("Start"))
    ));
    assert.ok(tm.getProgram().get(symbol("b"), state("S0")).equals(
      instrtuple(symbol("0"), motion("R"), state("S1"))
    ));
    assert.ok(tm.getProgram().get(symbol("c"), state("S0")).equals(
      instrtuple(symbol("0"), motion("S"), state("S1"))
    ));
    assert.ok(tm.getProgram().get(symbol("a"), state("S1")).equals(
      instrtuple(symbol("1"), motion("R"), state("Start"))
    ));
    assert.ok(tm.getProgram().get(symbol("b"), state("S1")).equals(
      instrtuple(symbol("0"), motion("L"), state("End"))
    ));
    assert.ok(tm.getProgram().get(symbol("c"), state("S1")).equals(
      instrtuple(symbol("0"), motion("S"), state("End"))
    ));

    assert.ok(tm.getMachineName() === 'Example');
    assert.ok(tm.getStep() === 0);
  }

  check(tm);
  tm.fromJSON(tm.toJSON());
  check(tm);
});

QUnit.test("foswiki machine9077", function (assert) {
  var text = "   $ __Name__: machine 9077\n" +
             "   $ __State__: Start\n" +
             "   $ __Final states__: End, Final, 1oneFound, 2onesFound\n" +
             "   $ __Tape__: blank=\"0\",0,0,0,0,0,0,0,*1*,0,0,0,2,0,0\n\n" +
             "|                              | 0                            | 1                            |                              |\n\n" +
             "| Start                        | 0 - Right - Find1stValue     | 0 - Right - Find1stValue     | 0 - Right - Find1stValue     |\n\n" +
             "| Find2ndValue                 | 0 - Stop - 1oneFound         | 1 - Stop - Find3rdValue      | 1 - Stop - Find3rdValue      |\r\n" +
             "| Find1stValue                 | 1 - Stop - Find3rdValue      | 1 - Right - Find2ndValue     | 1 - Right - Find2ndValue     |\n" +
             "| Find3rdValue                 | 1 - Right - Find2ndValue     | 1 - Right - 1oneFound        | 1 - Right - 1oneFound        |\n" +
             "|                              | 1 - Right - 1oneFound        | 1 - Right - 1oneFound        |   - Stop -                   |\n";

  var tm = defaultTuringMachine();

  foswiki.read(tm, text);

  function check(tm) {
    assert.ok(tm.getStep() === 0);
    assert.ok(tm.getMachineName() === 'machine 9077');
    assert.ok(tm.getState().equals(state('Start')));
    assert.ok(
      UnorderedSet(tm.getFinalStates().map(toStr))
        .equals(["End", "Final", "1oneFound", "2onesFound"])
    );

    assert.ok(tm.getTape().getBlankSymbol().equals(symbol('0')));
    assert.ok(tm.getTape().read().equals(symbol('1')));
    assert.ok(tm.getTape().toJSON()['data'].length === 5);
    assert.ok(tm.getTape().read(position(1)).equals(symbol('0')));

    assert.ok(tm.getProgram().get(symbol("0"), state("Find1stValue")).equals(
      instrtuple(symbol("1"), motion("S"), state("Find3rdValue"))
    ));
    assert.ok(tm.getProgram().get(symbol(" "), state("")).equals(
      instrtuple(symbol(""), motion("S"), state(" "))
    ));
  }

  check(tm);
  tm.fromJSON(tm.toJSON());
  check(tm);
});