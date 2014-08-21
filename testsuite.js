// ------------------------------ Test suite ------------------------------

function testsuite()
{
  var testcases = {
    testRequireAndDefaults : function () {
      require(true);
      require(true, "Hello World");
      require(def(undefined, 5) === 5);
      require(def(6, 5) === 6);
    },

    testIntegerArrayEqual : function () {
      require(integerArrayEqual(new Array(16), new Array(16)));
      require(integerArrayEqual([1, 5, 9], [1, 5, 9]));
      require(!integerArrayEqual([1, "5", 9], [1, 5, 9]));
      require(!integerArrayEqual([1, 5, 10], [1, 5, 9]));
      require(!integerArrayEqual([0], [1]));
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
      require(integerArrayEqual(s.toJSON(), [3]));
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
      require(integerArrayEqual(s.toJSON(), [2, 4]));
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
      require(integerArrayEqual(s.toJSON(), [2, 4, 6]));
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
      var s1 = new State("Z1");
      var s2 = new State("Z1");
      var s3 = new State("State 123456789/2936538");
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
      var p1 = pos(5);
      var p2 = pos(-5);
      var p3 = pos(5);
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
      var state = new State("State 13579");
      var state2 = new State("State 135791113151719");

      var it1 = new InstrTuple(write, move, state);
      var it2 = new InstrTuple(write, move, state);
      var it3 = new InstrTuple(write, move, state2);

      require(it1.equals(it2));
      require(!it1.equals(it3));

      require(isInstruction(it1));
      require(isInstruction(it2));
      require(isInstruction(it3));
      require(!isInstruction(5));
    },

    // ------------------------------ program ------------------------------

    testProgram : function () {
      var begin = new State("Start");
      var end = new State("End");
      var move = new Movement("left");
      var move2 = new Movement("Right");
      var program = Program();

      require(!program.isDefined("0", begin));
      for (var i = 0; i < 2; i++) {
        program.update("0", begin, "1", move, end);
        program.update("1", end, "1", move2, end);
        require(program.isDefined("0", begin));

        var ref = program.get("0", begin);
        program.update("0", begin, "1", move2, end);
        require(!program.get("0", begin).equals(ref));
        require(program.get("0", begin).equals(new InstrTuple("1", move2, end)));

        program.fromJSON(program.toJSON());
      }

      var spec = {"write" : "1", "move" : move2.toJSON()};
      require(program.query({"write" : "1"}).length === 2);
      program.update("1", end, "1", move, end);
      require(program.query(spec).length === 1);
      require(program.query({"write" : "0"}).length === 0);

      // should at least not trigger any errors
      var p = new Program();
      p.update("0", new State("Start"), "1", new Movement("R"), new State("Z1"));
      p.update("0", new State("End"), "1", new Movement("L"), new State("Z1"));
      p.update("1", new State("Start"), "2", new Movement("R"), new State("Z1"));
      p.update("0", new State("Z2"), "3", new Movement("R"), new State("Z3"));
      //console.debug(p.toTWiki());
      p.fromTWiki(p.toTWiki());
    },

    // ------------------------------- tape -------------------------------

    testSimpleTapeRL : function () {
      var t = new Tape();
      t.write(4);
      t.right();
      require(t.position().equals(pos(1)));
      t.write(5);
      require(t.read() === 5);
      t.left();
      require(t.read() === 4);
      require(t.position().equals(pos(0)));
      require(t.begin().equals(pos(0)));
      require(t.end().equals(pos(1)));
    },

    testSimpleTapeLR : function () {
      var t = new Tape();
      t.write(4);
      t.left();
      require(t.position().equals(pos(-1)));
      t.write(5);
      require(t.read() === 5);
      t.right();
      require(t.read() === 4);
      require(t.position().equals(pos(0)));
      require(t.begin().equals(pos(-1)));
      require(t.end().equals(pos(0)));
    },

    testSimpleTapeWalk : function () {
      var t = new Tape('42');
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

      require(t.position().equals(pos(100)));
      require(t.begin().equals(pos(0)));
      require(t.end().equals(t.position()));
      require(t.size() === 101);
      t.left();
      var dump = t.toJSON();

      t = new Tape();
      t.fromJSON(dump);
      t.right();
      require(t.position().equals(pos(100)));
      require(t.begin().equals(pos(0)));
      require(t.end().equals(t.position()));
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

    testHumanReadableString : function () {
      var t = new Tape();
      var test = "098765*4*3a21";
      var symbs = test.split('').filter(function (v) { return v !== "*"; });
      t.fromHumanString(test);

      require(t.position().equals(pos(0)));
      require(t.size() === 11);
      require(t.begin().equals(pos(-6)));
      require(t.end().equals(pos(4)));

      for (var i = 0; i < 6; i++)
        t.left();
      for (var i = 0; i < symbs.length; i++) {
        require(t.read() === symbs[i]);
        require(t.position().equals(pos(i - 6)));
        t.right();
      }
    },

    testRecordedTapeSimpleUndo : function () {
      var t = new RecordedTape('0', 30);
      t.left();
      t.write(5);
      t.left();
      require(t.position().equals(pos(-2)));
      t.undo();
      require(t.position().equals(pos(0)));
      require($.inArray(5, t.toJSON().data) === -1);
    },

    testRecordedTapeTwoFrames : function () {
      var t = new RecordedTape('0', 30);
      t.left();
      t.left();
      t.snapshot();
      require(t.position().equals(pos(-2)));
      t.right();
      require(t.position().equals(pos(-1)));

      t.undo();
      require(t.position().equals(pos(-2)));
      t.undo();
      require(t.position().equals(pos(0)));
    },

    testRecordedTape20UndosAndRedos : function () {
      var t = new RecordedTape('0', 30);
      for (var i = 0; i < 20; i++) {
        t.left();
        t.snapshot();
      }
      require(t.position().equals(pos(-20)));
      t.right();
      require(t.position().equals(pos(-19)));
      t.undo();
      require(t.position().equals(pos(-20)));
      for (var i = 0; i < 20; i++) {
        t.undo();
      }
      require(t.position().equals(pos(0)));
    },

    testRecordedTapeContentUndoTest : function () {
      var t = new RecordedTape('0', 30);
      t.write(0);
      t.left();
      t.snapshot();
      t.write(1);
      t.left();
      t.snapshot();
      t.write(2);
      require(t.position().equals(pos(-2)));
      require(t.read() === 2);
      t.undo();
      require(t.position().equals(pos(-2)));
      require(t.read() === '0');
      t.undo();
      require(t.position().equals(pos(-1)));
      require(t.read() === '0');
      t.undo();
      require(t.position().equals(pos(0)));
      require(t.read() === '0');
    },

    testRecordedTapeAlternate : function () {
      var t = new RecordedTape('0', 30);
      t.left();
      t.left();
      t.snapshot();
      require(t.position().equals(pos(-2)));
      t.right();
      t.right();
      t.right();
      t.right();
      t.snapshot();
      require(t.position().equals(pos(2)));
      t.left();
      require(t.position().equals(pos(1)));

      t.undo(); // undo the left
      t.undo(); // undo 4 right-s
      require(t.position().equals(pos(-2)));
      t.right();
      require(t.position().equals(pos(-1)));

      t.left();
      t.left();
      t.left();
      t.snapshot();
      require(t.position().equals(pos(-4)));

      t.undo(); // "undo" require
      t.undo(); // undo {right right right left} and jump to beginning
      require(t.position().equals(pos(0)));
    },

    testRecordedTapeImportExport : function () {
      var t = new RecordedTape('0', 30);
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

      require(t2.position().equals(pos(-5)));
      t2.undo();
      require(t2.position().equals(pos(0)));
      require(t.position().equals(pos(-5)));
    },

    /*testRecordedTapeSimplifyHistory : function () {
      var t = new RecordedTape('0', 30);

      var input = [['LEFT', 0], ['LEFT', 1], ['LEFT', 2], ['LEFT', 3]];
      var output = [['LEFT', 6]];
      var result = t.simplifyHistoryFrame(input);
      for (var i = 0; i < result.length; i++)
        require(result[i][0] === output[i][0] && result[i][1] === output[i][1]);
      require(result.length === output.length);

      var input = [['LEFT', 0], ['RIGHT', 1], ['LEFT', 2], ['RIGHT', 3]];
      var output = [['RIGHT', 1], ['LEFT', 2], ['RIGHT', 3]];
      var result = t.simplifyHistoryFrame(input);
      for (var i = 0; i < result.length; i++)
        require(result[i][0] === output[i][0] && result[i][1] === output[i][1]);
      require(result.length === output.length);

      var input = [['RIGHT', 0], ['LEFT', 1], ['LEFT', 2], ['RIGHT', 3]];
      var output = [['LEFT', 3], ['RIGHT', 3]];
      var result = t.simplifyHistoryFrame(input);
      for (var i = 0; i < result.length; i++)
        require(result[i][0] === output[i][0] && result[i][1] === output[i][1]);
      require(result.length === output.length);
    },*/

    testRecordedTapeMathWalkWithImportExport : function () {
      var t = RecordedTape(true, 0);
      this.testSimpleTapeMathWalkWithImportExport(t);
    },

    testExtendedTape : function () {
      var t = new ExtendedTape('0', Infinity);
      require(t.read() === '0');
      require(t.read(pos(-2)) === '0');
      require(t.read(pos(2)) === '0');
      t.write('1', pos(2));
      require(t.read(pos(2)) === '1');
      t.clear();
      require(t.read(pos(-2)) === '0');
      require(t.read(pos(2)) === '0');
      require(t.read(pos(3)) === '0');
    },

    testExtendedTapeMoveTo : function () {
      var t = new ExtendedTape('1', Infinity);
      var values = '0123456789';
      for (var i = 0; i < 10; i++) {
        t.write(values[i]);
        t.right();
      }

      var base = t.position();
      t.moveTo(pos(0));
      require(t.read() === '0');
      t.moveTo(pos(7));
      require(t.read() === '7');
      t.moveTo(pos(10));
      require(t.read() === '1');
      t.moveTo(base);

      for (var i = 9; i >= 0; i--) {
        t.left()
        require(t.read() === values[i]);
      }

      require(t.begin().equals(pos(0)));
      require(t.end().equals(pos(10)));
    },

    testExtendedTapeShift : function () {
      var t = new ExtendedTape('1', Infinity);
      var values = '0123456789';
      for (var i = 0; i < 10; i++) {
        t.write(values[i]);
        t.right();
      }

      var base = t.position();
      t.leftShift(10);
      require(t.read() === '0');
      t.rightShift(7);
      require(t.read() === '7');
      t.rightShift(3);
      require(t.read() === '1');
      t.moveTo(base);

      for (var i = 9; i >= 0; i--) {
        t.left()
        require(t.read() === values[i]);
      }

      require(t.begin().equals(pos(0)));
      require(t.end().equals(pos(10)));
      require(t.size() === 11);
    },

    testExtendedTapeForEach : function () {
      var t = new ExtendedTape('1', Infinity);
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

      var base = t.position();
      t.leftShift(10);
      require(t.read() === '0');
      t.rightShift(7);
      require(t.read() === '7');
      t.rightShift(3);
      require(t.read() === '1');
      t.moveTo(base);

      for (var i = 9; i >= 0; i--) {
        t.left()
        require(t.read() === values[i]);
      }

      require(t.begin().equals(pos(0)));
      require(t.end().equals(pos(10)));
      require(t.size() === 11);
    },

    testExtendedTapeMathWalkWithImportExport : function () {
      var t = ExtendedTape(true, 0);
      this.testSimpleTapeMathWalkWithImportExport(t);
    },

    testUFTapeSetByString : function () {
      var t = UserFriendlyTape(true, Infinity);
      var str = "0123987259876234";
      t.setByString(str);
      require(t.position().equals(pos(0)));
      t.moveTo(pos(0));
      for (var i = 0; i < str.length; i++) {
        require(t.read() === str[i]);
        t.right();
      }
    },

    testUFTapeSetByArray : function () {
      var t = UserFriendlyTape(true, Infinity);
      var array = [4, 9, "Hello", "World", Infinity, null];
      t.setByString(array);
      for (var i = 0; i < array.length; i++) {
        require(t.read() === array[i]);
        t.right();
      }
    },

    testUFTapeMathWalkWithImportExport : function () {
      var t = UserFriendlyTape(true, 0);
      this.testSimpleTapeMathWalkWithImportExport(t);
    },

    genericTapeTest : function (inst, inst2) {
      // check initial state
      require(inst.position().equals(pos(0)));
      require(inst.default_value === "_");
      require(inst.begin().equals(pos(0)));
      require(inst.end().equals(pos(0)));
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
      require(inst.position().equals(pos(10)));
      for (var i = 10; i >= -9; i--) {
        require(inst.read() === st[i + 9]);
        require(inst.position().equals(pos(i)));
        inst.left();
      }
      require(inst.begin().equals(pos(-10)));
      require(inst.end().equals(pos(10)));
      require(inst.size() === st.length + 1);
      require(inst.position().equals(pos(-10)));

      inst2.fromJSON(inst.toJSON());
      for (var i = -10; i < 10; i++)
        inst2.right();

      // check final state of second instance
      require(inst2.position().equals(pos(10)));
      for (var i = 10; i >= -9; i--) {
        require(inst2.read() === st[i + 9]);
        require(inst2.position().equals(pos(i)));
        inst2.left();
      }
      require(inst2.begin().equals(pos(-10)));
      require(inst2.end().equals(pos(10)));
      require(inst2.size() === st.length + 1);
      require(inst2.position().equals(pos(-10)));
    },

    testGenericTapeBehavior : function () {
      this.genericTapeTest(new Tape("_"), new Tape());
      this.genericTapeTest(new RecordedTape("_"), new RecordedTape());
      this.genericTapeTest(new ExtendedTape("_"), new ExtendedTape());
    }
  };

  var keys = Object.getOwnPropertyNames(testcases);
  var key = 0;
  try {
    for (key in keys) {
      if (keys[key].slice(0, 4) === 'test')
        testcases[keys[key]]();
    }
  } catch (e) {
    console.warn("Testsuite FAILED: Test " + keys[key] + " failed.");
    console.error("Error message: " + e.message);
    if (e.stack)
      console.log("Backtrace:" + e.stack.substring(e.stack.indexOf("\n")));
    throw e;
  }
  console.info("Testsuite successfully passed");
}
