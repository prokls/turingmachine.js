// ------------------------------ Test suite ------------------------------

function testsuite()
{
  var tape_testcases = {
    testRequireAndDefaults : function () {
      require(true);
      require(true, "Hello World");
      require(def(undefined, 5) === 5);
      require(def(6, 5) === 6);
    },

    testArrayEqualIdentity : function () {
      require(arrayEqualIdentity(new Array(16), new Array(16)));
      require(arrayEqualIdentity([1, 5, 9], [1, 5, 9]));
      require(!arrayEqualIdentity([1, "5", 9], [1, 5, 9]));
      require(!arrayEqualIdentity([1, 5, 10], [1, 5, 9]));
      require(!arrayEqualIdentity([0], [1]));
    },

    testInherit : function () {
      var ctor = function () {
        return { truth : 41, failure : true, method : function() { return 1; } };
      };
      var obj = new ctor();
      obj.failure = false;

      var obj2 = inherit(obj, { truth : 42 });

      require(obj2.failure === false);
      require(obj2.truth === 42);
      require(obj2.method() === 1);
    },

    testNormalizeSymbol : function () {
      require(normalizeSymbol("abc") === "abc");
      require(normalizeSymbol("  ") === " ");
      require(normalizeSymbol("\t") === " ");
      require(normalizeSymbol("x") === " ");
      require(normalizeSymbol("_x_ (leer)") === " ");
    },

    testRepeat : function () {
      require(repeat("a", 2) === "aa");
      require(repeat("ab", 1) === "ab");
      require(repeat("aa", 5) === "aaaaaaaaaa");
    },

    // ---------------------------- OrderedSet ----------------------------

    testOrderedSetBasic : function () {
      var s = new OrderedSet();
      require(s.push(3));
      require(arrayEqualIdentity(s.toJSON(), [3]));
      require(s.toJSON()[0] === 3);
      require(s.contains(3));
      require(!s.contains(4));
      require(s.size() === 1);
      require(s.toString().indexOf("3") !== -1);
    },

    testOrderedSet2Elements : function () {
      var s = new OrderedSet();
      require(s.push(4));
      require(s.push(2));
      require(arrayEqualIdentity(s.toJSON(), [2, 4]));
      require(s.toJSON()[0] === 2);
      require(!s.contains(1));
      require(s.contains(2));
      require(!s.contains(3));
      require(s.contains(4));
      require(!s.contains(5));
      require(s.size() === 2);
      require(s.toString().indexOf("4") !== -1 &&
              s.toString().indexOf("2") !== -1);
    },

    testOrderedSet3Elements : function () {
      var s = new OrderedSet([6]);
      require(s.push(2));
      require(s.push(4));
      require(arrayEqualIdentity(s.toJSON(), [2, 4, 6]));
      require(s.toJSON()[1] === 4);
      require(!s.contains(1));
      require(s.contains(2));
      require(!s.contains(3));
      require(s.contains(4));
      require(!s.contains(5));
      require(s.contains(6));
      require(!s.contains(7));
      require(s.size() === 3);
      require(s.toString().indexOf("2") &&
              s.toString().indexOf("4") !== -1 &&
              s.toString().indexOf("6") !== -1);
    },

    testOrderedSetAuto : function () {
      var from = -5, to = 100;
      for (var i = 0; i < 20; i++) {
        var s = new OrderedSet();
        for (var j = 0; j < i; j++) {
          s.push(j);
        }
        require(s.size() === i);
        for (var j = from; j < to; j++) {
          require(s.contains(j) === (0 <= j && j < i));
        }
        for (var j = 0; j < i; j++) {
          require(s.size() === i - j);
          require(s.remove(j));
        }
        require(s.size() === 0);
      }
    },

    testOrderedSetRemove : function () {
      var s4 = new OrderedSet([6]);
      require(s4.contains(6));
      require(s4.remove(6));
      require(!s4.remove(6));
      require(s4.push(2));
      require(!s4.push(2));
      require(s4.push(4));
      require(s4.push(6));
      require(s4.push(8));
      require(s4.remove(6));
      require(s4.size() === 3);
      require(s4.contains(4) && !s4.contains(6) && s4.contains(8));
    },

    // ---------------------------- TM elements ----------------------------

    testStateObject : function () {
      var s1 = state("Z1");
      var s2 = state("Z1");
      var s3 = state("State 123456789/2936538");
      require(s1.equals(s2));
      require(!s1.equals(s3));

      require(isState(s1));
      require(isState(s2));
      require(isState(s3));
      require(!isState({}));
    },

    testMovementObject : function () {
      var move1 = new Movement("L");
      var move2 = new Movement("R");
      var move3 = mov.LEFT;
      var move4 = new Movement("LEFT");

      require(move1.equals(move1));
      require(!move1.equals(move2));
      require(move1.equals(move3));
      require(move1.equals(move4));

      require(isMovement(move1));
      require(isMovement(move2));
      require(isMovement(move3));
      require(isMovement(move4));
      require(!isMovement({}));
    },

    testPositionObject : function () {
      var p1 = position(5);
      var p2 = position(-5);
      var p3 = position(5);
      require(p1.equals(p3));
      require(p1.sub(10).equals(p2));
      require(p2.add(10).equals(p1));

      require(isPosition(p1));
      require(isPosition(p2));
      require(isPosition(p3));
      require(!isPosition(undefined));
    },

    testInstrTupleObject : function () {
      var write = '1';
      var move = new Movement(mov.RIGHT);
      var state1 = state("State 13579");
      var state2 = state("State 135791113151719");

      var it1 = new InstrTuple(write, move, state1);
      var it2 = new InstrTuple(write, move, state1);
      var it3 = new InstrTuple(write, move, state2);

      require(it1.equals(it2));
      require(!it1.equals(it3));

      require(isInstruction(it1));
      require(isInstruction(it2));
      require(isInstruction(it3));
      require(!isInstruction(5));
    },

    // ------------------------------- tape -------------------------------

    testSimpleTapeRL : function (t) {
      t = def(t, new Tape());
      t.write(4);
      t.right();
      require(t.cursor().equals(position(1)));
      t.write(5);
      require(t.read() === 5);
      t.left();
      require(t.read() === 4);
      require(t.cursor().equals(position(0)));
      require(t.begin().equals(position(0)));
      require(t.end().equals(position(1)));
    },

    testSimpleTapeLR : function (t) {
      t = def(t, new Tape());
      t.write(4);
      t.left();
      require(t.cursor().equals(position(-1)));
      t.write(5);
      require(t.read() === 5);
      t.right();
      require(t.read() === 4);
      require(t.cursor().equals(position(0)));
      require(t.begin().equals(position(-1)));
      require(t.end().equals(position(0)));
    },

    testSimpleTapeWalk : function (t) {
      t = def(t, new Tape('42'));
      for (var i = 0; i < 100; i++)
        t.left();
      require(t.read() === '42');
      for (var i = 0; i < 200; i++)
        t.right();
      require(t.read() === '42');
      require(t.size() === 201);
    },

    testSimpleTapeMathWalkWithImportExport : function (t) {
      t = def(t, new Tape(true));
      for (var i = 0; i < 100; i++)
      {
        if (i % 34 !== 0)
          t.write((i + 37) % 41);
        t.right();
      }

      require(t.cursor().equals(position(100)));
      require(t.begin().equals(position(0)));
      require(t.end().equals(t.cursor()));
      require(t.size() === 101);
      t.left();
      var dump = t.toJSON();

      t = new Tape();
      t.fromJSON(dump);
      t.right();
      require(t.cursor().equals(position(100)));
      require(t.begin().equals(position(0)));
      require(t.end().equals(t.cursor()));
      require(t.size() === 101);
      t.left();

      for (var i = 99; i >= 0; i--)
      {
        if (i % 34 === 0)
          require(t.read() === true);
        else
          require(t.read() === ((i + 37) % 41));
        t.left();
        t.left();
        t.right();
      }
    },

    testSimpleTapeHumanReadableString : function (t) {
      t = def(t, new Tape());
      var test = "0,9,8,7,6,5, *4*,3,a,2,1";
      var symbs = ['0', '9', '8', '7', '6', '5', '4',
                   '3', 'a', '2', '1'];
      t.fromHumanString(test);

      require(t.cursor().equals(position(0)));
      require(t.size() === 11);
      require(t.begin().equals(position(-6)));
      require(t.end().equals(position(4)));

      for (var i = 0; i < 6; i++)
        t.left();
      for (var i = 0; i < symbs.length; i++) {
        require(t.read() === symbs[i]);
        require(t.cursor().equals(position(i - 6)));
        t.right();
      }
    },

    testRecordedTapeCompatibility : function () {
      this.testSimpleTapeRL(new RecordedTape());
      this.testSimpleTapeLR(new RecordedTape());
      this.testSimpleTapeWalk(new RecordedTape('42'));
      this.testSimpleTapeMathWalkWithImportExport(new RecordedTape(true));
      this.testSimpleTapeHumanReadableString(new RecordedTape());
    },

    testRecordedTapeSimpleUndo : function (t) {
      t = def(t, new RecordedTape('0', 30));
      t.left();
      t.write(5);
      t.left();
      require(t.cursor().equals(position(-2)));
      t.undo();
      require(t.cursor().equals(position(0)));
      require($.inArray(5, t.toJSON().data) === -1);
    },

    testRecordedTapeTwoSnapshots : function (t) {
      t = def(t, new RecordedTape('0', 30));
      t.left();
      t.left();
      t.snapshot();
      require(t.cursor().equals(position(-2)));
      t.right();
      require(t.cursor().equals(position(-1)));

      t.undo();
      require(t.cursor().equals(position(-2)));
      t.undo();
      require(t.cursor().equals(position(0)));

      try {
        t.undo();
        require(false);
      } catch (e) {
        return;
      }
    },

    testRecordedTape20UndosAndRedos : function (t) {
      t = def(t, new RecordedTape('0', 30));
      for (var i = 0; i < 20; i++) {
        t.left();
        t.snapshot();
      }
      require(t.cursor().equals(position(-20)));
      t.right();
      require(t.cursor().equals(position(-19)));
      t.undo();
      require(t.cursor().equals(position(-20)));
      for (var i = 0; i < 15; i++) {
        t.undo();
      }
      require(t.cursor().equals(position(-5)));
      for (var i = 0; i < 5; i++) {
        t.undo();
      }
      require(t.cursor().equals(position(0)));
    },

    testRecordedTapeLRWithSnapshots : function (t) {
      t = def(t, new RecordedTape('0', 30));
      for (var i = 0; i < 50; i++) {
        if (i % 2 == 0) {
          t.right(i);
          t.snapshot();
        } else
          t.left(i);
        t.write(i);
      }

      require(t.getHistory().map(function (v) { return v.length; })
        .reduce(function (a, b) { return a + b; }) === 100);
      require(t.getHistory().length === 26);
      require(t.begin().equals(position(-25)));
      require(t.end().equals(position(24)));
      require(t.size() === 50);
    },

    testRecordedTapeAlternate : function (t) {
      t = def(t, new RecordedTape('0', 30));
      t.left();
      t.left();
      t.snapshot();
      require(t.cursor().equals(position(-2)));
      t.right();
      t.right();
      t.right();
      t.right();
      t.snapshot();
      require(t.cursor().equals(position(2)));
      t.left();
      require(t.cursor().equals(position(1)));

      t.undo(); // undo the left
      t.undo(); // undo 4 right-s
      require(t.cursor().equals(position(-2)));
      t.right();
      require(t.cursor().equals(position(-1)));

      t.left();
      t.left();
      t.left();
      t.snapshot();
      require(t.cursor().equals(position(-4)));

      t.undo(); // "undo" require
      t.undo(); // undo {right right right left} and jump to beginning
      require(t.cursor().equals(position(0)));
    },

    testRecordedTapeImportExport : function (t) {
      t = def(t, new RecordedTape('0', 30));
      t.left();
      t.left();
      t.snapshot();
      t.right();
      t.right();
      t.right();
      t.right();
      t.snapshot();
      t.left();

      t.undo();
      t.undo();

      t.left();
      t.left();
      t.left();

      var t2 = new RecordedTape('0', 30);
      t2.fromJSON(t.toJSON());

      require(t2.cursor().equals(position(-5)));
      t2.undo();
      require(t2.cursor().equals(position(0)));
      require(t.cursor().equals(position(-5)));
    },

    testExtendedTapeCompatibility : function () {
      this.testSimpleTapeRL(new ExtendedTape());
      this.testSimpleTapeLR(new ExtendedTape());
      this.testSimpleTapeWalk(new ExtendedTape('42'));
      this.testSimpleTapeMathWalkWithImportExport(new ExtendedTape(true));
      this.testSimpleTapeHumanReadableString(new ExtendedTape());
      this.testRecordedTapeSimpleUndo(new ExtendedTape('0', 30));
      this.testRecordedTapeTwoSnapshots(new ExtendedTape('0', 30));
      this.testRecordedTape20UndosAndRedos(new ExtendedTape('0', 30));
      this.testRecordedTapeLRWithSnapshots(new ExtendedTape('0', 30));
      this.testRecordedTapeAlternate(new ExtendedTape('0', 30));
      this.testRecordedTapeImportExport(new ExtendedTape('0', 30));
    },

    testExtendedTape : function (t) {
      t = def(t, new ExtendedTape('0', Infinity));
      require(t.read() === '0');
      require(t.read(position(-2)) === '0');
      require(t.read(position(2)) === '0');
      t.write('1', position(2));
      require(t.read(position(2)) === '1');
      require(t.cursor().equals(position(0)));
      require(t.size() === 5);
      t.clear();
      require(t.size() === 5); // intended behavior
      require(t.read(position(-2)) === '0');
      require(t.read(position(2)) === '0');
      require(t.read(position(3)) === '0');
    },

    testExtendedTapeMoveTo : function (t) {
      t = def(t, new ExtendedTape('1', Infinity));
      var values = '0123456789';
      for (var i = 0; i < 10; i++) {
        t.write(values[i]);
        t.right();
      }

      var base = t.cursor();
      t.moveTo(position(0));
      require(t.read() === '0');
      t.moveTo(position(7));
      require(t.read() === '7');
      t.moveTo(position(10));
      require(t.read() === '1');
      t.moveTo(base);

      for (var i = 9; i >= 0; i--) {
        t.left()
        require(t.read() === values[i]);
      }

      require(t.begin().equals(position(0)));
      require(t.end().equals(position(10)));
    },

    testExtendedTapeMove : function (t) {
      t = def(t, new ExtendedTape('1', Infinity));
      t.move(new Movement('l'));
      t.move(new Movement('l'));
      t.move(new Movement('l'));
      t.move(new Movement('l'));
      t.move(new Movement('r'));
      t.move(new Movement('s'));
      t.move(new Movement('l'));
      require(t.cursor().equals(position(-4)));
    },

    testExtendedTapeGetAlphabet : function (t) {
      t = def(t, new ExtendedTape(null, Infinity));
      var string = "012345678955555abcdef";
      var set = new OrderedSet();
      for (var i = 0; i < string.length; i++) {
        t.left();
        t.write(string[i]);
        set.push(string[i]);
      }
      set.push(null);

      var alphabet = t.getAlphabet();
      require(alphabet.equals(set));
    },

    testExtendedTapeForEach : function (t) {
      var t = def(t, new ExtendedTape('1', Infinity));
      var values = '0123456789';
      for (var i = 0; i < 10; i++) {
        t.write(values[i]);
        t.right();
      }

      var sum = 0;
      t.forEach(function (pos, v) {
        sum += pos.index * parseInt(v);
      });
      require(sum === 295);

      var base = t.cursor();
      t.left(10);
      require(t.read() === '0');
      t.right(7);
      require(t.read() === '7');
      t.right(3);
      require(t.read() === '1');
      t.moveTo(base);

      for (var i = 9; i >= 0; i--) {
        t.left()
        require(t.read() === values[i]);
      }

      require(t.begin().equals(position(0)));
      require(t.end().equals(position(10)));
      require(t.size() === 11);
    },

    testExtendedTapeEquals : function (t1, t2, t3) {
      var t1 = def(t1, new ExtendedTape('1', Infinity));
      var t2 = def(t2, new ExtendedTape('1', Infinity));
      var t3 = def(t3, new ExtendedTape('2', Infinity));

      for (var i = 0; i < 10; i++) {
        t1.left(i * 5 % 4);
        t1.write(i);
        t2.left(i * 5 % 4);
        t2.write(i);
        t3.left(i * 5 % 4);
        t3.write(i);
      }

      require(t1.read() === t2.read());
      require(t1.read() === t3.read());
      require(t1.equals(t2));
      require(!t1.equals(t3));
      require(!t2.equals(t3));

      t2.write("6");
      require(!t1.equals(t2));
    },

    testUFTapeCompatibility : function () {
      this.testSimpleTapeRL(new UserFriendlyTape());
      this.testSimpleTapeLR(new UserFriendlyTape());
      this.testSimpleTapeWalk(new UserFriendlyTape('42'));
      this.testSimpleTapeMathWalkWithImportExport(new UserFriendlyTape(true));
      this.testSimpleTapeHumanReadableString(new UserFriendlyTape());
      this.testRecordedTapeSimpleUndo(new UserFriendlyTape('0', 30));
      this.testRecordedTapeTwoSnapshots(new UserFriendlyTape('0', 30));
      this.testRecordedTape20UndosAndRedos(new UserFriendlyTape('0', 30));
      this.testRecordedTapeLRWithSnapshots(new UserFriendlyTape('0', 30));
      this.testRecordedTapeAlternate(new UserFriendlyTape('0', 30));
      this.testRecordedTapeImportExport(new UserFriendlyTape('0', 30));
      this.testExtendedTape(new UserFriendlyTape('0', Infinity));
      this.testExtendedTapeMoveTo(new UserFriendlyTape('1', Infinity));
      this.testExtendedTapeMove(new UserFriendlyTape('1', Infinity));
      this.testExtendedTapeGetAlphabet(new UserFriendlyTape(null, Infinity));
      this.testExtendedTapeForEach(new UserFriendlyTape('1', Infinity));
      this.testExtendedTapeEquals(
        new UserFriendlyTape('1', Infinity), new UserFriendlyTape('1', Infinity),
        new UserFriendlyTape('2', Infinity)
      );
    },

    testUFTapeRead : function (t) {
      var t = def(t, new UserFriendlyTape('0', 5));
      for (var i = 0; i < 5; i++) {
        t.write(-i);
        t.left();
      }
      t.moveTo(position(0));
      for (var i = 0; i < 5; i++) {
        require(t.read(position(-i)) === -i);
      }
      require(arrayEqualIdentity(t.read(position(-2), 5), [-4, -3, -2, -1, -0]));
      require(arrayEqualIdentity(t.read(position(-2), 4), [-3, -2, -1, -0]));
      require(arrayEqualIdentity(t.read(position(-2), 3), [-3, -2, -1]));
      require(arrayEqualIdentity(t.read(position(-2), 2), [-2, -1]));
      require(t.read(position(-2), 1) === -2);
      require(t.read(position(-2)) === -2);
      require(arrayEqualIdentity(t.read(undefined, 3), [-1, -0, '0']));
    },

    testUFTapeFromArray : function (t, str) {
      var t = def(t, new UserFriendlyTape(true, Infinity));
      var str = def(str, "0123987259876234");
      t.fromArray(str);
      require(t.cursor().equals(position(0)));
      require(t.read() === true);
      for (var i = 0; i < str.length; i++) {
        t.right();
        require(t.read() === str[i]);
      }
      t.right();
      require(t.read() === true);
    },

    testUFTapeSetByArray : function (t) {
      var t = def(t, new UserFriendlyTape(true, Infinity));
      var arr = [4, 9, "Hello", "World", Infinity, null];
      t.fromArray(arr);
      require(t.cursor().equals(position(0)));
      require(t.read() === true);
      for (var i = 0; i < arr.length; i++) {
        t.right();
        require(t.read() === normalizeSymbol(arr[i]));
      }
      t.right();
      require(t.read() === true);
    },

    testUFTapeToJSONFromJSON : function (t) {
      var t = def(t, new UserFriendlyTape('_', Infinity));
      for (var i = 0; i < 4; i++) {
        t.write(Math.pow(2, i));
        t.right();
      }
      var t2 = new UserFriendlyTape('_', Infinity);
      t2.fromJSON(t.toJSON());
      require(t2.toBitString() === '1248');
    },

    genericTapeTest : function (inst, inst2) {
      // check initial state
      require(inst.cursor().equals(position(0)));
      require(inst.getDefaultValue() === "_");
      require(inst.begin().equals(position(0)));
      require(inst.end().equals(position(0)));
      require(inst.size() === 1);

      var st = [18, 16, 14, 12, 10, 8, 6, 4, 2,
                "_", 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

      for (var i = 1; i < 20; i++) {
        for (var j = 0; j < i; j++)
          if (i % 2 === 0)
            inst.left();
          else
            inst.right();

        require(inst.read() === "_");
        inst.write(i);
        require(inst.read() === i);
      }

      // check final state
      require(inst.cursor().equals(position(10)));
      for (var i = 10; i >= -9; i--) {
        require(inst.read() === st[i + 9]);
        require(inst.cursor().equals(position(i)));
        inst.left();
      }
      require(inst.begin().equals(position(-10)));
      require(inst.end().equals(position(10)));
      require(inst.size() === st.length + 1);
      require(inst.cursor().equals(position(-10)));

      inst2.fromJSON(inst.toJSON());
      for (var i = -10; i < 10; i++)
        inst2.right();

      // check final state of second instance
      require(inst2.cursor().equals(position(10)));
      for (var i = 10; i >= -9; i--) {
        require(inst2.read() === st[i + 9]);
        require(inst2.cursor().equals(position(i)));
        inst2.left();
      }
      require(inst2.begin().equals(position(-10)));
      require(inst2.end().equals(position(10)));
      require(inst2.size() === st.length + 1);
      require(inst2.cursor().equals(position(-10)));
    },

    testGenericTapeBehavior : function () {
      this.genericTapeTest(new Tape("_"), new Tape());
      this.genericTapeTest(new RecordedTape("_"), new RecordedTape());
      this.genericTapeTest(new ExtendedTape("_"), new ExtendedTape());
      this.genericTapeTest(new UserFriendlyTape("_"), new UserFriendlyTape());
    }
  };

  var program_testcases = {
    testGetSet : function () {
      var prg = new Program();
      var states = [state("S1"), state("S2"),
                    state("end"), state("?")];
      var moves = [new Movement("l"), new Movement("Right"),
                   new Movement("Left"), new Movement("R")];
      var symbols = ['a', '0', null, false, 'long'];

      for (var i = 0; i < states.length; i++)
        for (var k = 0; k < symbols.length; k++) {
          var j = (((i + 3) * 9 * k) % moves.length);
          var instr = new InstrTuple(symbols[k], moves[j], states[i]);
          prg.set(symbols[k], states[i], instr);
        }

      for (var i = 0; i < states.length; i++)
        for (var k = 0; k < symbols.length; k++) {
          var j = (((i + 3) * 9 * k) % moves.length);
          var instr = new InstrTuple(symbols[k], moves[j], states[i]);
          var value = prg.get(symbols[k], states[i]);
          if (typeof value === 'undefined')
            require(false, "Did not find value");
          require(instr.equals(value));
        }
    },

    testClear : function () {
      var prg = new Program();
      var states = [state("S1"), state("S2"),
                    state("end"), state("?")];
      var moves = [new Movement("l"), new Movement("Right"),
                   new Movement("Left"), new Movement("R")];
      var symbols = ['a', 0, 'null', false, 'long'];

      for (var i = 0; i < states.length; i++)
        for (var k = 0; k < symbols.length; k++) {
          var j = (((i + 3) * 9 * k) % moves.length);
          var instr = new InstrTuple(symbols[k], moves[j], states[i]);
          prg.set(symbols[k], states[i], instr);
          require(prg.exists(symbols[k], states[i]));
        }

      prg.clear();

      for (var i = 0; i < states.length; i++)
        for (var k = 0; k < symbols.length; k++) {
          require(!prg.exists(symbols[k], states[i]));
        }
    },

    testToString : function () {
      var prg = new Program();
      var states = [state("S1"), state("S2"),
                    state("end"), state("?")];
      var moves = [new Movement("l"), new Movement("Right"),
                   new Movement("Left"), new Movement("R")];
      var symbols = ['a', '0', 'null', false, 'long'];

      for (var i = 0; i < states.length; i++)
        for (var k = 0; k < symbols.length; k++) {
          var j = (((i + 3) * 9 * k) % moves.length);
          var instr = new InstrTuple(symbols[k], moves[j], states[i]);
          prg.set(symbols[k], states[i], instr);
        }

      var str = prg.toString();

      require(str.indexOf("end") !== -1);
      require(str.indexOf("S2") !== -1);
      require(str.indexOf("long") !== -1);
      require(str.indexOf("a") !== -1);
      require(str.indexOf(null) !== -1);
    },

    testImportExport : function () {
      var prg = new Program();
      var states = [state("S1"), state("S2"),
                    state("end"), state("?")];
      var moves = [new Movement("l"), new Movement("Right"),
                   new Movement("Left"), new Movement("R")];
      var symbols = ['a', '0', 'null', false, 'long'];

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
            require(false, "Value is missing after export-import");
          require(value.equals(instr), "Different value retrieved");
        }
    }
  };

  var machine_testcases = {
    testSimple : function () {
      var tape = new UserFriendlyTape('0', 30);
      tape.fromArray(['1', '1']);
      var prg = new Program();
      prg.set("0", state("Start"), "1", new Movement("Right"), state("Start"));
      prg.set("1", state("Start"), "1", new Movement("Right"), state("S1"));
      prg.set("1", state("S1"), "1", new Movement("Right"), state("S1"));
      prg.set("0", state("S1"), "0", new Movement("Stop"), state("End"));

      var final_states = [state('End')];
      var initial_state = state("Start");

      var m = new Machine(prg, tape, final_states, initial_state, 100);

      m.addEventListener('runFinished', function () {
        require(m.getState().toString() === 'End');
        require(m.getCursor().equals(position(3)));
        var content = m.getTape().read(undefined, 10);
        var expected = ['0', '1', '1', '1', '0'];
        for (var i in expected)
          require(content[i] === expected[i]);
      });

      m.run();
    },

    testSeveralIterations : function () {
      var tape = new UserFriendlyTape('0', 30);
      tape.fromArray(['1', '1', '1', '1', '1', '1']);
      var prg = new Program();
      prg.set("0", state("Start"), "0", new Movement("Right"), state("Start"));
      prg.set("1", state("Start"), "1", new Movement("Right"), state("SearchRight"));
      prg.set("1", state("SearchRight"), "1", new Movement("Right"), state("SearchRight"));
      prg.set("0", state("SearchRight"), "0", new Movement("Left"), state("DeleteRight"));
      prg.set("1", state("DeleteRight"), "0", new Movement("Left"), state("SearchLeft"));
      prg.set("1", state("SearchLeft"), "1", new Movement("Left"), state("SearchLeft"));
      prg.set("0", state("SearchLeft"), "0", new Movement("Right"), state("DeleteLeft"));
      prg.set("1", state("DeleteLeft"), "0", new Movement("Right"), state("SearchRight"));
      prg.set("0", state("DeleteRight"), "0", new Movement("Halt"), state("End"));
      prg.set("0", state("DeleteLeft"), "0", new Movement("Halt"), state("End"));

      var final_states = [state("End")];
      var initial_state = state("Start");

      var m = new Machine(prg, tape, final_states, initial_state, 100);

      m.addEventListener('runFinished', function () {
        require(m.getState().toString() === 'End');
        require(m.getCursor().equals(position(3)));
        require(m.finished());
        var content = m.getTape().read(undefined, 20);
        for (var i in content) {
          require(content[i] === "0");
        }
      });

      m.run();
    },

    testEventsTerminateNicely : function () {
      var tape = new UserFriendlyTape('0', 30);
      tape.fromArray(['1']);
      var prg = new Program();
      prg.set("0", state("Start"), "2", new Movement("Right"), state("Write"));
      prg.set("1", state("Write"), "0", new Movement("Stop"), state("End"));

      var final_states = [state("End")];
      var initial_state = state("Start");

      var m = new Machine(prg, tape, final_states, initial_state, 100);
      m.setMachineName("machine!name");
      var elog = [];
      m.addEventListener('initialized', function (n) {
        elog.push(['init', n]);
      });
      m.addEventListener('valueWritten', function (old_val, new_val) {
        elog.push(['vw', old_val, new_val]);
      });
      m.addEventListener('stateUpdated', function (old_state, new_state) {
        elog.push(['su', old_state.toString(), new_state.toString()]);
      });
      m.addEventListener('movementFinished', function (mov) {
        elog.push(['mov', mov.toString()]);
      });
      m.addEventListener('finalStateReached', function (state) {
        elog.push(['isr', state.toString()]);
      });
      m.initialize();

      m.addEventListener('runFinished', function () {
        var expected = [
          ['init', 'machine!name'],
          ['vw', '0', '2'],
          ['mov', 'Right'],
          ['su', 'Start', 'Write'],
          ['vw', '1', '0'],
          ['mov', 'Stop'],
          ['su', 'Write', 'End'],
          ['isr', 'End']
        ];

        require(elog.length === expected.length);
        for (var e in elog) {
          require(elog[e].length === expected[e].length);
          for (var v in elog[e]) {
            require(elog[e][v] === expected[e][v], "Event log different: " +
              JSON.stringify(elog[e][v]) + " != " + JSON.stringify(expected[e][v]));
          }
        }
      });
      m.run();
    },

    testEventUndefinedInstruction : function () {
      var tape = new UserFriendlyTape('0', 30);
      tape.fromArray(['1']);
      var prg = new Program();
      prg.set("0", state("Start"), "1", new Movement("Right"), state("Next"));
      prg.set("1", state("Next"), "2", new Movement("Stop"), state("Unknown"));
      prg.set("0", state("Known"), "4", new Movement("Stop"), state("SemiKnown"));
      prg.set("4", state("SemiKnown"), "0", new Movement("Stop"), state("End"));

      var final_states = [state("End")];
      var initial_state = state("Start");

      var m = new Machine(prg, tape, final_states, initial_state, 10);
      var elog = [];
      m.addEventListener('stateUpdated', function (old_state, new_state) {
        elog.push(['stateupdated']);
      });
      m.addEventListener('undefinedInstruction', function (read_symbol, st) {
        elog.push(['injecting instruction', read_symbol, st]);
        return new InstrTuple("0", new Movement("Right"), state("Known"));
      });
      m.addEventListener('possiblyInfinite', function () {
        elog.push(['infinite?']);
        return true;
      });

      m.addEventListener('runFinished', function () {
        var expected = [
          ['stateupdated'],
          ['stateupdated'],
          ['injecting instruction', '2', 'Unknown'],
          ['stateupdated'],
          ['stateupdated'],
          ['stateupdated'],
          ['stateupdated'],
          ['stateupdated'],
          ['stateupdated'],
          ['stateupdated'],
          ['infinite?']
        ];

        require(m.finalStateReached() === false);
        require(m.undefinedInstructionOccured() === false);
        require(elog.length === expected.length);
        for (var e in elog) {
          require(elog[e].length === expected[e].length);
          for (var v in elog[e]) {
            require(elog[e][v] === expected[e][v], "Event log different: " +
              JSON.stringify(elog[e][v]) + " != " + JSON.stringify(expected[e][v]));
          }
        }
      });
      //m.run();
    },

    testClone : function () {
      var tape = new UserFriendlyTape('0', 30);
      tape.fromArray(['1', '1']);
      var prg = new Program();
      prg.set("0", state("Start"), "1", new Movement("Right"), state("S0"));
      prg.set("1", state("S0"), "1", new Movement("Right"), state("S1"));
      prg.set("1", state("S1"), "1", new Movement("Right"), state("S2"));
      prg.set("0", state("S2"), "0", new Movement("Stop"), state("End"));

      var final_states = [state('End')];
      var initial_state = state("Start");

      var m = new Machine(prg, tape, final_states, initial_state, 100);
      var m2 = m.clone();

      // modify original machine
      tape.fromArray(['2']);
      prg.set("1", state("S0"), "1", new Movement("Right"), state("Unknown"));
      final_states.pop();

      // Is clone fine?
      m.addEventListener('runFinished', function () {
        require(m2.getState().equals(state('End')));
        require(m2.getCursor().equals(position(3)));
        var content = m2.getTape().read(undefined, 10);
        var expected = ['0', '1', '1', '1', '0'];
        for (var i in expected)
          require(content[i] === expected[i]);
      });

      m2.run();
    },

    testUndoRedo : function () {
      var tape = new UserFriendlyTape('0', 30);
      tape.fromArray(['1', '1']);
      var prg = new Program();
      prg.set("0", state("Start"), "1", new Movement("Right"), state("S0"));
      prg.set("1", state("S0"), "1", new Movement("Right"), state("S1"));
      prg.set("1", state("S1"), "1", new Movement("Right"), state("S2"));
      prg.set("0", state("S2"), "3", new Movement("Stop"), state("End"));

      var final_states = [state('End')];
      var initial_state = state("Start");

      var m = new Machine(prg, tape, final_states, initial_state, 100);

      m.addEventListener('runFinished', function () {
        require(m.getState().equals(state('End')));
        require(m.finished());
        require(m.finalStateReached());
        require(m.getTape().read() === "3");

        m.prev();
        require(m.getState().equals(state('S2')));
        require(!m.finished());
        require(m.getTape().read() === "0");

        m.next();
        require(m.getState().equals(state("End")));
        require(m.finished());
        require(m.getTape().read() === "3");
      });

      m.run();
    },

    testClear : function () {
      var tape = new UserFriendlyTape('0', 30);
      tape.fromArray(['1', '1']);
      var prg = new Program();
      prg.set("0", state("Start"), "1", new Movement("Right"), state("S0"));
      prg.set("1", state("S0"), "1", new Movement("Right"), state("S1"));
      prg.set("1", state("S1"), "1", new Movement("Right"), state("S2"));
      prg.set("0", state("S2"), "3", new Movement("Stop"), state("End"));

      var m = new Machine(prg, tape, [state('End')], state("Start"), 100);

      var once = false;
      m.addEventListener('runFinished', function () {
        require(m.getState().equals(state('End')));
        require(m.finalStateReached());
        require(m.finished());
        require(!m.undefinedInstructionOccured());
        require(m.getTape().read() === "3");

        m.reset();
        require(m.getState().equals(state('Start')));
        require(!m.finished());
        require(m.getTape().read() === "0");

        if (once) {
          m.run();
          once = true;
        }
      });

      m.run();
    }
  };

  // TODO: duplicate code with TestcaseRunner._validateTapeContent
  function validateTapeContent(a_content, a_cursor, e_content, e_cursor)
  {
    var i = -e_cursor;
    while (i < e_content.length - e_cursor) {
      if (def(e_content[e_cursor + i], '0') !== def(a_content[a_cursor + i], '0'))
        return false;
      i++;
    }
    return true;
  };

  var foswiki_testcases = {
    testSimple : function () {
      var text = "   $ __Tape__: 0,1\n" +
                 "   $ __Name__: Machine name 3014-15-92\n" +
                 "\n" +
                 "|       | a             |  b          | c             |\n" +
                 "| Start | 0 - R - Start | 1 - R - End | 0 - L - Start |\n";

      var data = readFoswikiText(text);

      require(arrayEqualIdentity(data['program']['a']['Start'], ["0", "Right", "Start"]));
      require(arrayEqualIdentity(data['program']['b']['Start'], ["1", "Right", "End"]));
      require(arrayEqualIdentity(data['program']['c']['Start'], ["0", "Left", "Start"]));
      require(arrayEqualIdentity(data['state_history'], ['Start']));
      require(validateTapeContent(data['tape']['data'],
        data['tape']['cursor'], ['0', '1'], -1));
      require(arrayEqualIdentity(data['final_states'], ['End']));
      require(data['initial_state'] === 'Start');
      require(validateTapeContent(data['initial_tape']['data'],
        data['initial_tape']['cursor'], ['0', '1'], -1));
      require(data['undefined_instruction'] === false);
      require(data['name'] === 'Machine name 3014-15-92');
      require(data['step'] === 0);
    },

    testAdvanced : function () {
      var text = "   $ __Tape__: _0_,1,1,1,1,0\n" +
                 "   $ __Cursor__: 3\n" +
                 "   $ __Final states__: End, *Ende*,Stop\n" +
                 "   $ __State__: Start\n" +
                 "   $ __Name__: Example\n" +
                 "\n" +
                 "| | *a* | *b* | *c* |\n" +
                 "| *Start* | 0 - R - Start | 1 - *R* - End | _0_ - H - S0 |\n" +
                 "| *S0* | 1 - L - Start | 0 - __R__ - =S1= | ==0== - H - S1 |\n" +
                 "| S1 | 1 - R - Start | 0 - L - End | 0 - H - End |\n";

      var data = readFoswikiText(text);
      var tap = "011110".split("");

      function check(d) {
        require(d['program']['a']['Start'][0] === "0");
        require(d['program']['a']['Start'][1] === "Right");
        require(d['program']['a']['Start'][2] === "Start");
        require(arrayEqualIdentity(d['state_history'], ['Start']));
        require(validateTapeContent(d['tape']['data'],
          d['tape']['cursor'], tap, 3));
        require(arrayEqualIdentity(d['final_states'], ['End', 'Ende', 'Stop']));
        require(d['initial_state'] === 'Start');
        require(validateTapeContent(d['initial_tape']['data'],
          d['initial_tape']['cursor'], tap, 3));
        require(d['undefined_instruction'] === false);
        require(d['name'] === 'Example');
        require(d['step'] === 0);
      }

      var tape = new UserFriendlyTape('?', 1);
      tape.fromArray("097654321".split(""));
      var prg = new Program();
      var fs = [state('SomeTarget')];
      var tm = new Machine(prg, tape, fs, state("Somewhere"), 100);

      check(data);
      tm.fromJSON(data);
      data = readFoswikiText(toFoswikiText(tm));
      check(data);
    }
  };

  function run(testcases, name) {
    var methods = Object.getOwnPropertyNames(testcases);
    var successful = [];
    var method = '';

    try {
      for (var tc in methods)
        if (methods[tc].slice(0, 4) === 'test') {
          method = methods[tc];
          testcases[method]();
          successful.push(method);
        }
      console.info("Testsuite '" + name + "' passed successfully");
      return undefined;

    } catch (e) {
      if (e instanceof AssertionException)
        console.error(e.message + "\n" +
          "[" + name + "] Success for", successful, "\n" +
          "[" + name + "] Failure for " + method +
          (e.stack ? "\n\n" + e.stack : "")
        );
      else
        console.error(e);
      return e;
    }
  };

  var a = run(tape_testcases, 'tape');
  var b = run(program_testcases, 'program');
  var c = run(machine_testcases, 'machine');
  var d = run(foswiki_testcases, 'foswiki syntax');

  return a || b || c || d || "All testsuites passed successfully";
}
