//
// turingmachine.js
//
// A turing machine web application for educational purposes.
// The main routine is at the end of the document.
//
// TODO, IMPROVE and FEATURE flags are used in the source code.
// Dependencies:
//   - jQuery (tested with 1.10.2)
//
// method name `input` = should be 'import', but import is reserved identifier
//
// (C) 2013, Public Domain, Lukas Prokop
//

// --------------------------- global variables ---------------------------

app_name = "turingmachine.js";
app_version = "0.2.0-nodart";
app_author = "Lukas Prokop <admin@lukas-prokop.at>";

// Movement values, immutable const
mov = {
  LEFT  : "Left",
  RIGHT : "Right",
  HALT  : "Halt",
  STOP  : "Stop"
};

// global variable containing all occuring states
registered_states = [];

// global variable containing all written letters
alphabet = [];

// -------------------------------- Helpers -------------------------------

// Default parameters abstraction
function def(arg, val) { return (typeof arg !== 'undefined') ? arg : val; }

// assert statement
function require(cond, msg)
{
  if (!cond)
    throw new AssertionException(msg);
}

// Allow objects to inherit from an *instance* as prototype
// Basically a wrapper for Object.create which accepts instances as prototype
var inherit = function (prototype, properties)
{
  var object = Object.create(prototype, {});
  for (var key in properties) {
    var desc = Object.getOwnPropertyDescriptor(properties, key);
    Object.defineProperty(object, key, desc);
  }
  return object;
}

// ------------------------------ Exceptions ------------------------------

// @exception thrown if value out of tape bounds is accessed
function OutOfTapeException(position)
{
  if (typeof position === 'undefined')
    throw {
      name : "Out of Tape Bounds Exception", 
      message : "I ran outside the tape",
      toString : function () { return this.name + ": " + this.message } 
    };
  else
    throw {
      name : "Out of Tape Bounds Exception", 
      message : "Position " + position + " is outside of tape", 
      toString : function () { return this.name + ": " + this.message }
    };

  alert("Internal Error! OutOfTape Bounds Exception.");
}

// @exception thrown if number of undos exceeds history size
function OutOfHistoryException(step_id)
{
  throw {
    name : "Out of History Exception", 
    message : "Cannot step any further in history (bounds are 0 and history_size).",
    toString : function () { return this.name + ": " + this.message } 
  };

  alert("Internal Error! History Exception.");
}

// @exception thrown if a HALT instruction is executed
function HaltException()
{
  throw {
    name : "Out of Tape Bounds Exception", 
    message : "Position " + position.getIndex() + " is outside of tape", 
    toString : function () { return this.name + ": " + this.message }
  };
}

// @exception thrown, if an assertion goes wrong
function AssertionException(msg)
{
  throw {
    name : "Assertion",
    message : msg ? "Condition is not satisfied: " + msg : "Condition not satisfied",
    toString : function () { return this.name + ": " + this.message }
  }
  alert("Internal Error! Assertion failed:\n" + msg);
}

// --------------------------------- State --------------------------------

// @object State: State of the Turing machine.
function State(name)
{
  // @member State.name

  if (isState(name))
    name = name.name;
  registered_states.push(name);

  // @method State.equals: Equality comparison for State objects
  var equals = function (other) {
    return toString() === other.toString();
  };

  // @method State.toString: String representation of State objects
  var toString = function () {
    return name.toString();
  };

  // @method State.toJSON: JSON representation of State objects
  var toJSON = function() {
    return name;
  };

  return {
    equals : equals,
    toString : toString,
    toJSON : toJSON,
    isState : true
  };
}

// Test whether or not the given parameter `obj` is a State object
function isState(obj)
{
  try {
    return obj.isState === true;
  } catch (e) {
    return false;
  }
}

// Throw exception if `obj` is not a State object
function requireState(obj)
{
  if (!isState(obj))
    require(false, "Is not a valid state: " + obj);
}

// two known states, immutable consts
var EndState = new State("End");
var StartState = new State("Start");

// ------------------------------- Movement -------------------------------

// @object Movement: Abstraction for moving operation.
function Movement(move)
{
  // @member Movement.move

  move = normalizeMovement(move);
  requireMovement(move);

  // @method Movement.equals: Equality comparison for Movement objects
  var equals = function (other) {
    other = normalizeMovement(other);
    if (isMovement(other))
      return move === other.toString();
    else
      return move === other;
  };

  // @method Movement.toString: String representation of Movement objects
  var toString = function () {
    return move;
  };

  // @method Movement.toJSON: JSON representation of Movement objects
  var toJSON = function () {
    return move;
  };

  return {
    equals : equals,
    toString : toString,
    toJSON : toJSON,
    isMovement : true
  }
};

var normalizeMovement = function (move) {
  var isin = function (elem, a) { return $.inArray(elem, a) !== -1; };

  if (typeof move !== 'undefined' && move.isMovement)
    return move.toString();
  if (typeof move === 'string')
    move = move.toLowerCase();

  if (isin(move, ['l', 'left']) || move === mov.LEFT.toLowerCase())
    move = mov.LEFT;
  else if (isin(move, ['r', 'right']) || move === mov.RIGHT.toLowerCase())
    move = mov.RIGHT;
  else if (isin(move, ['h', 'halt']) || move === mov.HALT.toLowerCase())
    move = mov.HALT;
  else if (isin(move, ['s', 'stop']) || move === mov.STOP.toLowerCase())
    move = mov.STOP;
  else
    move = undefined;
  return move;
}

// Test whether or not the given parameter `obj` describes a movement
function isMovement(obj)
{
  return normalizeMovement(obj) !== undefined;
}

// Throw exception if `obj` is not a Movement object
function requireMovement(obj)
{
  if (!(isMovement(obj)))
    require(false, "Is not a valid movement: " + obj);
}

// ------------------------------- Position -------------------------------

// @object Position: Abstraction for Position at Tape.
function Position(index)
{
  // @member Position.index

  index = parseInt(index);
  require(!isNaN(index), "Invalid value for Position");

  // @method Position.equals: Equality comparison for Position objects
  var equals = function (other) {
    if (isPosition(other))
      return toJSON() === other.toJSON();
    else
      return index === other;
  };

  // @method Position.add: Returns Position instance at pos this+summand
  var add = function (summand) {
    return new Position(index + summand);
  };

  // @method Position.sub: Returns Position instance at pos this+subtrahend
  var sub = function (subtrahend) {
    return new Position(index - subtrahend);
  };

  // @method Position.toString: String representation of Position objects
  var toString = function () {
    return index.toString();
  };

  // @method Position.toJSON: JSON representation of Position objects
  var toJSON = function () {
    return index;
  };

  return {
    index : index,
    equals : equals,
    add : add,
    sub : sub,
    toString : toString,
    toJSON : toJSON,
    isPosition : true
  };
}

// Test whether or not the given parameter `obj` is a Position object
function isPosition(obj)
{
  try {
    return obj.isPosition === true;
  } catch (e) {
    return false;
  }
}

// Throw exception if `obj` is not a Position object
function requirePosition(obj)
{
  if (!isPosition(obj))
    require(false, "Is not a position");
}

// ------------------------------ InstrTuple ------------------------------

// @object InstrTuple: Instruction tuple (reaction to a given configuration).
function InstrTuple(write, move, state)
{
  // @member InstrTuple.write
  // @member InstrTuple.move
  // @member InstrTuple.state

  requireMovement(move);
  requireState(state);

  // @method InstrTuple.equals: Equality comparison for InstrTuple objects
  var equals = function (other) {
    require(isInstruction(other), "InstrTuple object required for comparison");
    return write === other.write && move.equals(other.move) &&
        state.equals(other.state);
  };

  // @method InstrTuple.toString: String representation of InstrTuple objects
  var toString = function () {
    return "{instruction: write " + write.toString() + ", move "
      + move.toString() + " and goto state "
      + state.toString() + "}";
  };

  // @method InstrTuple.toJSON: JSON representation of InstrTuple objects
  var toJSON = function () {
    return [write.toString(), move.toJSON(), state.toJSON()];
  };

  return {
    write : write,
    move : move,
    state : state,

    equals : equals,
    toString : toString,
    toJSON : toJSON,
    isInstruction : true
  }
}

// Test whether or not the given parameter `obj` is an InstrTuple object
function isInstruction(obj)
{
  try {
    return obj.isInstruction === true;
  } catch (e) {
    return false;
  }
}

// --------------------------------- Program --------------------------------

// @object Program: Abstraction for the program of the Turing machine.
function Program()
{
  // @member Program.program
  // maps [read_symbol, from_state] to [write_symbol, movement, to_state]
  // but the value is stored as InstrTuple
  var program = {};

  // @method Program.update: Add/update entry to program
  var update = function (read_symbol, from_state, write, move, to_state)
  {
    requireState(from_state);
    var value = [];

    if (isInstruction(write)) {
      // InstrTuple was provided instead of [write, move, to_state]
      value = write;
    } else {
      requireMovement(move);
      requireState(to_state);

      value = new InstrTuple(write, move, to_state);
    }

    if (program[read_symbol] === undefined)
      program[read_symbol] = {};

    var added = false;
    for (var key1 in program)
      for (var key2 in program[key1])
        if (key1 === read_symbol && key2 === from_state.toJSON())
        {
          program[key1][key2] = value;
          added = true;
          break;
        }

    if (!added)
      program[read_symbol][from_state.toJSON()] = value;
  };

  // @method Program.isDefined: Can we handle the specified situation?
  var isDefined = function (read_symbol, from_state)
  {
    return get(read_symbol, from_state) !== undefined;
  };

  // @method Program.get: Return InstrTuple for specified situation or undefined
  var get = function (read_symbol, from_state)
  {
    requireState(from_state);

    for (var key1 in program)
      for (var key2 in program[key1])
      {
        if (key1 === read_symbol && key2 === from_state.toJSON())
          return program[key1][key2];
      }

    return undefined;
  };

  // @method Program.input: Import a program
  var input = function (data)
  {
    program = {};
    for (var key1 in data)
      for (var key2 in data[key1])
      {
        var value = data[key1][key2];

        var read_symbol = key1;
        var from_state = key2;  // no State by intention
        var write_symbol = value[0];
        var movement = new Movement(value[1]);
        var to_state = new State(value[2]);

        if (program[read_symbol] === undefined)
          program[read_symbol] = {};

        program[read_symbol][from_state] = new InstrTuple(
          write_symbol, movement, to_state
        );
      }
  };

  // @method Program.toString: String representation of Program object
  var toString = function ()
  {
    var data = {};
    for (var key1 in program)
      for (var key2 in program[key1])
      {
        if (data[key1.toString()] === undefined)
          data[key1.toString()] = {};
        data[key1.toString()][key2.toJSON()] = program[key1][key2].toJSON();
      }

    return data.toString();
  };

  // @method Program.toJSON: JSON representation of Program object
  var toJSON = function ()
  {
    var data = {};
    for (var key1 in program)
      for (var key2 in program[key1])
      {
        if (data[key1] === undefined)
          data[key1] = {};
        data[key1][key2] = program[key1][key2].toJSON();
      }

    return data;
  };

  // @method Program.query: extract information from Program for debugging 
  // A query function to extract information from Program when debugging
  // Provide {read|from_state|write|move|to_state: value} and I will return
  // all program entries where *all* (conjunction) these values are set.
  var query = function (options)
  {
    options = def(options, {});
    var selection = [];

    // iterate over program and copy all entries satisfying all options
    for (var key1 in program)
      for (var key2 in program[key1])
      {
        var value = program[key1][key2];

        var add = [];
        if (options['read'] !== undefined)
          add.push(+(options['read'] === key1));
        if (options['from_state'] !== undefined)
          add.push(+(options['from_state'] === key2));
        if (options['write'] !== undefined)
          add.push(+(options['write'] === value.write));
        if (options['move'] !== undefined)
          add.push(+(options['move'] === value.move.toString()));
        if (options['to_state'] !== undefined)
          add.push(+(options['to_state'] === value.state.toString()));

        var all = true;
        for (var key in add)
          if (add[key] !== 1)
            all = false;
        if (add.length === 0 || all)
        {
          var value = program[key1][key2].toJSON();
          value.splice(0, 0, key2);
          value.splice(0, 0, key1);
          selection.push(value);
        }
      }

    return selection;
  };

  return {
    update : update,
    isDefined : isDefined,
    get : get,
    input : input,
    toString : toString,
    toJSON : toJSON,
    query : query
  };
};

// --------------------------------- Tape ---------------------------------

// @object Tape: Abstraction for an infinite tape.
function Tape(default_value)
{
  // @member Tape.default_default_value, immutable const
  var default_default_value = 0;
  // @member Tape.default_value
  // value to be written if new memory cell is created
  default_value = def(default_value, null);
  // @member Tape.offset
  var offset = 0;
  // @member Tape.cursor
  var cursor = new Position(0);
  // @member Tape.tape
  var tape = [default_value];

  var _testInvariants = function () {
    require(end() - begin() + 1 === tape.length,
      "begin, end and length do not correspond"
    );
    require(typeof offset === 'number');
    require(offset >= 0, "offset invariant invalidated");
    requirePosition(cursor, "cursor is not a position");
    require(typeof tape === 'object');
  };

  // @method Tape.position: Return cursor
  var position = function () {
    return cursor;
  };

  // @method Tape.begin: Get most-left, reached Position at Tape
  var begin = function () {
    return new Position(-offset);
  };

  // @method Tape.end: Get most-right, reached Position at Tape
  var end = function () {
    return new Position(tape.length - offset - 1);
  };

  // @method Tape.left: Go left at tape
  var left = function () {
    cursor = cursor.sub(1);
    var index = cursor.index + offset;
    if (index === -1) {
      tape.splice(0, 0, default_value);
      offset += 1;
    }
    require(index >= -1, "cursor.index or offset corrupt");
    _testInvariants();
  };

  // @method Tape.right: Go right at tape
  var right = function () {
    cursor = cursor.add(1);
    var index = cursor.index + offset;
    if (index === tape.length) {
      tape.push(default_value);
    }
    require(index < tape.length, "cursor.index or offset corrupt");
    _testInvariants();
  };

  // @method Tape.write: Write value to tape at current cursor position
  var write = function (value) {
    var index = cursor.index + offset;
    tape[index] = value;
    _testInvariants();
  };

  // @method Tape.read: Return value at current cursor position
  var read = function () {
    var index = cursor.index + offset;
    _testInvariants();
    return tape[index];
  };

  // @method Tape.length: Length of Tape of accessed elements
  var length = function () {
    return tape.length;
  }

  // @method Tape.input: Import Tape data
  var input = function (data) {
    if (data['data'] === undefined || data['cursor'] === undefined)
      throw new AssertionException("data parameter incomplete.");

    default_value = def(data['default_value'], default_default_value);
    offset = def(data['offset'], 0);
    cursor = new Position(data['cursor']);
    tape = data['data'];

    // ensure cursor position is accessible/defined
    var base = cursor;
    var highest_index = tape.length - offset - 1;
    var lowest_index = -offset;
    if (cursor.index > highest_index) {
      var high_missing_elements = cursor.index - (tape.length - offset - 1);
      for (var i = 0; i < high_missing_elements; i++)
        tape.push(default_value);
    } else if (cursor.index < lowest_index) {
      var low_missing_elements = Math.abs(cursor + offset);
      for (var i = 0; i < low_missing_elements; i++) {
        tape.splice(0, 0, default_value);
        offset += 1;
      }
    }

    _testInvariants();
  }

  // @method Tape.toJSON: Return JSON representation of Tape
  var toJSON = function () {
    return {
      default_value : default_value,
      offset : offset,
      cursor : cursor.toJSON(),
      data : tape
    };
  }

  return {
    default_default_value : default_default_value,
    default_value : default_value,

    position : position,
    begin : begin,
    end : end,
    left : left,
    right : right,
    write : write,
    read : read,
    length : length,
    input : input,
    toJSON : toJSON
  };
}

// ----------------------------- RecordedTape -----------------------------

// @object RecordedTape: A tape with a history (can restore old states).
// invariant: RecordedTape provides a superset API of Tape

// A Tape which also provides a history with the undo and redo methods.
// The state is stored whenever method 'snapshot' is called.
// In other words: it can revert back to old states.
function RecordedTape(history_size, default_value)
{
  // @member RecordedTape.history_size
  // @member RecordedTape.default_value

  if (history_size !== Infinity)
    history_size = parseInt(history_size);
  require(!isNaN(history_size), "History size must be integer");

  // TODO: Implement history_size (upper bound for history array)
  //       A counter (incremented on snapshot, adjust on undo/redo) should
  //       be enough. Maybe history_pointer is enough itself.
  if (history_size !== Infinity)
    console.warn("History size is currently not implemented (ergo ignored).");

  // @member RecordedTape.history
  // Array of arrays. One array per snapshot
  var history = [[]];

  // @member RecordedTape.history_pointer: defines current level of depth
  //         invariant: history_pointer >= -1
  var history_pointer = 0;

  // @member RecordedTape.alternate
  // If you restore an old state, the newest history is not dumped.
  // If you now apply a command, the history will not be overwritten.
  // But if you call method snapshot, the new operations have to overwrite
  // history. Those new operations are stored in alternate. If you do *not*
  // call snapshot after restoring an old state, alternate will be dumped.
  var alternate = [];

  // @member RecordedTape.simple_tape
  var simple_tape = new Tape(default_value);

  // General overview for instruction set:
  //    "LEFT", [$positions]
  //    "RIGHT", [$positions]
  //    "WRITE", $old_value, $new_value
  //    "SNAPSHOT"

  // @method RecordedTape._oppositeInstruction: Get opposite instruction
  var _oppositeInstructionTODO = function (instr) {
    if (instr[0] === "LEFT")
      return (typeof instr[1] === 'undefined')
        ? ["RIGHT"] : ["RIGHT", instr[1]];
    else if (instr[0] === "RIGHT")
      return (typeof instr[1] === 'undefined')
        ? ["LEFT"] : ["LEFT", instr[1]];
    else if (instr[0] === "WRITE")
      return ["WRITE", instr[2], instr[1]];
    else if (instr[0] === "SNAPSHOT")
      throw new AssertionException(
        "SNAPSHOT instruction occured. Must not be in history."
      );
    else
      throw new AssertionException("Unknown VM instruction");
  };
  var _oppositeInstruction = function(instr) {
    var res = _oppositeInstructionTODO(instr);
    return res;
  }

  // @method RecordedTape._applyInstruction: Run an instruction
  var _applyInstruction = function (instr) {
    if (instr[0] === "LEFT")
      left(instr[1]);
    else if (instr[0] === "RIGHT")
      right(instr[1]);
    else if (instr[0] === "WRITE")
      write(instr[1], instr[2]);
    else if (instr[0] === "SNAPSHOT")
      snapshot();
    else
      throw new AssertionException("Unknown instruction");
  };

  // @method RecordedTape._applyNativeInstruction: Run instruction natively
  var _applyNativeInstruction = function (instr) {
    if (instr[0] === "LEFT")
      for (var i = 0; i < def(instr[1], 1); i++)
        simple_tape.left();
    else if (instr[0] === "RIGHT")
      for (var i = 0; i < def(instr[1], 1); i++)
        simple_tape.right();
    else if (instr[0] === "WRITE")
      simple_tape.write(instr[2]);
    else if (instr[0] === "SNAPSHOT")
      snapshot();
    else
      throw new AssertionException("Unknown instruction");
  };

  // @method RecordedTape._store: Store instruction (handles alternate)
  var _store = function (instr) {
    if (history_pointer === history.length - 1)
      history[history_pointer].push(instr);
    else
      alternate.push(instr);
  }

  // @method RecordedTape.getHistory: Print the stored history
  var getHistory = function () {
    return history;
  }

  // @method RecordedTape.left: Go left.
  var left = function (positions) {
    positions = def(positions, 1);
    _store(["LEFT", positions]);
    for (var i = 0; i < positions; i++)
      simple_tape.left();
  };

  // @method RecordedTape.right: Go right.
  var right = function (positions) {
    positions = def(positions, 1);
    _store(["RIGHT", positions]);
    for (var i = 0; i < positions; i++)
      simple_tape.right();
  };

  // @method RecordedTape.write: Write a value to tape.
  var write = function (new_value, old_value) {
    old_value = def(old_value, simple_tape.read());
    _store(["WRITE", old_value, new_value]);
    simple_tape.write(new_value);
  };

  // natively=true means no new history is created for this instruction
  var _undo_stack = function (stack, natively) {
    natively = def(natively, false);
    for (var i = stack.length - 1; i >= 0; i--) {
      var instr = stack[i];
      var undo = _oppositeInstruction(instr);
      if (natively)
        _applyNativeInstruction(undo);
      else
        _applyInstruction(undo);
    }
  };

  // @method RecordedTape.undo: Go back to last snapshot. Returns success.
  var undo = function () {
    if (alternate.length > 0) {
      _undo_stack(alternate, true);
      alternate = [];

    } else {
      if (history_pointer === -1 || (history_pointer === 0 && history.length === 0))
        throw OutOfHistoryException();

      if (history_pointer === history.length - 1) {
        // undo all operations of top-level
        _undo_stack(history[history_pointer], true);
        // if there are instructions at the top level, they will be dumped
        history[history_pointer] = [];
        history_pointer -= 1;
      }
    }

    // go back to last snapshot
    if (history_pointer !== -1) {
      _undo_stack(history[history_pointer], true);
      history_pointer -= 1;
    }
  };

  // @method RecordedTape.redo: Go forward one snapshot. Returns success.
  var redo = function () {
    // if alternate is used, undo alternate
    if (alternate.length > 0) {
      _undo_stack(alternate);
      alternate = [];
    }

    if (history_pointer >= history.length - 1)
      throw OutOfHistoryException();

    // redo one snapshot
    for (var i = 0; i < history[history_pointer + 1].length; i++)
      _applyNativeInstruction(history[history_pointer + 1][i]);

    history_pointer += 1;
  };

  // @method RecordedTape.snapshot: Take a snapshot.
  var snapshot = function () {
    if (history_pointer === history.length - 1) {
      if (history[history_pointer].length === 0) {
        // do nothing!
        // ignore calling snapshot twice.
      } else {
        history.push([]);
        history_pointer += 1;
      }
    } else if (alternate.length > 0) {
      // remove elements after history_pointer from history
      // put alternate onto history instead
      history = history.slice(0, history_pointer + 1);
      history.push(alternate);
      history.push([]);
      history_pointer += 1;
    } else /* if (history_pointer is not last and alternate unused) */ {
      history = history.slice(0, history_pointer);
      history.push([]);
    }
    alternate = [];
  };

  // @method RecordedTape.toJSON: Return JSON representation of RecordedTape
  var toJSON = function (export_history) {
    export_history = def(export_history, true);
    if (!export_history)
      return simple_tape.toJSON();

    var data = simple_tape.toJSON();
    data['history'] = history;
    data['history_size'] = history_size;
    data['history_pointer'] = history_pointer;
    data['history_alternate'] = alternate;

    return data;
  }

  // @method RecordedTape.input: Import RecordedTape data
  var input = function (data) {
    if (data['history'] !== undefined)
      history = data['history'];
    if (data['history_size'] !== undefined)
      history_size = data['history_size'];
    if (data['history_pointer'] !== undefined)
      history_pointer = data['history_pointer'];
    if (data['history_alternate'] !== undefined)
      alternate = data['history_alternate'];

    return simple_tape.input(data);
  }

  return inherit(simple_tape, {
    left : left,
    right : right,
    write : write,
    undo : undo,
    redo : redo,
    snapshot : snapshot,
    getHistory : getHistory,
    toJSON : toJSON,
    input : input,

    /* TODO: only for debugging */
    history : history,
    history_pointer : history_pointer,
    alternate : alternate,
    simple_tape : simple_tape
  });
}

// ----------------------------- ExtendedTape -----------------------------

// @object ExtendedTape: An extension of Tape with a nice API.
// invariant: ExtendedTape provides a superset API of RecordedTape

function ExtendedTape(history_size, default_value)
{
  // @member ExtendedTape.rec_tape
  var rec_tape = new RecordedTape(history_size, default_value);
  // @member ExtendedTape.halted
  var halted = false;

  // @method ExtendedTape.initialize: Constructor of ExtendedTape
  var initialize = function () {
    require(rec_tape.position().equals(new Position(0)));
    moveTo(new Position(0));
  };

  // @method ExtendedTape.length: Return length of accessed Tape elements
  var length = function (pos) {
    var begin = rec_tape.begin();
    var end = rec_tape.end();

    return Math.abs(begin.index) + Math.abs(end.index) + 1;
  };

  // @method ExtendedTape.clear: Reset all elements at Tape to default_value
  var clear = function () {
    require(!halted, "Tape halted. Cannot be written.");
    var base = rec_tape.position();

    while (!rec_tape.position().equals(rec_tape.begin()))
      rec_tape.left();
    // go from left to right and reset all values to default value
    while (!rec_tape.position().equals(rec_tape.end())) {
      rec_tape.write(default_value);
      rec_tape.right();
    }
    rec_tape.write(default_value);

    // go back to base
    while (!rec_tape.position().equals(base))
      rec_tape.left();
  };

  // @method ExtendedTape.moveTo: Move to the given position
  var moveTo = function (goto) {
    requirePosition(goto);
    while (goto.index < rec_tape.position().index)
      rec_tape.left();
    while (goto.index > rec_tape.position().index)
      rec_tape.right();
  };

  // @method ExtendedTape.read: Read value at position
  var read = function (pos) {
    if (typeof pos === 'undefined')
      return rec_tape.read();
    else
      requirePosition(pos);

    var base = rec_tape.position();
    moveTo(pos);
    var value = rec_tape.read();
    moveTo(base);

    return value;
  };

  // @method ExtendedTape.write: Write value at position
  var write = function (value, pos) {
    require(!halted, "Tape halted. Cannot be written.");
    if (typeof pos === 'undefined')
      return rec_tape.write(value);
    else
      requirePosition(pos);

    var base = rec_tape.position();
    moveTo(pos);
    rec_tape.write(value);
    moveTo(base);
  };

  // @method ExtendedTape.begin: Return left-most (lowest) position
  var begin = function() {
    return rec_tape.begin();
  };

  // @method ExtendedTape.end: Return right-most (highest) position
  var end = function () {
    return rec_tape.end();
  };

  // @method ExtendedTape.left: Go one left, return value of old position
  var left = function ()
  {
    require(!halted, "Tape halted. Cannot go left.");
    var old_value = rec_tape.read();
    rec_tape.left();
    return old_value;
  };

  // @method ExtendedTape.right: Go one right, return value of old position
  var right = function ()
  {
    require(!halted, "Tape halted. Cannot go right.");
    var old_value = rec_tape.read();
    rec_tape.right();
    return old_value;
  };

  // @method ExtendedTape.move: Move in some specified direction
  var move = function (move) {
    require(!halted, "Tape halted. Cannot move.");
    requireMovement(move);
    move = new Movement(move);

    if (move.equals(mov.RIGHT))
      rec_tape.right();
    else if (move.equals(mov.LEFT))
      rec_tape.left();
    else if (move.equals(mov.HALT))
      halted = true;
    else if (move.equals(mov.STOP)) {
      // nothing.
    } else {
      require(false, "Unknown movement");
    }
  };

  // @method ExtendedTape.leftShift: Move several steps left
  var leftShift = function (count)
  {
    require(!halted, "Tape halted. Cannot move left.");

    for (var i = 0; i < Math.abs(count); i++)
      count < 0 ? rec_tape.right() : rec_tape.left();
  };

  // @method ExtendedTape.rightShift: Move several steps right
  var rightShift = function (count)
  {
    require(!halted, "Tape halted. Cannot move right.");

    for (var i = 0; i < Math.abs(count); i++)
      count < 0 ? rec_tape.left() : rec_tape.right();
  };

  // @method ExtendedTape.toString: String representation of ExtendedTape objects
  var toString = function ()
  {
    var base = rec_tape.position();
    var values = [];

    rec_tape.moveTo(rec_tape.begin());
    while (!rec_tape.position().equals(rec_tape.end()))
      if (rec_tape.position().equals(base))
        values.push("*" + rec_tape.right() + "*");
      else
        values.push(rec_tape.right().toString());
    rec_tape.moveTo(base);

    return values.join(",");
  };

  // @method ExtendedTape.forEach: For each element at tape, apply func(pos, val)
  //                               from begin() to end()
  var forEach = function (func) {
    var base = rec_tape.position();
    moveTo(rec_tape.begin());
    
    while (!rec_tape.position().equals(rec_tape.end())) {
      func(rec_tape.position(), rec_tape.read());
      rec_tape.right();
    }
    func(rec_tape.position(), rec_tape.read());

    moveTo(base);
  };

  // @method ExtendedTape.equals: Is this one and the given tape the same?
  var equals = function (tape, ignore_length, ignore_cursor)
  {
    ignore_length = def(ignore_length, true);
    // the absolute position
    // NOT relative to begin and end or any other stuff
    ignore_cursor = def(ignore_cursor, true);

    if (!ignore_cursor && !position().equals(tape.position()))
      return false;

    var values1 = toJSON();
    var values2 = tape.toJSON();

    if (ignore_length)
    {
      // strip away default values left and right
      var strip = function (array, def_v) {
        while (array[0] === def_v && array.length > 0)
          array = array.slice(1);
        while (array[array.length - 1] === def_v && array.length > 0)
          array = array.slice(0, array.length - 1);
        return array;
      };

      var values1 = strip(values1, default_value);
      var values2 = strip(values2, tape.default_value);
    }

    for (var key in values1)
    {
      if (key >= values2.length)
        return false;
      if (values1[key].toString() !== values2[key].toString())
        return false;
    }
    return true;
  };

  // @method ExtendedTape.toJSON: Return JSON representation of Tape
  var toJSON = function ()
  {
    var out = rec_tape.toJSON();
    out['halted'] = halted;
    return out;
  };

  // @method ExtendedTape.input: import data from given array
  var input = function (data)
  {
    halted = def(data['halted'], false);
    rec_tape.input(data);
  };

  var instance = {
    position : rec_tape.position,
    initialize : initialize,
    length : length,
    clear : clear,
    moveTo : moveTo,
    read : read,
    write : write,
    begin : begin,
    end : end,
    left : left,
    right : right,
    move : move,
    leftShift : leftShift,
    rightShift : rightShift,
    toString : toString,
    forEach : forEach,
    equals : equals,
    toJSON : toJSON,
    input : input,
    isTape : true
  };
  instance.initialize();
  return instance;
}

// --------------------------- UserFriendlyTape ---------------------------

// @object UserFriendlyTape: Tape addings awkward, special but handy methods.
// invariant: UserFriendlyTape provides a superset API of ExtendedTape

function UserFriendlyTape(history_size, default_value)
{
  // @method UserFriendlyTape.ext_tape
  var ext_tape = new ExtendedTape(history_size, default_value);

  // @method UserFriendlyTape.setByString
  // Take a string, assume one tape entry per character,
  // write string to tape and set cursor left of it
  var setByString = function (string) {
    ext_tape.clear(1);
    require(ext_tape.position().equals(new Position(0)));
    for (var i = 0; i < string.length; i++) {
      ext_tape.right();
      ext_tape.write(string[i]);
    }
    ext_tape.moveTo(new Position(0));
  };

  // @method UserFriendlyTape.setByArray
  var setByArray = function (array) {
    return setByString(array);
  }

  return inherit(ext_tape, {
    setByString : setByString,
    setByArray : setByArray,
    isUserFriendlyTape : true
  });
}

// -------------------------------- Machine -------------------------------

// @object Machine: Putting together Program, Tape and state handling.
// This is the actual Turingmachine abstraction.

function Machine(initial_state, final_states, program, tape,
  history_size, inf_loop_check)
{
  // @member Machine.program
  // @member Machine.tape

  // @member Machine.final_states
  for (var key in final_states)
    requireState(final_states[key]);

  // @member Machine.default_check_inf_loop, const immutable
  var default_check_inf_loop = 500;

  // @member Machine.current_state
  requireState(initial_state);
  var current_state = initial_state;

  // @member Machine.history_size
  history_size = def(history_size, 500);

  // @member Machine.inf_loop_check
  inf_loop_check = def(inf_loop_check, default_check_inf_loop);

  // @member Machine.finished
  var finished = false;
  var step_id = 0;

  // @method Machine.getFinished: Did the machine finish yet?
  var getFinished = function () {
    return final_states.indexOf(current_state) >= 0 && finished;
  };

  // @method Machine.setFinished: Set the finished status
  var setFinished = function (has_finished) {
    finished = has_finished;
  };

  // @method Machine.read: Return 11 values next to the cursor or `pos`.
  //                       cursor is in the center
  var read = function (position) {
    var current = tape.position();
    var base = def(position, current);
    var values = [];

    tape.moveTo(base.sub(5));
    for (var i = 0; i < 11; i++) {
      values.push(tape.read());
      tape.right();
    }
    tape.moveTo(current);

    return values;
  };

  // @method Machine.prev: Undo last (or `steps`) operation(s)
  var prev = function (steps) {
    var steps = def(steps, 1);
    for (var i = 0; i < steps; i++)
      if (!tape.undo())
        return false;

    return true;
  };

  // @method Machine.next: Redo last (or `steps`) operation(s)
  var next = function (steps) {
    // Try to redo
    if (tape.redo()) {
      steps -= 1;
      while (steps > 0) {
        tape.redo();
        steps -= 1;
      }
    } else {
      var steps = def(steps, 1);
    }

    // else run `steps` operations
    for (var i = 0; i < steps; i++)
    {
      var read_symbol = tape.read();
      var instr = program.get(read_symbol, current_state);

      // do it
      if (typeof instr !== 'undefined')
      {
        tape.write(instr.write);
        tape.move(instr.move);
        current_state = instr.state;
      } else {
        finished = true;
        return false;
      }
    }

    step_id += 1;

    return true;
  };

  // @method Machine.run: Run operations until a final state is reached
  var run = function (_base)
  {
    var _base = def(_base, 0);
    var iter = 0;
    for (; iter < inf_loop_check; iter++) {
      if (!next(1) || getFinished())
        return true;
    }

    var ret = confirm("I have run " + (_base + iter) +
      " iterations without reaching a final state. " +
      "Do you still want to continue?");
    if (ret)
      return run(_base + iter);
    else
      return undefined;
  };

  // @method Machine.addFinalState
  var addFinalState = function (state)
  {
    requireState(state);
    final_states.push(state);
  };

  // @method Machine.setFinalStates
  var setFinalStates = function (states)
  {
    for (var k in states)
      require(isState(states[k]), "Cannot add invalid state as final state");
    final_states = states;
  };

  // @method Machine.runTestcase
  // give me a testcase spec and I will return whether or not the
  // current machine fails (false) or succeeds (true) the testcase
  var runTestcase = function (testcase)
  {
    // save old state
    var saved_state = toJSON();

    tape.clear();
    current_state = new State(testcase['input']['current_state']);

    // load tape content
    for (var v in testcase['input']['tape']['data'])
    {
      tape.write(testcase['input']['tape']['data'][v]);
      tape.right();
    }
    var cursor_pos = new Position(testcase['input']['tape']['cursor']);
    tape.extend(cursor_pos);
    tape.moveTo(cursor_pos);

    // Actually run it.
    run();

    // compare
    var cmp_tape = new UserFriendlyTape();
    cmp_tape.setByArray(testcase['output']['tape']['data']);
    cmp_tape.moveTo(new Position(testcase['output']['tape']['cursor']));

    if (testcase['test_state'])
      if (machine.current_state.equals(testcase['output']['current_state']))
        return false;
    if (testcase['test_cursor_position'])
      if (!tape.position().equals(cmp_tape.position()))
        return false;
    if (!tape.equals(cmp_tape))
      return false;

    // restore old state
    input(saved_state);
    return true;
  };

  // @method Machine.input: Import a Machine
  var input = function (data)
  {
    if (typeof data['current_state'] === 'undefined' ||
        typeof data['tape'] === 'undefined' ||
        typeof data['program'] === 'undefined')
    {
      throw AssertionException("data parameter is incomplete");
    }

    tape = new Tape();
    tape.input(data['tape']);
    // 
    program = new Program();
    program.input(data['program']);
    // 

    step_id = def(data['step'], 0);
    inf_loop_check = def(data['inf_loop_check'], default_inf_loop_check);
    current_state = new State(data['current_state']);
    requireState(current_state);
    final_states = def(data['final_states'], []);
    finished = def(data['finished'], false);
  };

  // @method Machine.toJSON: Get JSON representation
  var toJSON = function ()
  {
    // TODO(meisterluk): add alphabet
    // TODO(meisterluk): add registered states

    var final_states = [];
    for (var k in final_states)
      final_states.push(final_states[k].toJSON());

    var out = {
      'step' : step_id,
      'current_state' : current_state.toJSON(),
      'program' : table.toJSON(),
      'tape' : tape.toJSON(),
      'finished' : getFinished(),
      'inf_loop_check' : inf_loop_check,
      'final_states' : final_states
    };

    return out;
  };

  return {
    getFinished : getFinished,
    setFinished : setFinished,
    read : read,
    prev : prev,
    next : next,
    run : run,
    undefinedState : undefinedState,
    undefinedSymbol : undefinedSymbol,
    addFinalState : addFinalState,
    setFinalStates : setFinalStates,
    runTestcase : runTestcase,
    input : input,
    // 
    toJSON : toJSON
  };
};

// ---------------------------- DrawingMachine ----------------------------

function DrawingMachine(initial_state, final_states, program, tape,
  history_size, inf_loop_check)
{

  var cursor_color = '#FC3';
  var machine = Machine(initial_state, final_states, program, tape,
    history_size, inf_loop_check);
  inherit(machine, {});
}


function getPixelRatio() {
  // http://stackoverflow.com/a/15666143/1624929
  var ctx = document.getElementById("tm_canvas").getContext("2d"),
      dpr = window.devicePixelRatio || 1,
      bsr = ctx.webkitBackingStorePixelRatio ||
            ctx.mozBackingStorePixelRatio ||
            ctx.msBackingStorePixelRatio ||
            ctx.oBackingStorePixelRatio ||
            ctx.backingStorePixelRatio || 1;

  return dpr / bsr;
}

function draw(tape, state)
{
  requireState(state);

  var canvas = document.getElementById("tm_canvas");
  var ctx = canvas.getContext("2d");
  var width = 400;
  var height = 150;

  var ratio = getPixelRatio();
  ctx.width = width * ratio;
  ctx.height = height * ratio;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  var values = [];
  var old_pos = tape.position();

  // get 10 values
  tape.extend(old_pos.sub(5));
  tape.extend(old_pos.add(5));
  tape.moveTo(old_pos.sub(5));
  var base = tape.position();
  for (var i = 0; i < 10; i++)
  {
    values.push(tape.read(base));
    var base = base.add(1);
  }

  // draw rectangles
  var box_width = 40;
  var line_width = 5;
  for (var x = 5; x < 400; x += 50)
  {
    ctx.beginPath();
    ctx.rect(x, 20, box_width, box_width);
    ctx.lineWidth = line_width;
    ctx.strokeStyle = 'black';
    ctx.stroke();
  }

  // write state
  var posx = 230;
  var posy = 100;
  var width = 150;
  var height = 25;
  var text = "state=" + state.toString().substr(0, 8);

  ctx.font = "15px Sans";
  ctx.textBaseline = 'middle';
  var x = posx + width / 2 - ctx.measureText(text).width / 2;
  var y = posy + height / 2 + 3;
  ctx.fillText(text, x, y);

  ctx.strokeStyle = 'yellow';
  ctx.strokeRect(posx, posy, width, height);

  tape.moveTo(old_pos);
}
function drawTransition(tape, old_pos, new_pos, speed)
{
  console.log("For tape " + tape.toString());
  console.log("Go from " + old_pos + " to " + new_pos);
  console.log("With speed " + speed);

  
}


// ------------------------------ Application -----------------------------

// Runtime for a Machine
// Contains all kinds of UI events

function Application(name, version, author)
{
  // @member Application.name
  name = def(name, "turingmachine01");
  // @member Application.version
  version = def(version, new Date().toISOString().slice(0, 10));
  // @member Application.author
  author = def(author, "user");

  // @member Application.table
  var program = new Program();
  // @member Application.tape
  var tape = new UserFriendlyTape(15, "0");
  // @member Application.machine
  var machine = new DrawingMachine(StartState, [EndState], program, tape);

  // @member Application.description
  var description = "";
  // @member Application.steps_prev
  var steps_prev = 1;
  // @member Application.steps_next
  var steps_next = 1;
  // @member Application.speed
  var speed = 50;
  // @member Application.history_size
  var history_size = 10;

  var updateName = function (name_string) {
    name = name_string;
  };

  var updateVersion = function (version_string) {
    version = version_string;
  };

  var updateAuthor = function (author_string) {
    author = author_string;
  };

  var updateDescription = function (desc) {
    console.log("Update description");
    description = $("#tm_description p");
    if (desc === "")
      $("#tm_description").hide();
    else
      $("#tm_description").show();
  };

  var updateStepsBackwards = function ()
  {
    var val = parseInt($("#tm_steps_prev").val());
    console.log("Update var value= " + val);
    if (isNaN(val))
    {
      $("#tm_steps_prev").css("background-color", "red");
    } else {
      $("#tm_steps_prev").css("background-color", "inherit");
      steps_prev = val;
    }
  };

  var updateStepsForward = function () {
    var val = parseInt($("#tm_steps_next").val());
    console.log("Update var value= " + val);
    if (isNaN(val))
    {
      $("#tm_steps_next").css("background-color", "red");
    } else {
      $("#tm_steps_next").css("background-color", "inherit");
      steps_next = val;
    }
  };

  var updateSpeed = function () {
    console.log("Update speed");
    var val = parseInt($("#tm_speed").val());
    if (isNaN(val))
    {
      $("#tm_speed").css("background-color", "red");
    } else {
      $("#tm_speed").css("background-color", "inherit");
      speed = val;
    }
  };

  var updateHistorySize = function () {
    console.log("Update history size");
    var val = parseInt($("#tm_history_size").val());
    if (isNaN(val))
    {
      $("#tm_history_size").css("background-color", "red");
    } else {
      $("#tm_history_size").css("background-color", "inherit");
      history_size = val;
    }
  };

  var updateTransitions = function () {
    console.log("Update transitions");
  };

  var backwards = function () {
    console.log("Go backwards " + steps_prev + " steps!");
    //draw(machine.tape, machine.current_state);
  };

  var forward = function () {
    console.log("Go forward " + steps_next + " steps!");
    //draw(machine.tape, machine.current_state);
  };

  var loadExampleProgram = function (prgram) {
    var prgram = def(prgram, $("#tm_example").val());

    switch (prgram) {
      case "2bit_xor":
        var prgram = twobit_xor();
        break;
      default:
        throw AssertionException("Loading unknown program");
        break;
    }

    // list testcases for selection
    if (typeof prgram['testcases'] !== 'undefined')
      testcases = prgram['testcases'];
    else
      testcases = [];
    if (testcases.length > 0)
      loadTestcase(testcases[0]);

    machine.input(prgram);
    // 
    if (typeof prgram['description'] !== 'undefined')
      updateDescription(prgram['description']);
    if (typeof prgram['name'] !== 'undefined')
      updateName(prgram['name']);
    if (typeof prgram['version'] !== 'undefined')
      updateVersion(prgram['version']);
    if (typeof prgram['author'] !== 'undefined')
      updateAuthor(prgram['author']);

    console.log("Load example program " + prgram);
    //draw(machine.tape, machine.current_state);
  };

  var loadTestcase = function (testcase) {
    if (typeof testcase === 'undefined') {
      for (var tc in testcases) {
        if (tc['name'] === $("#tm_testcase").val())
          var testcase = tc;
      }
      if (typeof testcase === 'undefined')
        throw AssertionException('Testcase not found');
    }
    $("#tm_testcase").val(testcase['name']);

    require(typeof testcase['name'] !== 'undefined',
      'Testcase in invalid format (name)'
    );
    require(typeof testcase['input'] !== 'undefined',
      'Testcase in invalid format (input)'
    );
    require(typeof testcase['input']['tape'] !== 'undefined',
      'Testcase in invalid format (input/tape)'
    );
    require(typeof testcase['input']['current_state'] !== 'undefined',
      'Testcase in invalid format (input/tape)'
    );
    require(typeof testcase['output'] !== 'undefined',
      'Testcase in invalid format (output)'
    );
    require(typeof testcase['output']['tape'] !== 'undefined',
      'Testcase in invalid format (output/tape)'
    );
    require(typeof testcase['output']['current_state'] !== 'undefined',
      'Testcase in invalid format (output/current_state)'
    );

    var result = machine.runTestcase(testcase);
    if (result === true) {
      $("#tm_testcase_result_success").show();
      $("#tm_testcase_result_failure").hide();
    } else if (result === false) {
      $("#tm_testcase_result_failure").show();
      $("#tm_testcase_result_success").hide();
    } else {
      $("#tm_testcase_result_failure").hide();
      $("#tm_testcase_result_success").hide();
    }

    console.log("Run testcase '" + testcase['name'] + "'. " +
      "Returned " + result + ".");
  };

  var loadTape = function () {
    console.log("Load tape");
    //draw(this.machine.tape, this.machine.current_state);
  };

  var reset = function () {
    console.log("Reset");
  };

  var run = function () {
    console.log("Run");
    //draw(this.machine.tape, this.machine.current_state);
  };

  var trigger_import = function () {
    console.log("input");
    // 
  };

  var trigger_export = function () {
    console.log("Export");
  };

  return {
    updateName : updateName,
    updateAuthor : updateAuthor,
    updateVersion : updateVersion,
    updateDescription : updateDescription,
    updateStepsForward : updateStepsForward,
    updateStepsBackwards : updateStepsBackwards,
    updateSpeed : updateSpeed,
    updateHistorySize : updateHistorySize,
    updateTransitions : updateTransitions,
    backwards : backwards,
    forward : forward,
    loadExampleProgram : loadExampleProgram,
    loadTestcase : loadTestcase,
    loadTape : loadTape,
    reset : reset,
    run : run,
    import : trigger_import,
    export : trigger_export
  }
};

// Get a default application
function defaultApplication()
{
  var app = new Application(app_name, app_version, app_author);
  app.loadExampleProgram(twobit_xor());
  return app;
}

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

    testStateObject : function () {
      var s1 = new State("Z1");
      var s2 = new State("Z1");
      var s3 = new State("State 123456789/2936538");
      require(s1.equals(s2));
      require(!s1.equals(s3));
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
    },

    testPositionObject : function () {
      var p1 = new Position(5);
      var p2 = new Position(-5);
      var p3 = new Position(5);
      require(p1.equals(p3));
      require(p1.sub(10).equals(p2));
      require(p2.add(10).equals(p1));
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
    },

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

        program.input(program.toJSON());
      }

      var spec = {"write" : "1", "move" : move2.toJSON()};
      require(program.query({"write" : "1"}).length === 2);
      program.update("1", end, "1", move, end);
      require(program.query(spec).length === 1);
      require(program.query({"write" : "0"}).length === 0);
    },

    testSimpleTapeRL : function () {
      t = new Tape();
      t.write(4);
      t.right();
      require(t.position().equals(new Position(1)));
      t.write(5);
      require(t.read() === 5);
      t.left();
      require(t.read() === 4);
      require(t.position().equals(new Position(0)));
      require(t.begin().equals(new Position(0)));
      require(t.end().equals(new Position(1)));
    },

    testSimpleTapeLR : function () {
      t = new Tape();
      t.write(4);
      t.left();
      require(t.position().equals(new Position(-1)));
      t.write(5);
      require(t.read() === 5);
      t.right();
      require(t.read() === 4);
      require(t.position().equals(new Position(0)));
      require(t.begin().equals(new Position(-1)));
      require(t.end().equals(new Position(0)));
    },

    testSimpleTapeWalk : function () {
      t = new Tape('42');
      for (var i = 0; i < 100; i++)
        t.left();
      require(t.read() === '42');
      for (var i = 0; i < 200; i++)
        t.right();
      require(t.read() === '42');
      require(t.length() === 201);
    },

    testSimpleTapeMathWalkWithImportExport : function (t) {
      t = def(t, new Tape(true));
      for (var i = 0; i < 100; i++)
      {
        if (i % 34 !== 0)
          t.write((i + 37) % 41);
        t.right();
      }

      require(t.position().equals(new Position(100)));
      require(t.begin().equals(new Position(0)));
      require(t.end().equals(t.position()));
      require(t.length() === 101);
      t.left();
      var dump = t.toJSON();

      t = new Tape();
      t.input(dump);
      t.right();
      require(t.position().equals(new Position(100)));
      require(t.begin().equals(new Position(0)));
      require(t.end().equals(t.position()));
      require(t.length() === 101);
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

    testRecordedTapeSimpleUndo : function () {
      var t = new RecordedTape(30, '0');
      t.left();
      t.write(5);
      t.left();
      require(t.position().equals(new Position(-2)));
      t.undo();
      require(t.position().equals(new Position(0)));
      require($.inArray(5, t.toJSON().data));
    },

    testRecordedTape20UndosAndRedos : function () {
      var t = new RecordedTape(30, '0');
      for (var i = 0; i < 20; i++) {
        t.left();
        t.snapshot();
      }
      require(t.position().equals(new Position(-20)));
      t.right();
      for (var i = 0; i < 20; i++) {
        t.undo();
      }
      require(t.position().equals(new Position(0)));
    },

    testRecordedTapeContentUndoTest : function () {
      var t = new RecordedTape(30, '0');
      t.write(0);
      t.left();
      t.snapshot();
      t.write(1);
      t.left();
      t.snapshot();
      t.write(2);
      t.snapshot();
      require(t.position().equals(new Position(-2)));
      require(t.read() === 2);
      t.undo();
      require(t.position().equals(new Position(-2)));
      require(t.read() === '0');
      t.undo();
      require(t.position().equals(new Position(-1)));
      require(t.read() === '0');
      t.undo();
      require(t.position().equals(new Position(0)));
      require(t.read() === '0');
    },

    testRecordedTapeAlternate : function () {
      var t = new RecordedTape(30, '0');
      t.left();
      t.left();
      t.snapshot();
      require(t.position().equals(new Position(-2)));
      t.right();
      t.right();
      t.right();
      t.right();
      t.snapshot();
      require(t.position().equals(new Position(2)));
      t.left();
      require(t.position().equals(new Position(1)));

      t.undo();
      t.redo();
      t.undo();
      require(t.position().equals(new Position(-2)));

      t.left();
      t.left();
      t.snapshot();

      // t.redo();   // should trigger error
      require(t.position().equals(new Position(-4)));
    },

    testRecordedTapeMultipleAlternateAndImportExport : function () {
      var t = new RecordedTape(30, '0');
      t.left();
      t.left();
      t.snapshot();

      t.left();
      t.snapshot();

      t.left();
      t.left();
      t.left();

      t.undo();
      require(t.position().equals(new Position(-2)));

      t.left();
      t.left();
      t.left();
      t.snapshot();
      require(t.position().equals(new Position(-5)));

      t.undo();
      require(t.position().equals(new Position(-2)));

      t.redo();
      require(t.position().equals(new Position(-5)));

      t.right();
      require(t.position().equals(new Position(-4)));
      t.snapshot();
      require(t.position().equals(new Position(-4)));

      t.redo(); // must fail

      var t2 = new RecordedTape(30, '4');
      t2.input(t.toJSON());
      t2.undo();
      t2.undo();
      t2.undo();

      t.undo();
      t.undo();
      t.undo();
    },

    testRecordedTapeMathWalkWithImportExport : function () {
      var t = RecordedTape(0, true);
      this.testSimpleTapeMathWalkWithImportExport(t);
    },

    testExtendedTape : function () {
      var t = new ExtendedTape(Infinity, '0');
      require(t.read() === '0');
      require(t.read(new Position(-2)) === '0');
      require(t.read(new Position(2)) === '0');
      t.write('1', new Position(2));
      require(t.read(new Position(2)) === '1');
      t.clear();
      require(t.read(new Position(-2)) === '0');
      require(t.read(new Position(2)) === '0');
      require(t.read(new Position(3)) === '0');
    },

    testExtendedTapeMoveTo : function () {
      var t = new ExtendedTape(Infinity, '1');
      var values = '0123456789';
      for (var i = 0; i < 10; i++) {
        t.write(values[i]);
        t.right();
      }

      var base = t.position();
      t.moveTo(new Position(0));
      require(t.read() === '0');
      t.moveTo(new Position(7));
      require(t.read() === '7');
      t.moveTo(new Position(10));
      require(t.read() === '1');
      t.moveTo(base);

      for (var i = 9; i >= 0; i--) {
        t.left()
        require(t.read() === values[i]);
      }

      require(t.begin().equals(new Position(0)));
      require(t.end().equals(new Position(10)));
    },

    testExtendedTapeShift : function () {
      var t = new ExtendedTape(Infinity, '1');
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

      require(t.begin().equals(new Position(0)));
      require(t.end().equals(new Position(10)));
      require(t.length() === 11);
    },

    testExtendedTapeForEach : function () {
      var t = new ExtendedTape(Infinity, '1');
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

      require(t.begin().equals(new Position(0)));
      require(t.end().equals(new Position(10)));
      require(t.length() === 11);
    },

    testExtendedTapeMathWalkWithImportExport : function () {
      var t = ExtendedTape(0, true);
      this.testSimpleTapeMathWalkWithImportExport(t);
    }
  }

  var keys = Object.getOwnPropertyNames(testcases);
  try {
    for (var key in keys) {
      if (keys[key].slice(0, 4) === 'test')
        testcases[keys[key]]();
    }
  } catch (e) {
    console.info("Testsuite FAILED");
    throw e;
  }
  console.debug("Testsuite successfully passed");
}

// ----------------------------- Main routine -----------------------------

function twobit_xor()
{
  var out = {
    'tape' : {
      'default_value' : '0',
      'cursor' : 0,
      'data' : ['0', '1'],
      'offset' : 1,
      'halted' : false
    },
    'program' : {
      '0' : {
        'Start' : ['0', 'R', 'E'],
        'E' : ['0', 'R', 'E'],
        'O' : ['0', 'R', 'O']
      }, '1' : {
        'Start' : ['1', 'R', 'O'],
        'E' : ['1', 'R', 'O'],
        'O' : ['1', 'R', 'E']
      }, ' ' : {
        'Start' : [' ', 'R', 'Start'],
        'E' : ['0', 'R', 'End'],
        'O' : ['0', 'R', 'End']
      }
    },
    'current_state' : 'Start',
    'final_states' : ['End'],
    'testcases' : twobit_xor_testcases()
  };

  return out;
}

function twobit_xor_testcases()
{
  var testcases = [
    {
      'name' : 'test 00',
      'test_cursor_position' : true,
      'input' : {
        'tape' : { 'cursor' : -1, 'data' : ['0', '0'] },
        'current_state' : 'Start'
      },
      'output' : {
        'tape' : { 'cursor' : 2, 'data' : ['0', '0', '0'] },
        'current_state' : 'End'
      }
    }, {
      'name' : 'test 01',
      'test_cursor_position' : true,
      'input' : {
        'tape' : { 'cursor' : -1, 'data' : ['0', '1'] },
        'current_state' : 'Start'
      },
      'output' : {
        'tape' : { 'cursor' : 2, 'data' : ['0', '1', '1'] },
        'current_state' : 'End'
      }
    }, {
      'name' : 'test 10',
      'test_cursor_position' : true,
      'input' : {
        'tape' : { 'cursor' : -1, 'data' : ['1', '0'] },
        'current_state' : 'Start'
      },
      'output' : {
        'tape' : { 'cursor' : 2, 'data' : ['1', '0', '1'] },
        'current_state' : 'End'
      }
    }, {
      'name' : 'test 11',
      'test_cursor_position' : true,
      'input' : {
        'tape' : { 'cursor' : -1, 'data' : ['1', '1'] },
        'current_state' : 'Start'
      },
      'output' : {
        'tape' : { 'cursor' : 2, 'data' : ['1', '1', '0'] },
        'current_state' : 'End'
      }
    }
  ];
  return testcases;
}

function main()
{
  $("#tm_control_prev").click(function () { app.backwards(); });
  $("#tm_steps_prev").change(function () { app.updateStepsBackwards(); });
  $("#tm_control_next").click(function () { app.forward(); });
  $("#tm_steps_next").change(function () { app.updateStepsForward(); });
  $("#tm_control_reset").click(function () { app.reset(); });
  $("#tm_control_run").click(function () { app.run(); });

  //$("#tm_import").click(function () { app.input(); });
  $("#tm_export").click(function () { app.export(); });
  $("#tm_example").change(function () { app.loadExampleProgram(); });
  $("#tm_testcase").change(function () { app.loadTestcase(); });

  $("#tm_name").change(function () { app.updateHistorySize(); });
  $("#tm_history_size").change(function () { app.updateHistorySize(); });
  $("#tm_speed").change(function () { app.updateSpeed(); });

  $("#tm_apply_tape").click(function () { app.loadTape(); });
  $("#tm_transition_table").change(function () { app.updateTransitions(); });

  // overlay
  $("#tm_import").click(function (e) {
    if (!$("#overlay").is(':visible')) {
      $("#overlay").show(100);
      $("#overlay_text").delay(150).show(400);
    }
  });

  $("#overlay").click(function ()
  {
    if ($("#overlay").is(':visible'))
    {
      $("#overlay").delay(200).hide(100);
      $("#overlay_text").hide(200);
    }
  });

  //var app = defaultApplication();
  testsuite();

  return app;
}