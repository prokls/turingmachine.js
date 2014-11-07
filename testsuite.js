// ------------------------------ Test suite ------------------------------

function testsuite()
{
  var tape_testcases = {
    // ------------------------------- tape -------------------------------

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

    testGenericTapeBehavior : function () {
      this.genericTapeTest(new Tape("_"), new Tape());
      this.genericTapeTest(new RecordedTape("_"), new RecordedTape());
      this.genericTapeTest(new ExtendedTape("_"), new ExtendedTape());
      this.genericTapeTest(new UserFriendlyTape("_"), new UserFriendlyTape());
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

      var invoked = false;
      m.addEventListener('runFinished', function () {
        invoked = true;
        require(m.getState().toString() === 'End');
        require(m.getCursor().equals(position(3)));
        var content = m.getTape().read(undefined, 10);
        var expected = ['0', '1', '1', '1', '0'];
        for (var i in expected)
          require(content[i] === expected[i]);
      });

      m.run();
      setTimeout(function () {
        require(invoked, 'Test failed. runFinished not invoked');
      }, 500);
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
      prg.set("0", state("DeleteRight"), "0", new Movement("Stop"), state("End"));
      prg.set("0", state("DeleteLeft"), "0", new Movement("Stop"), state("End"));

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
        require(m.undefinedInstruction() === false);
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

    /*testUndoRedo : function () {
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
    },*/

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
        require(m.undefinedInstruction());
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
  var c = run(machine_testcases, 'machine');

  return a || c || "All testsuites passed successfully";
}
