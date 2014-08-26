//
// turingmachine.js
//
// A turing machine web application for educational purposes.
// The main routine is at the end of the document.
//
// Dependencies:
//   - jQuery (tested with 1.11.1)
//
// Remarks:
//   - TODO, IMPROVE and FEATURE flags are used in the source code.
//   - toJSON and fromJSON can be used to export/import data from every object
//
// Contributions:
// - FelixHOer (design discussion)
//   Thanks!
//
// Release 0.5.0-tutors
// (C) 2013-2014, Public Domain, Lukas Prokop
//

// --------------------------- global variables ---------------------------

app_name = "turingmachine.js";
app_version = "0.5.0-tutors";
app_author = "Lukas Prokop <admin@lukas-prokop.at>";

// Movement values, immutable const
mov = {
  LEFT  : "Left",
  RIGHT : "Right",
  HALT  : "Halt",
  STOP  : "Stop"
};

// default value for tapes, immutable const
generic_default_value = 0;

// global variable containing all occuring states
// Remark. Will be redefined as OrderedSet instance.
states = [];

// global variable containing all written letters
// Remark. Will be redefined as OrderedSet instance.
alphabet = [];

// global variable storing the latest testcase error message
last_testcase_error = '';

// global variable storing whether or not current program is example program
is_example_program = true;

// -------------------------------- Helpers -------------------------------

// Default parameters abstraction
function def(arg, val) { return (typeof arg !== 'undefined') ? arg : val; }

// assert statement
function require(cond, msg)
{
  if (!cond)
    throw new AssertionException(msg);
}

// Testing integer array equivalence
var integerArrayEqual = function (arr1, arr2) {
  if (arr1.length !== arr2.length)
    return false;
  for (var i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i])
      return false;
  }
  return true;
};

// Allow objects to inherit from an *instance* as prototype
// Basically a wrapper for Object.create
var inherit = function (prototype, properties)
{
  var object = Object.create(prototype, {});
  for (var key in properties) {
    var desc = Object.getOwnPropertyDescriptor(properties, key);
    Object.defineProperty(object, key, desc);
  }
  return object;
}

// Normalizes values written to the tape
var normalizeSymbol = function (symb) {
  if (symb === null || typeof symb === "undefined")
    return " ";
  if (typeof symb === "string") {
    if (symb.match(/^\s*$/))
      return ' ';
    if (symb === "_x_ (leer)" || symb === "_x (leer)_" || symb === "x")
      return " ";
    symb = symb.trim();
  }
  return symb;
}

// String repetition as per String.prototype.repeat by ECMAScript 6.0
var repeat = function (str, rep) {
  var result = '';
  for (var i = 0; i < rep; i++)
    result += str;
  return result;
}

// a set implementation
function OrderedSet(initial_values) {
  // @member values
  var values = [];

  var findIndex = function (value) {
    if (values.length === 0)
      return 0;
    else if (values[values.length - 1] < value)
      return values.length;
    else
      // linear search
      for (var i = 0; i < values.length; i++) {
        if (value <= values[i])
          return i;
      }
  };

  // @method OrderedSet.push: append some value to the set
  var push = function (value) {
    var index = findIndex(value);
    var found = values[index] === value;
    if (!found)
      values.splice(index, 0, value);
    return !found;
  };

  // @method OrderedSet.remove: remove some value from the set
  var remove = function (value) {
    var index = findIndex(value);
    if (values[index] === value) {
      values.splice(index, 1);
      return true;
    } else
      return false;
  };

  // @method OrderedSet.contains: Does this OrderedSet contain this value?
  var contains = function (value) {
    return values[findIndex(value)] === value;
  };

  // @method OrderedSet.size: Returns size of the set
  var size = function () {
    return values.length;
  };

  // @method OrderedSet.equals: Do this set equal with the given parameter?
  var equals = function (other) {
    var o = other.toJSON();
    if (o.length !== values.length)
      return false;
    for (var i = 0; i < o.length; i++) {
      if (values[i] !== o[i])
        return false;
    }
    return true;
  };

  // @method OrderedSet.toString: returns OrderedSet in string repr
  var toString = function () {
    return "set[" + values.join(",") + "]";
  };

  // @method OrderedSet.toJSON: export set into JSON data structure
  var toJSON = function () {
    return values.slice(0);
  };

  // @method OrderedSet.fromJSON: import set from JSON data structure
  var fromJSON = function (data) {
    values = data;
  };

  if (typeof initial_values !== 'undefined')
    for (var i = 0; i < initial_values.length; i++)
      push(initial_values[i]);

  return { push: push, remove: remove, contains: contains,
           size: size, equals: equals, toString: toString,
           toJSON: toJSON, fromJSON: fromJSON };
}
states = new OrderedSet();
alphabet = new OrderedSet();

// "inc() inc() dec()" results in "[+2, -1]"
// "inc() dec() inc()" results in "[+1, -1, +1]"
var CountingQueue = function () {
  var counter = [];

  var inc = function () {
    if (counter.length === 0)
      counter.push(1);
    else if (counter[counter.length - 1] > 0)
      counter[counter.length - 1] += 1;
    else if (counter[counter.length - 1] < 0)
      counter.push(1);
  };

  var dec = function () {
    if (counter.length === 0)
      counter.push(-1);
    else if (counter[counter.length - 1] > 0)
      counter.push(-1);
    else if (counter[counter.length - 1] < 0)
      counter[counter.length - 1] -= 1;
  };

  var pop = function () {
    return counter.splice(0, 1);
  };

  var total = function () {
    return counter.map(function (v) { return Math.abs(v); })
      .reduce(function (a, b) { return a + b; });
  };

  var isEmpty = function () { return counter.length === 0; }

  return {
      inc: inc, dec: dec, pop: pop,
      total: total, isEmpty: isEmpty
  };
};

// ------------------------------ Exceptions ------------------------------

// @exception thrown if value out of tape bounds is accessed
function OutOfTapeException(position)
{
  if (typeof position === 'undefined')
    var err = {
      name : "Out of Tape Bounds Exception",
      message : "I ran outside the tape",
      toString : function () { return this.name + ": " + this.message }
    };
  else
    var err = {
      name : "Out of Tape Bounds Exception",
      message : "Position " + position + " is outside of tape",
      toString : function () { return this.name + ": " + this.message }
    };

  var interm = Error.apply(this, inherit(arguments, err));
  interm.name = this.name = err.name;
  this.message = interm.message = err.message;

  Object.defineProperty(this, 'stack',
    { get: function() { return interm.stack; } }
  );

  return this;
}

// @exception thrown if number of undos exceeds history size
function OutOfHistoryException(step_id)
{
  var err = {
    name : "Out of History Exception",
    message : "Cannot step any further back in history "
      + "(bounds are 0 and history_size).",
    toString : function () { return this.name + ": " + this.message }
  };
  var interm = Error.apply(this, inherit(arguments, err));
  interm.name = this.name = err.name;
  this.message = interm.message = err.message;

  Object.defineProperty(this, 'stack',
    { get: function() { return interm.stack; } }
  );

  return this;
}

// @exception thrown if a HALT instruction is executed
function HaltException()
{
  var err = {
    name : "Halt Exception",
    message : "Turingmachine halted due to HALT instruction",
    toString : function () { return this.name + ": " + this.message }
  };
  var interm = Error.apply(this, inherit(arguments, err));
  interm.name = this.name = err.name;
  this.message = interm.message = err.message;

  Object.defineProperty(this, 'stack',
    { get: function() { return interm.stack; } }
  );

  return this;
}

// @exception thrown, if an assertion goes wrong
function AssertionException(msg)
{
  var err = {
    name : "Assertion",
    message : msg ? "Condition is not satisfied: " + msg : "Condition not satisfied",
    toString : function () { return this.name + ": " + this.message }
  };
  var interm = Error.apply(this, inherit(arguments, err));
  interm.name = this.name = err.name;
  this.message = interm.message = err.message;

  Object.defineProperty(this, 'stack',
    { get: function() { return interm.stack; } }
  );

  return this;
}

// --------------------------------- State --------------------------------

// @object State: State of the Turing machine.
function State(name)
{
  // @member State.name

  if (isState(name))
    name = name.name;
  states.push(name);

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
    throw new AssertionException("Is not a valid state: " + obj);
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
  };
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
  return typeof normalizeMovement(obj) !== 'undefined';
}

// Throw exception if `obj` is not a Movement object
function requireMovement(obj)
{
  if (!(isMovement(obj)))
    throw new AssertionException("Is not a valid movement: " + obj);
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
    return pos(index + summand);
  };

  // @method Position.sub: Returns Position instance at pos this+subtrahend
  var sub = function (subtrahend) {
    return pos(index - subtrahend);
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
    throw new AssertionException("Is not a position");
}

// Convenient function to create position objects
function pos(p)
{
  return new Position(p);
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
    if (!other)
      return false;
    return write === other.write && move.equals(other.move) &&
        state.equals(other.state);
  };

  // @method InstrTuple.toString: String representation of InstrTuple objects
  var toString = function () {
    return "{instruction: write " + write + ", move "
      + move + " and goto state "
      + state + "}";
  };

  // @method InstrTuple.toJSON: JSON representation of InstrTuple objects
  var toJSON = function () {
    return [write, move.toJSON(), state.toJSON()];
  };

  return {
    write : write,
    move : move,
    state : state,

    equals : equals,
    toString : toString,
    toJSON : toJSON,
    isInstruction : true
  };
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
  // maps [read_symbol][from_state] to [write_symbol, movement, to_state]
  // but the value is stored as InstrTuple
  var program = {};

  var _getHash = function (v) {
    v = (typeof v === 'string') ? "_" + v : v;
    v = normalizeSymbol(v);
    var c = v.isState ? ":State" : "";
    var ret = "" + (typeof v) + c + "$" + v;
    return ret;
  };

  var _safeGet = function (read_symbol, from_state) {
    requireState(from_state);
    from_state = _getHash(from_state);
    read_symbol = _getHash(read_symbol);
    if (!program[read_symbol])
      return undefined;
    return program[read_symbol][from_state];
  };

  var _safeSet = function (read_symbol, from_state, value, overwrite) {
    overwrite = def(overwrite, true);
    requireState(from_state);
    require(typeof value !== 'undefined' && isInstruction(value));
    read_symbol = _getHash(read_symbol);
    from_state = _getHash(from_state);

    if (typeof program[read_symbol] === 'undefined') {
      program[read_symbol] = {};
      program[read_symbol][from_state] = value;
      return true;
    }

    if (typeof program[read_symbol][from_state] !== 'undefined' && !overwrite)
      return false;

    program[read_symbol][from_state] = value;
    return true;
  };

  // @method Program.clear: Clear program table
  var clear = function () {
    program = {};
  };

  // @method Program.isDefined: Can we handle the specified situation?
  var exists = function (read_symbol, from_state) {
    return typeof get(read_symbol, from_state) !== 'undefined';
  };

  // @method Program.set: Set entry in program
  var set = function (read_symbol, from_state, write, move, to_state) {
    requireState(from_state);
    var value;

    if (isInstruction(write)) {
      // InstrTuple was provided instead of [write, move, to_state]
      value = write;
    } else {
      require(typeof mov !== 'undefined');
      write = normalizeSymbol(write);
      requireMovement(move);
      requireState(to_state);

      value = new InstrTuple(write, move, to_state);
    }

    _safeSet(read_symbol, from_state, value);
  };

  // @method Program.get: Return InstrTuple for specified situation or undefined
  var get = function (read_symbol, from_state) {
    requireState(from_state);
    return _safeGet(read_symbol, from_state);
  };

  // @method Program.fromJSON: Import a program
  var fromJSON = function (data) {
    if (typeof data === "string")
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new AssertionException("Cannot import invalid JSON as program!");
      }

    clear();

    for (var key1 in data) {
      program[key1] = {};
      for (var key2 in data[key1])
      {
        var write_symbol = data[key1][key2][0];
        var movement = new Movement(data[key1][key2][1]);
        var to_state = new State(data[key1][key2][2]);

        program[key1][key2] = new InstrTuple(write_symbol, movement, to_state);
      }
    }
  };

  // @method Program.toString: String representation of Program object
  var toString = function () {
    var repr = "<program>\n";
    for (var key1 in program)
      for (var key2 in program[key1])
        repr += "  " + key1 + ";" + key2 + "  = "
          + program[key1][key2].toString() + "\n";
    repr += "</program>";

    return repr;
  };

  // @method Program.toJSON: JSON representation of Program object
  var toJSON = function () {
    var data = {};
    for (var key1 in program) {
      data[key1] = {};
      for (var key2 in program[key1])
        data[key1][key2] = program[key1][key2].toJSON();
    }

    return data;
  };

  return {
    clear : clear,
    exists : exists,
    set : set,
    get : get,
    fromJSON : fromJSON,
    toString : toString,
    toJSON : toJSON
  };
};

// --------------------------------- Tape ---------------------------------

// @object Tape: Abstraction for an infinite tape.
function Tape(default_value)
{
  // @member Tape.default_value
  // value to be written if new memory cell is created
  default_value = def(default_value, generic_default_value);
  // @member Tape.offset
  var offset = 0;
  // @member Tape.cursor
  var cursor = pos(0);
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
    return pos(-offset);
  };

  // @method Tape.end: Get most-right, reached Position at Tape
  var end = function () {
    return pos(tape.length - offset - 1);
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
    alphabet.push(value);

    var index = cursor.index + offset;
    tape[index] = normalizeSymbol(value);
    _testInvariants();
  };

  // @method Tape.read: Return value at current cursor position
  var read = function () {
    var index = cursor.index + offset;
    _testInvariants();
    return tape[index];
  };

  // @method Tape.length: Length of Tape of accessed elements
  var size = function () {
    return tape.length;
  };

  // @method Tape.fromJSON: Import Tape data
  var fromJSON = function (data) {
    if (typeof data['data'] === 'undefined' ||
        typeof data['cursor'] === 'undefined')
      throw new AssertionException("data parameter incomplete.");

    default_value = def(data['default_value'], generic_default_value);
    default_value = normalizeSymbol(default_value);
    offset = def(data['offset'], 0);
    cursor = pos(data['cursor']);
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
  };

  // @method Tape.fromHumanString:
  // Import a human-readable representation of a tape
  var fromHumanString = function (str) {
    // one position per symbol, *symbol* denotes the cursor position
    var cursor = str.indexOf("*") + 1;
    if (str[cursor + 1] !== "*" || str.indexOf("*", cursor + 2) !== -1) {
      throw new AssertionException("Invalid human-readable string provided");
    }

    default_value = normalizeSymbol(generic_default_value);
    offset = def(data['offset'], cursor - 1);

    tape = [];
    for (var i = 0; i < str.length; i++) {
      if (i !== cursor - 1 && i !== cursor + 1)
        tape.push(str[i]);
    }
  };

  // @method Tape.toJSON: Return JSON representation of Tape
  var toJSON = function () {
    return {
      default_value : default_value,
      offset : offset,
      cursor : cursor.toJSON(),
      data : tape
    };
  };

  return {
    default_value : default_value,

    position : position,
    begin : begin,
    end : end,
    left : left,
    right : right,
    write : write,
    read : read,
    size : size,
    fromJSON : fromJSON,
    toJSON : toJSON,
    fromHumanString : fromHumanString
  };
}

// ----------------------------- RecordedTape -----------------------------

// @object RecordedTape: A tape with a history (can restore old states).
// invariant: RecordedTape provides a superset API of Tape

// A Tape which also provides a history with the undo and snapshot methods.
// The state is stored whenever method 'snapshot' is called.
// In other words: it can revert back to previous snapshots using 'undo'.
function RecordedTape(default_value, history_size)
{
  // @member RecordedTape.history_size
  // @member RecordedTape.default_value

  if (typeof history_size === 'undefined')
    history_size = Infinity;
  if (history_size !== Infinity)
    history_size = parseInt(def(history_size, 10));
  require(!isNaN(history_size), "History size must be integer");

  // @member RecordedTape.history
  // Array of arrays. One array per snapshot. Stores all actions.
  var history = [[]];

  // @member RecordedTape.simple_tape
  var simple_tape = new Tape(default_value);

  // General overview for instruction set:
  //    "LEFT", [$positions]
  //    "RIGHT", [$positions]
  //    "WRITE", $old_value, $new_value

  // @method RecordedTape._oppositeInstruction: Get opposite instruction
  var _oppositeInstruction = function (instr) {
    if (instr[0] === "LEFT")
      return (typeof instr[1] === 'undefined')
        ? ["RIGHT"] : ["RIGHT", instr[1]];
    else if (instr[0] === "RIGHT")
      return (typeof instr[1] === 'undefined')
        ? ["LEFT"] : ["LEFT", instr[1]];
    else if (instr[0] === "WRITE")
      return ["WRITE", instr[2], instr[1]];
    else
      throw new AssertionException("Unknown VM instruction");
  };

  // @method RecordedTape._applyInstruction: Run an instruction
  //         This method runs the instruction given
  var _applyInstruction = function (instr) {
    if (instr[0] === "LEFT")
      left(instr[1]);
    else if (instr[0] === "RIGHT")
      right(instr[1]);
    else if (instr[0] === "WRITE")
      write(instr[1], instr[2]);
    else
      throw new AssertionException("Unknown instruction");
  };

  // @method RecordedTape._applyNativeInstruction: Run instruction natively
  //         This method runs the instructions when jumping around in history
  var _applyNativeInstruction = function (instr) {
    if (instr[0] === "LEFT")
      for (var i = 0; i < def(instr[1], 1); i++)
        simple_tape.left();
    else if (instr[0] === "RIGHT")
      for (var i = 0; i < def(instr[1], 1); i++)
        simple_tape.right();
    else if (instr[0] === "WRITE")
      simple_tape.write(instr[2]);
    else
      throw new AssertionException("Unknown instruction");
  };

  // @method RecordedTape.simplifyHistoryFrame: Simplify the given history frame
  var _simplifyHistoryFrame = function (data) {
    var i = 0;
    while (data.length > 1 && i <= data.length - 2) {
      if ((data[i][0] === 'LEFT' || data[i][0] === 'RIGHT') &&
        data[i][0] === data[i + 1][0])
      {
        var steps = data[i][1] + data[i + 1][1];
        data.splice(i, 1);
        data[i][1] = steps;
      } else if ((data[i][0] === 'LEFT' || data[i][0] === 'RIGHT') && data[i][1] === 0) {
        data.splice(i, 1);
      } else {
        i += 1;
      }
    }
    return data;
  };

  // @method RecordedTape.resizeHistory: Shorten history if necessary
  var _resizeHistory = function (size) {
    if (size === Infinity)
      return;
    if (size <= 0)
      return;
    history = history.slice(-size, history.length);
  };

  // @method RecordedTape.getHistory: Return the stored history
  var getHistory = function () {
    return history;
  };

  // @method RecordedTape.clearHistory: Clear the history of this tape
  var clearHistory = function () {
    history = [[]];
  };

  // @method RecordedTape.left: Go left.
  var left = function (positions) {
    positions = def(positions, 1);
    history[history.length - 1].push(["LEFT", positions]);
    _resizeHistory(history_size);
    for (var i = 0; i < positions; i++)
      simple_tape.left();
  };

  // @method RecordedTape.right: Go right.
  var right = function (positions) {
    positions = def(positions, 1);
    history[history.length - 1].push(["RIGHT", positions]);
    _resizeHistory(history_size);
    for (var i = 0; i < positions; i++)
      simple_tape.right();
  };

  // @method RecordedTape.write: Write a value to tape.
  var write = function (new_value, old_value) {
    old_value = def(old_value, simple_tape.read());
    history[history.length - 1].push(["WRITE", old_value, new_value]);
    _resizeHistory(history_size);
    simple_tape.write(new_value);
  };

  // @method RecordedTape._undoOneSnapshot: Undo all actions of latest snapshot
  var _undoOneSnapshot = function (frame) {
    for (var i = frame.length - 1; i >= 0; i--) {
      var undo = _oppositeInstruction(frame[i]);
      _applyNativeInstruction(undo);
    }
  };

  // @method RecordedTape.undo: Go back to last snapshot. Returns success.
  var undo = function () {
    if (history.length === 1 && history[0].length === 0)
      throw OutOfHistoryException();

    _undoOneSnapshot(history.pop());
    return true;
  };

  // @method RecordedTape.snapshot: Take a snapshot.
  var snapshot = function () {
    var last = history.length - 1;
    history[last] = _simplifyHistoryFrame(history[last]);
    history.push([]);
    _resizeHistory(history_size);
  };

  // @method RecordedTape.toJSON: Return JSON representation of RecordedTape
  var toJSON = function (export_history) {
    export_history = def(export_history, true);
    if (!export_history)
      return simple_tape.toJSON();

    var data = simple_tape.toJSON();
    data['history'] = history;
    data['history_size'] = history_size === Infinity ? null : history_size;

    return data;
  }

  // @method RecordedTape.fromJSON: Import RecordedTape data
  var fromJSON = function (data) {
    clearHistory();
    if (typeof data['history'] !== 'undefined')
      history = data['history'];
    if (typeof data['history_size'] !== 'undefined')
      if (data['history_size'] === null)
        history_size = Infinity;
      else {
        history_size = parseInt(data['history_size']);
        require(!isNaN(history_size));
      }
    _resizeHistory(history_size);

    default_value = normalizeSymbol(data['default_value']);
    return simple_tape.fromJSON(data);
  }

  return inherit(simple_tape, {
    left : left,
    right : right,
    write : write,
    undo : undo,
    snapshot : snapshot,
    getHistory : getHistory,
    clearHistory : clearHistory,
    toJSON : toJSON,
    fromJSON : fromJSON,

    // TODO: only for debugging
    history : history,
    simple_tape : simple_tape
  });
}

// ----------------------------- ExtendedTape -----------------------------

// @object ExtendedTape: An extension of Tape with a nice API.
// invariant: ExtendedTape provides a superset API of RecordedTape

function ExtendedTape(default_value, history_size)
{
  // @member ExtendedTape.rec_tape
  var rec_tape = new RecordedTape(default_value, history_size);
  // @member ExtendedTape.halted: If true, tape cannot be written.
  var halted = false;

  // @method ExtendedTape.length: Return length of accessed Tape elements
  var size = function (pos) {
    var begin = rec_tape.begin();
    var end = rec_tape.end();

    return Math.abs(begin.index) + Math.abs(end.index) + 1;
  };

  // @method ExtendedTape.clear: Clear values of the tape
  var clear = function () {
    halted = false;
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

    rec_tape.clearHistory();
  };

  // @method ExtendedTape.moveTo: Move to the given position
  var moveTo = function (goto) {
    requirePosition(goto);
    while (goto.index < rec_tape.position().index)
      rec_tape.left();
    while (goto.index > rec_tape.position().index)
      rec_tape.right();
    require(goto.equals(rec_tape.position()));
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

  // @method ExtendedTape.left: Go left, return value of old position
  var left = function (steps) {
    var old_value = rec_tape.read();
    rec_tape.left(steps);
    return old_value;
  };

  // @method ExtendedTape.right: Go one right, return value of old position
  var right = function (steps) {
    var old_value = rec_tape.read();
    rec_tape.right(steps);
    return old_value;
  };

  // @method ExtendedTape.move: Move 1 step in some specified direction
  var move = function (move) {
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
    } else
      throw new AssertionException("Unknown movement '" + move + "'");
  };

  // @method ExtendedTape.strip: Give me an array and I will trim default values
  //                             but only on the left and right border
  var strip = function (array, default_val) {
    default_val = def(default_val, default_value);
    while (array.length > 0 && array[0] === default_val)
      array = array.slice(1);
    while (array.length > 0 && array[array.length - 1] === default_val)
      array = array.slice(0, array.length - 1);
    return array;
  };

  // @method ExtendedTape.toString: String representation of ExtendedTape objects
  var toString = function () {
    var base = rec_tape.position();
    var values = [];
    var finish_loop = false;

    moveTo(rec_tape.begin());
    while (!finish_loop) {
      var value = rec_tape.read();
      if (typeof value === 'undefined' || value === null)
        value = ' ';

      // Make cursor visible
      if (rec_tape.position().equals(base))
        values.push("*" + value + "*");
      else
        values.push(value.toString());

      if (rec_tape.position().equals(rec_tape.end()))
        finish_loop = true;
      else
        rec_tape.right();
    }
    moveTo(base);

    values = strip(values);
    return values.join(",");
  };

  // @method ExtendedTape.getAlphabet: Get alphabet of current Tape
  //         alphabet = OrderedSet of used characters in tape
  var getAlphabet = function () {
    var _values = rec_tape.toJSON()['data'];
    var values = new OrderedSet();

    // remove duplicate entries
    forEach(function(pos, element) {
      values.push(element);
    });

    return values;
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
  var equals = function (tape, ignore_length, ignore_cursor) {
    ignore_length = def(ignore_length, true);
    // the absolute position
    // NOT relative to begin and end or any other stuff
    ignore_cursor = def(ignore_cursor, true);

    if (!ignore_cursor && !position().equals(tape.position()))
      return false;

    var values1 = toJSON()['data'];
    var values2 = tape.toJSON()['data'];

    if (ignore_length) {
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
  var toJSON = function (export_history) {
    var out = rec_tape.toJSON(export_history);
    out['halted'] = halted;
    return out;
  };

  // @method ExtendedTape.fromJSON: import data from given array
  var fromJSON = function (data) {
    halted = def(data['halted'], false);
    default_value = normalizeSymbol(data['default_value']);
    if (typeof data['history_size'] !== 'undefined')
      if (data['history_size'] === null)
        history_size = Infinity;
      else {
        history_size = parseInt(data['history_size']);
        require(!isNaN(history_size));
      }
    rec_tape.fromJSON(data);
  };

  return {
    default_value : default_value,
    position : rec_tape.position,
    begin : begin,
    end : end,
    left : left,
    right : right,
    write : write,
    read : read,
    size : size,
    fromJSON : fromJSON,
    fromHumanString : rec_tape.fromHumanString,
    toJSON : toJSON,
    undo : rec_tape.undo,
    snapshot : rec_tape.snapshot,
    getHistory : rec_tape.getHistory,
    clearHistory : rec_tape.clearHistory,
    clear : clear,
    moveTo : moveTo,
    move : move,
    getAlphabet : getAlphabet,
    forEach : forEach,
    equals : equals,
    toString : toString,
    isTape : true
  };
}

// --------------------------- UserFriendlyTape ---------------------------

// @object UserFriendlyTape: Tape adding awkward & special but handy methods.
// invariant: UserFriendlyTape provides a superset API of ExtendedTape

function UserFriendlyTape(default_value, history_size)
{
  // @method UserFriendlyTape.ext_tape
  var ext_tape = new ExtendedTape(default_value, history_size);

  // @method ExtendedTape.read: Read n values at position pos
  // the value at pos is at index floor((result.length - 1) / 2)
  // if n == 1 or not set, then the return value is returned directly
  var read = function (pos, n) {
    if (typeof pos === 'undefined' && n === 1)
      return ext_tape.read();

    pos = def(pos, ext_tape.position());
    n = def(n, 1);
    requirePosition(pos);
    require(!isNaN(n / 2));
    require(n !== 0);

    var base = ext_tape.position();
    var vals = [];
    var lower_bound = pos.index - parseInt((n - 1) / 2);
    ext_tape.moveTo(new Position(lower_bound));

    for (var i = lower_bound; i < lower_bound + n; i++) {
      vals.push(ext_tape.read());
      if (i !== lower_bound + n - 1)
        ext_tape.right();
    }
    ext_tape.moveTo(base);

    if (vals.length === 1)
      return vals[0];

    if (vals.length !== n)
      throw new Error("Invalid number of values returned by read");

    return vals;
  };

  // @method UserFriendlyTape.setByString
  // Clear tape, goto position 0, write every element of the parameter
  // consecutively to the right of position 0, go back to position 0
  // (which has default_value but at pos(1) is array[0])
  var fromArray = function (array) {
    ext_tape.clear();
    ext_tape.moveTo(pos(0));
    for (var i = 0; i < array.length; i++) {
      ext_tape.right();
      ext_tape.write(array[i]);
    }
    ext_tape.moveTo(pos(0));
  };

  // @method UserFriendlyTape.fromJSON: Import data from JSON
  var fromJSON = function (data) {
    default_value = normalizeSymbol(data['default_value']);
    if (typeof data['history_size'] !== 'undefined')
      if (data['history_size'] === null)
        history_size = Infinity;
      else {
        history_size = parseInt(data['history_size']);
        require(!isNaN(history_size));
      }
    ext_tape.fromJSON(data);
  };

  // @method UserFriendlyTape.toBitString
  // Assume tape contains a sequence of default_value, "0" and "1".
  // Return a string describing the sequence like "00010011"
  // (default_value at left and right gets stripped).
  var toBitString = function () {
    var data = ext_tape.toJSON()['data'];
    var bitstring = "";
    for (var i in data) {
      var value = "" + normalizeSymbol(data[i]);
      require(value.length === 1,
        "Cannot write value with more than 1 character to BitString"
      );
      bitstring += value;
    }

    // strip default values
    while (bitstring.length > 0 && bitstring[0] === default_value)
      bitstring = bitstring.slice(1);
    while (bitstring.length > 0 && bitstring[bitstring.length - 1] === default_value)
      bitstring = bitstring.slice(0, -1);

    return bitstring;
  };

  // @method UserFriendlyTape.clone: Return clone this tape
  var clone = function () {
    var cloned = new UserFriendlyTape();
    cloned.fromJSON(ext_tape.toJSON());
    return cloned;
  };

  return inherit(ext_tape, {
    read : read,
    fromArray : fromArray,
    fromJSON : fromJSON,
    toBitString : toBitString,
    clone : clone,
    isUserFriendlyTape : true
  });
}

// -------------------------------- Machine -------------------------------

// @object Machine: Putting together Program, Tape and state handling.
// This is the actual Turingmachine abstraction.

function Machine(program, tape, final_states, initial_state, inf_loop_check)
{
  // @member Machine.program
  require(typeof program !== 'undefined');
  // @member Machine.tape
  require(typeof tape !== 'undefined');
  // @member Machine.initial_tape
  var initial_tape = tape.toJSON();

  // @member Machine.final_states
  require(final_states.length > 0);
  for (var key in final_states)
    requireState(final_states[key]);

  // @member Machine.current_state
  requireState(initial_state);
  var current_state = initial_state;

  // @member Machine.state_stack
  var state_stack = [];

  // @member Machine.default_check_inf_loop, const immutable
  var default_check_inf_loop = 500;

  // @member Machine.inf_loop_check
  inf_loop_check = def(inf_loop_check, default_check_inf_loop);

  // @member Machine.final_state_reached
  var final_state_reached = false;

  // @member Machine.undefined_instruction
  var undefined_instruction = false;

  // @member Machine.name
  var name = 'machine ' + parseInt(Math.random() * 10000);

  // @member Machine.step_id
  var step_id = 0;

  // @member Machine.events
  // @callback initialized(program name)
  // @callback possiblyInfinite(steps executed)
  //    If one callback returns false, execution is aborted
  // @callback undefinedInstruction(read symbol, state)
  // @callback finalStateReached(state)
  // @callback valueWritten(old value, new value)
  // @callback movementFinished(movement)
  var valid_callbacks = ['initialized', 'possiblyInfinite',
    'undefinedInstruction', 'finalStateReached', 'valueWritten',
    'movementFinished'];
  var events = { };
  for (var i in valid_callbacks)
    events[i] = [];

  // @method Machine.addEventListener: event listener definition
  var addEventListener = function (evt, callback) {
    if ($.inArray(evt, valid_callbacks) !== -1) {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push(callback);
    } else {
      require(false, "Unknown event " + evt);
    }
  };

  // @method Machine.cursor: Return the current cursor Position
  var getCursor = function () {
    return tape.position();
  };

  // @method Machine.setCursor: Jump to a certain position on the tape
  var setCursor = function (pos) {
    tape.moveTo(pos);

    for (var i in events['movementFinished'])
      events['movementFinished'][i](null);
  };

  // @method Machine.getState: Get current state
  var getState = function () {
    return current_state;
  };

  // @method Machine.getStep: Get number of operations performed so far
  var getStepId = function () {
    return step_id;
  };

  // @method Machine.getMachineName: Return the machine name
  var getMachineName = function () {
    return name;
  };

  // @method Machine.setMachineName: Give the machine a specific name
  var setMachineName = function (machine_name) {
    name = machine_name;
  };

  // @method Machine.getPosition: Get tape position
  var getPosition = function () {
    return tape.position();
  };

  // @method Machine.getTapeContent: Get tape content (array of values)
  var getTapeContent = function () {
    return tape.toJSON()['data'];
  };

  // @method Machine.finalStateReached: Has a final state been reached?
  var finalStateReached = function () {
    return final_states.indexOf(current_state) >= 0 || final_state_reached;
  };

  // @method Machine.undefinedInstructionOccured
  //   Did a failed lookup in program occur?
  var undefinedInstructionOccured = function () {
    return undefined_instruction;
  };

  // @method Machine.finished: Was a final state reached or
  //   was some instruction not found?
  var finished = function () {
    return finalStateReached() || undefinedInstructionOccured();
  }

  // @method Machine.addFinalState
  var addFinalState = function (state) {
    requireState(state);
    final_states.push(state);
  };

  // @method Machine.setFinalStates
  var setFinalStates = function (states) {
    for (var k in states)
      require(isState(states[k]),
        "Cannot add non-State object as final state");
    final_states = states;
  };

  // @method Machine.prev: Undo last `steps` operation(s)
  var prev = function (steps) {
    var steps = def(steps, 1);
    tape.undo();

    final_state_reached = false;
    undefined_instruction = false;

    try {
      for (var step = 0; step < steps; step++)
        tape.undo();
    } catch (e) {
      if (e.name === "Out of History Exception")
        return false;
      throw e;
    }

    step_id -= 1;
    return true;
  };

  // @method Machine.next: run `steps` step(s)
  //   return whether or not all `steps` steps have been performed
  //   if one "possibleInfinite" callback returns false in the last step,
  //     false is returned (even though all steps were run)
  var next = function (steps) {
    steps = def(steps, 1);
    if (finished())
      return false;

    // save current state
    tape.snapshot();
    state_stack.push(current_state);

    // run `steps` operations
    for (var i = 0; i < steps; i++)
    {
      var read_symbol = tape.read();
      var instr = program.get(read_symbol, current_state);

      if (typeof instr !== 'undefined')
      {
        // write
        var old_value = tape.read();
        tape.write(instr.write);
        for (var evt in events['valueWritten'])
          events['valueWritten'][evt](old_value, instr.write);

        // move
        tape.move(instr.move);
        for (var evt in events['movementFinished'])
          events['movementFinished'][evt](instr.move);

        // set state
        current_state = instr.state;


        console.log("Transitioning from '" + read_symbol.toString() + "' in "
          + current_state.toString() + " by moving " + instr.move.toString()
          + " writing '" + instr.write + "' going into "
          + instr.state.toString());

        for (var fs in final_states) {
          if (final_states[fs].equals(current_state)) {
            final_state_reached = true;
            for (var evt in events['finalStateReached'])
              events['finalStateReached'][evt](read_symbol, current_state);
            return false;
          }
        }
      } else {
        undefined_instruction = true;
        for (var evt in events['undefinedInstruction'])
          events['undefinedInstruction'][evt](read_symbol, current_state);
        return false;
      }

      step_id += 1;

      if (step_id % inf_loop_check === 0 && inf_loop_check !== 0) {
        for (var evt in events['possiblyInfinite'])
          if (events['possiblyInfinite'][evt](step_id) === false)
            return false;
      }
    }

    return true;
  };

  // @method Machine.run: Run operations until a final state is reached
  //   returns true if final state reached, else false
  var run = function () {
    while (!finished())
      if (!next(1))
        break;

    return final_state_reached;
  };

  // @method Machine.reset: Reset machine to initial state
  var reset = function () {
    program.clear();
    tape.clear();
    tape.fromJSON(initial_tape);
    current_state = initial_state;
    state_stack = [];
    final_state_reached = false;
    undefined_instruction = false;
    step_id = 0;
    events = {};
  };

  // @method Machine.fromJSON: Import a Machine
  var fromJSON = function (data) {
    if (typeof data['current_state'] === 'undefined' ||
        typeof data['tape'] === 'undefined' ||
        typeof data['program'] === 'undefined')
      throw AssertionException("data parameter is incomplete");

    tape.fromJSON(data['tape']);
    initial_tape = tape.toJSON();
    program.fromJSON(data['program']);

    step_id = def(parseInt(data['step']), 0);
    require(!isNaN(step_id));

    current_state = new State(data['current_state']);
    initial_state = current_state;

    inf_loop_check = def(data['inf_loop_check'], default_check_inf_loop);
    undefined_instruction = def(data['undefined_instruction'], false);
    final_state_reached = def(data['final_state_reached'], false);
    events = def(data['events'], {});
    name = def(data['name'], name);

    var ss = [];
    for (var i in def(data['state_stack'], []))
      ss.push(new State(data['state_stack']));
    state_stack = ss;

    fs = [];
    for (var i in def(data['final_states'], []))
      fs.push(new State(data['final_states'][i]));
    final_states = fs;
  };

  // @method Machine.toJSON: Get JSON representation
  var toJSON = function () {
    var fs = [];
    for (var k in final_states)
      fs.push(final_states[k].toJSON());

    return {
      'step' : step_id,
      'current_state' : current_state.toJSON(),
      'program' : program.toJSON(),
      'tape' : tape.toJSON(false),
      'inf_loop_check' : inf_loop_check,
      'final_states' : fs,
      'state_stack': state_stack.map(function (v) { return v.toJSON(); }),
      'undefined_instruction' : undefined_instruction,
      'final_state_reached' : final_state_reached,
      'name': name
    };
  };

  for (var evt in events['initialized'])
    events['initialized'][evt](name);

  return {
    addEventListener : addEventListener,
    getCursor : getCursor,
    setCursor : setCursor,
    getState : getState,
    getStepId : getStepId,
    getMachineName : getMachineName,
    setMachineName : setMachineName,
    getTapeContent : getTapeContent,
    finalStateReached : finalStateReached,
    undefinedInstructionOccured : undefinedInstructionOccured,
    finished : finished,
    addFinalState : addFinalState,
    setFinalStates : setFinalStates,
    prev : prev,
    next : next,
    run : run,
    reset : reset,
    fromJSON : fromJSON,
    toJSON : toJSON
  };
};

// ---------------------------- Testcase Runner ---------------------------

function TestsuiteRunner() {
  // @member TestsuiteRunner.testsuite_name
  var testsuite_name;
  // @member TestsuiteRunner.default_max_iterations
  var default_max_iterations = 1000;
  // @member TestsuiteRunner.max_iterations
  var max_iterations;
  // @callback testsuiteSucceeded()
  // @callback testsuiteFailed()
  // @member TestsuiteRunner.events
  var events = {};
  // @member TestsuiteRunner.tests
  var tests = [];

  // @method TestsuiteRunner.addEventListener
  var addEventListener = function (evt, callback) {
    if (evt === 'testsuiteSucceeded' || evt === 'testsuiteFailed') {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push(callback);
    } else {
      require(false, "Unknown event " + evt);
    }
  };

  // @method TestsuiteRunner._validData
  var _validData = function (data) {
    var req = function (v, f) {
      if (typeof v === 'undefined')
        require(false, 'Required value ' + f + ' is undefined');
    }

    req(data['name'], 'name');
    req(data['tests'], 'tests');
    for (var t in data['tests']) {
      req(data['tests'][t]['name'], 'tests.' + t + '.name');
      req(data['tests'][t]['final_states'], 'tests.' + t + '.final_states');
      req(data['tests'][t]['input'], 'tests.' + t + '.input');
      req(data['tests'][t]['input']['state'], 'tests.' + t + '.input.state');
      req(data['tests'][t]['input']['tape'], 'tests.' + t + '.input.tape');
    }
  }

  // @method TestsuiteRunner._createTestcase
  var _createTestcases = function (data) {
    for (var t in data['tests']) {
      var test = data['tests'][t];

      var name = test['name'];

      var fs = [];
      for (var i in test['final_states'])
        fs.push(new State(test['final_states'][i]));

      var default_value = def(test['tape_default_value'], null);

      var program = new Program();
      var tape = new Tape(default_value, 0);
      if (typeof test['input']['tape'] !== 'undefined')
        tape.fromArray(test['input']['tape']);
      if (typeof test['input']['cursor'] !== 'undefined')
        tape.moveTo(new Position(test['input']['cursor']));
      var machine = new Machine(program, tape, fs,
        new State(test['input']['state']), max_iterations);

      tests.push({
        machine : machine,
        name : name,
        output : data['output']
      });
    }
  };

  // @method TestsuiteRunner.initialize
  var initialize = function (data) {
    _validData(data);

    testsuite_name = data['name'];
    max_iterations = def(data['max_iterations'], default_max_iterations);
    max_iterations = parseInt(max_iterations);
    require(!isNaN(max_iterations));

    _createTestcases(data);
  };

  // @method TestsuiteRunner._checkFinalState
  var _checkFinalState = function (machine, state, final_state_reached,
    position, tape_data)
  {
    if (machine.undefinedInstructionOccured())
      return 'Instruction was not found';

    if (typeof state !== 'undefined')
      if (!machine.getState().equals(state))
        return 'Expected final state "' + state.toString() +
          '" but was "' + machine.getState().toString() + '"';

    if (typeof final_state_reached !== 'undefined')
      if (final_state_reached && !machine.finalStateReached())
        return 'Expected machine to reach a final state, but did not happen';

    if (typeof position !== 'undefined')
      if (!machine.getPosition().equals(position))
        return 'Expected final position ' + machine.getPosition().toString() +
          ' but was ' + position.toString();

    if (typeof tape_data !== 'undefined') {
      var content = machine.getTapeContent();
      for (var i in content)
        if (content[i] !== tape_data[i]) {
          return 'Tape content was expected to equal ' +
            JSON.stringify(tape_data) + ' but value "' + content[i] +
            '" differs from "' + tape_data[i] + '"';
        }
    }

    return null;
  };

  // @method TestsuiteRunner.run: run tests, return {name: error msg or null}
  var run = function () {
    var results = {};

    for (var t in tests) {
      var test = tests[t];
      test.run();

      var expected_state = new State(test['output']['state']);
      var expected_reached = test['output']['final_state_reached'];
      var expected_position = new Position(test['output']['tape']['cursor']);
      var expected_tape = test['output']['tape']['data'];

      var tc_name = testsuite_name + "." + test['name'];
      results[tc_name] = _checkFinalState(test, test['machine'],
        expected_state, expected_reached, expected_position, expected_tape);
    }

    return results;
  };

  return {
    addEventListener : addEventListener,
    initialize : initialize,
    run : run
  };
};

function GearVisualization(queue) {
  var currently_running = false;

  // Turingmachine API

  var addStepsLeft = function (count) {
    if (count === undefined)
      count = 1;

    for (var i = 0; i < count; i++)
      queue.dec();

    if (!currently_running)
      nextAnimation();
  };

  var addStepsRight = function (count) {
    if (count === undefined)
      count = 1;

    for (var i = 0; i < count; i++)
      queue.inc();

    if (!currently_running)
      nextAnimation();
  };

  // animation

  var computeSpeed = function (total) {
    // 1 step = 2s
    // 10 steps = 10 * 0.25s
    // 20 steps = 20 * 0.25s

    if (total <= 1)
      return '2s';
    else if (total >= 10)
      return '250ms';
    else {
      var val = (-1.0 * total) * (1750.0 / 9) + (1750.0 / 9) + 2000;
      return "" + parseInt(val) + "ms";
    }
  };

  var nextAnimation = function () {
    if (queue.isEmpty())
      return;

    var speed = computeSpeed(queue.total());
    var steps = queue.pop();

    startAnimation({
      animationTimingFunction: (Math.abs(steps) > 1) ? "linear" : "ease-in-out",
      animationName: "gear-" + (steps < 0 ? "left" : "right"),
      animationIterationCount: Math.abs(steps),
      animationDuration: speed
    });
  };

  var startAnimation = function (properties) { 
    var defaultProperties = {
      animationName: 'gear-left',
      animationDuration: '2s',
      animationTimingFunction: 'ease',
      animationDelay: '0s',
      animationIterationCount: 1,
      animationDirection: 'normal',
      animationPlayState: 'paused'
    };

    currently_running = true;
    for (var prop in properties) {
      defaultProperties['animationPlayState'] = 'running';
      break;
    }
    for (var prop in properties)
      defaultProperties[prop] = properties[prop];

    var oldGear = document.querySelector('.gear-animation');
    var oldUid = parseInt(oldGear.getAttribute('data-uid'));
    if (isNaN(oldUid))
      oldUid = parseInt(Math.random() * Math.pow(2, 32));
    var newUid = parseInt(Math.random() * Math.pow(2, 32));
    if (newUid === oldUid)
      newUid = oldUid + 1;

    var newGear = $(oldGear).clone(true).attr("data-uid", newUid);

    oldGear.setAttribute("data-uid", oldUid);
    $(oldGear).before(newGear);
    for (var prop in defaultProperties) {
      newGear[0].style[prop] = defaultProperties[prop];
    }
    $("*[data-uid=" + oldUid + "]").remove();

    newGear[0].addEventListener("animationend", function () {
      currently_running = false;
      nextAnimation();
    }, false);
  };

  return { addStepsLeft: addStepsLeft, addStepsRight: addStepsRight, startAnimation: startAnimation };
};

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
  // @member Application.description
  var description = "";

  var program = new Program();
  var tape = new UserFriendlyTape(' ', Infinity);
  // @member Application.machine
  var machine = new Machine(program, tape, [EndState], StartState);

  // access program and tape through machine.program and machine.tape
  program = undefined;
  delete program;
  tape = undefined;
  delete tape;

  // @member Application.testcases
  var testcases = [];
  // @member Application.speed
  var speed = 1000;
  // @member Application.prev_steps
  var prev_steps = 1;
  // @member Application.next_steps
  var next_steps = 1;

  var alertNote = function (note_text) {
    var removeNote = function (id) {
      if ($("#notes .note").length === 1)
        $("#notes").fadeOut(1000);
      $("#" + id).fadeOut(1000);
      $("#" + id).remove();
    };

    var hash_id = 0;
    for (var index in note_text)
      hash_id += index * note_text.charCodeAt(index);
    hash_id %= 12365478;
    hash_id = 'note' + hash_id.toString();

    $("#notes").show();
    $("#notes").append($('<p class="note" id="' + hash_id + '">' +
      note_text + '</p>'
    ));

    setTimeout(function () {
      removeNote(hash_id);
    }, 5000);
  };

  var addTransitionLine = function () {
    var clone = $("#tm_transition_table tbody tr:last-child td").clone();
    clone.find("input").val("");
    clone.find("select").val("S");
    $("#tm_transition_table tbody").append("<tr></tr>");
    $("#tm_transition_table tbody tr:last-child").append(clone);
  };

  var validateTestcase = function (testcase) {
    require(typeof testcase['name'] !== 'undefined',
      'Testcase name is not given.'
    );
    require(typeof testcase['input'] !== 'undefined',
      'Testcase input data are not given.'
    );
    require(typeof testcase['input']['tape'] !== 'undefined',
      'Testcase input tape is not given.'
    );
    require(typeof testcase['input']['current_state'] !== 'undefined',
      'Testcase input state is not given'
    );
    require(typeof testcase['output'] !== 'undefined',
      'Testcase output data are not given'
    );
    require(typeof testcase['output']['tape'] !== 'undefined',
      'Testcase output tape is not given'
    );
    require(typeof testcase['output']['current_state'] !== 'undefined' ||
            typeof testcase['output']['has_terminated'] !== 'undefined',
      'Testcase output state (or has_terminated requirement) is not given'
    );
  };

  var writeInstructions = function (instrs) {
    var row = 0;
    var col = 0;

    // Remove all elements except the first one
    $("#tm_transition_table tbody tr:gt(0)").remove();

    for (var read_symbol in instrs)
      for (var from_state in instrs[read_symbol])
      {
        var instr = instrs[read_symbol][from_state];
        if (typeof instr === 'undefined')
          continue;

        if (row > 0)
          addTransitionLine();

        var col = 0;
        $("#tm_transition_table tbody tr:last").find("input,select").each(function () {
          if (col === 0)
            $(this).val(read_symbol);
          else if (col === 1)
            $(this).val(from_state);
          else if (col === 3)
            $(this).val(instr[col - 2][0]);
          else /*if (col >= 2)*/
            $(this).val(instr[col - 2]);

          col += 1;
        });
        row += 1;
      }

    addTransitionLine();
  }

  // defines all events from UI

  // @method Application.event$updateMachineName: Update machine name event
  var event$updateMachineName = function (name_string) {
    name = def(name_string, $("#tm_name").val());
  };

  // @method Application.event$back: Go back event
  var event$back = function (steps) {
    steps = def(steps, parseInt($("#tm_steps_prev").val()));
    if (machine.prev(steps) === false)
      alertNote("Cannot step further back.");
  };

  // @method Application.event$forward: Go forward event
  var event$forward = function (steps) {
    steps = def(steps, parseInt($("#tm_steps_next").val()));
    var result = machine.next(steps);
    if (result === false) {
      if (machine.finalStateReached())
        alertNote("Final state reached!");
      else if (machine.undefinedInstructionOccured())
        alertNote("No command defined.");
    }
  };

  // @method Application.event$reset: Reset event
  var event$reset = function () {
    if (is_example_program)
      event$loadExampleProgram();
    else
      event$applyTape();
  };

  // @method Application.event$run: Run event
  var event$run = function () {
    var result = machine.run();
    if (machine.finalStateReached())
      alertNote("Final state reached!");
    else if (machine.undefinedInstructionOccured())
      alertNote("No command defined.");
  };

  // @method Application.event$loadExampleProgram: Load program event
  var event$loadExampleProgram = function () {
    var program_name = $("#tm_example").val();
    switch (program_name) {
      case "2-Bit XOR":
        fromJSON(twobit_xor());
        write();
        is_example_program = true;
        break;
      case "4-Bit Addition":
        fromJSON(fourbit_addition());
        write();
        is_example_program = true;
        break;
      default:
        alertNote("Trying to load unknown example program " + program_name);
        break;
    }
  };

  // @method Application.event$runTestcase: Run testcase event
  var event$runTestcase = function () {
    var testcase_name = $("#tm_testcase").val();

    var testcase = undefined;
    for (var tc in testcases) {
      if (testcases[tc]['name'] === $("#tm_testcase").val())
        testcase = testcases[tc];
    }

    if (typeof testcase === 'undefined')
      throw AssertionException("Testcase not found.");

    validateTestcase(testcase);

    var result = machine.runTestcase(testcase);
    if (result)
      alertNote(" Testcase '" + testcase_name + "' succeeded.");
    else {
      alertNote(last_testcase_error);
      alertNote(" Testcase '" + testcase_name + "' failed.");
    }

    return result;
  };

  // @method Application.event$runAllTestcases: Run all testcases event
  var event$runAllTestcases = function () {
    for (var tc in testcases) {
      var testcase = testcases[tc];
      var testcase_name = testcases[tc]['name'];
      validateTestcase(testcase);
      var result = machine.runTestcase(testcase);
      if (result === true)
        continue;
      else {
        alertNote(last_testcase_error);
        alertNote(" Testcase '" + testcase_name + "' failed.");
      }
    }
    alertNote(" All testcases succeeded.");
  };

  // @method Application.event$updateSpeed: Update speed event
  var event$updateSpeed = function (speed) {
    var val = parseInt($("#tm_speed").val());
    if (isNaN(val))
    {
      $("#tm_speed").css("background-color", failure_color);
    } else {
      $("#tm_speed").css("background-color", "inherit");
      speed = val;
    }
  };

  // @method Application.event$applyTape: Apply Tape event
  var event$applyTape = function (tape_values) {
    is_example_program = false;
    tape_values = def(tape_values, $("#tm_tape").val());
    machine.tape.setByString(tape_values);
    write();
    machine.draw();
  };

  // @method Application.event$updateTransitionTable: Update transitions event
  var event$updateTransitionTable = function () {
    var is_empty = function (val) {
      return (val === " " || val.length === 0);
    };

    is_example_program = false;

    // read program
    var table = [];
    $("#tm_transition_table tbody tr").each(function () {
      var instr = [];
      $(this).find("input, select").each(function () {
        instr.push($(this).val());
      })
      table.push(instr);
    });

    // normalize table
    var all_are_empty;
    for (var i in table) {
      table[i][0] = normalizeSymbol(table[i][0]);
      table[i][1] = table[i][1].trim();
      table[i][2] = normalizeSymbol(table[i][2]);
      table[i][3] = normalizeMovement(table[i][3]);
      table[i][4] = table[i][4].trim();
      if (is_empty(table[i][0]) && is_empty(table[i][1]) &&
          is_empty(table[i][2]) && is_empty(table[i][4]))
        all_are_empty = true;
      else
        all_are_empty = false;
    }

    // update program
    for (var i in table) {
      var read_symbol = table[i][0];
      var from_state = new State(table[i][1]);
      var write = table[i][2];
      var move = new Movement(table[i][3]);
      var to_state = new State(table[i][4]);

      if (table[i][1].length === 0 && table[i][4].length === 0)
        continue;

      machine.program.update(read_symbol, from_state, write, move, to_state);
    }

    // if the last line is not empty, add new line
    if (!all_are_empty)
      addTransitionLine();
  };

  // @method Application.event$export: Export event
  var event$export = function () {
    $("#overlay_text_action").text("Export");
    $("#data").attr("readonly", true);
    $("#tm_import_now").hide();
    if ($("#tm_format").val() === "json")
      $("#data").val(toString());
    else
      $("#data").val(machine.program.toTWiki);
  };

  // @method Application.event$importNow: Import now event
  var event$importNow = function () {
    var format = $("#tm_format").val();
    var data = $("#data").val();

    switch (format) {
      case 'twiki':
        try {
          machine.program.fromTWiki(data);
          alertNote("Imported successfully.");
        } catch (e) {
          alertNote(e.message);
          alertNote("Broken program imported.");
        }
        write();
        break;
      case 'json':
        try {
          machine.program.fromJSON(data);
        } catch (e) {
          alertNote(e.message);
        }
        write();
        break;
      default:
        console.error("Unknown import format given.");
    }
  };

  // @method Application.event$import: Show import window event
  var event$import = function () {
    $("#overlay_text_action").text("Import");
    $("#data").attr("readonly", false);
    $("#tm_import_now").show();
    $("#data").val("");
    is_example_program = false;
  };

  // @method Application.event$format: Format modified event
  var event$format = function () {
    if ($("#overlay_text_action").text().indexOf("Import") !== -1)
      //event$import();  // can actually be ignored
      0;
    else
      event$export();
  };


  ////////////////////////////////////////////////////////////////////////////

  // @method Application.write: Write the current state of Application to UI
  var write = function () {
    $("#tm_steps_prev").val(prev_steps);
    $("#tm_steps_next").val(next_steps);

    // Write testcase list
    $("#tm_testcase").html("");
    for (var tc in testcases) {
      $("#tm_testcase").append("<option>" + testcases[tc]['name'] + "</option>");
    }

    // write instructions
    var instrs = machine.program.toJSON();
    writeInstructions(instrs);

    if (description.length > 0) {
      $("#tm_description").show();
      $("#tm_description_text").text(description);
    } else {
      $("#tm_description").hide();
    }

    $("#tm_speed").val(speed);
    $("#tm_name").val(name);
    $("#tm_tape").val(machine.tape.toBitString());
    $("#tm_drawings").attr('title', machine.tape.toString());
  };

  // @method Application.fromJSON: Import Application from JSON
  var fromJSON = function (data) {
    if (typeof data['machine'] === 'undefined')
      throw new AssertionException("data parameter incomplete (requires machine).");

    if (typeof data['name'] !== 'undefined')
      name = data['name'];
    if (typeof data['version'] !== 'undefined')
      version = data['version'];
    if (typeof data['author'] !== 'undefined')
      author = data['author'];
    if (typeof data['description'] !== 'undefined')
      description = data['description'];
    else
      description = "";

    machine.fromJSON(data['machine']);

    if (typeof data['speed'] !== 'undefined' &&
        !isNaN(parseInt(data['speed'])))
      speed = parseInt(data['speed']);
    if (typeof data['prev_steps'] !== 'undefined' &&
        !isNaN(parseInt(data['prev_steps'])))
      prev_steps = data['prev_steps'];
    if (typeof data['next_steps'] !== 'undefined' &&
        !isNaN(parseInt(data['next_steps'])))
      next_steps = data['next_steps'];
    if (typeof data['testcases'] !== 'undefined')
      testcases = data['testcases'];
  };

  // @method Application.toJSON: JSON representation of Application
  var toJSON = function () {
    // tape is already part of program
    return {
      name : name,
      version : version,
      author : author,
      machine : machine.toJSON(),
      speed : speed,
      prev_steps : prev_steps,
      next_steps : next_steps
    };
  };

  // @method Application.toString: String representation of Application
  var toString = function () {
    return JSON.stringify(toJSON());
  };

  return {
    event$reset : event$reset,
    event$run : event$run,
    event$back : event$back,
    event$forward : event$forward,
    event$importNow : event$importNow,
    event$import : event$import,
    event$export : event$export,
    event$format : event$format,
    event$applyTape : event$applyTape,
    event$updateSpeed : event$updateSpeed,
    event$updateTransitionTable : event$updateTransitionTable,
    event$loadExampleProgram : event$loadExampleProgram,
    event$runAllTestcases : event$runAllTestcases,
    event$runTestcase : event$runTestcase,
    alertNote : alertNote,
    write : write,
    fromJSON : fromJSON,
    toString : toString,
    toJSON : toJSON
  };
};

// ----------------------------- Main routine -----------------------------

function twobit_xor()
{
  // E = even number of 1s
  // O = odd number of 0s

  var out = {
    "name": "2-Bit XOR",
    "version": "1.0.0",
    "author": "meisterluk <admin@lukas-prokop.at>",
    "description" : "XOR (excluded OR) is a fundamental logical operator. " +
      "Taking two input values, the output value is true whenever both " +
      "inputs differ. This turingmachine starts with a tape where two zeros " +
      "are right to the cursor position. Because the zeros are equivalent, " +
      "the result of the operator is zero as well and is written to the " +
      "right of the values. If the values are 01, the result 1 has to be written.",
    "machine": {
      "current_state": "Start",
      "program": {
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
          'E' : ['0', 'H', 'End'],
          'O' : ['1', 'H', 'End']
        }
      },
      "tape": {
        "default_value": " ",
        "cursor" : 0,
        "data": ["0", "0"]
      },
      "inf_loop_check": 500,
      "final_states": ['End']
    },
    "testcases" : [
      {
        'name' : 'test 00',
        'test_cursor_position' : true,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['0', '0'] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 2, 'data' : ['0', '0', '0'] },
          'current_state' : 'End'
        }
      }, {
        'name' : 'test 01',
        'test_cursor_position' : true,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['0', '1'] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 2, 'data' : ['0', '1', '1'] },
          'current_state' : 'End'
        }
      }, {
        'name' : 'test 10',
        'test_cursor_position' : true,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['1', '0'] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 2, 'data' : ['1', '0', '1'] },
          'current_state' : 'End'
        }
      }, {
        'name' : 'test 11',
        'test_cursor_position' : true,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['1', '1'] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 2, 'data' : ['1', '1', '0'] },
          'current_state' : 'End'
        }
      }
    ],
    "speed": 1000,
    "prev_steps": 1,
    "next_steps": 1
  };

  return out;
}

function fourbit_addition()
{
  var out = {
    "name": "4-Bit Addition",
    "version": "1.0.0",
    "author": "meisterluk <admin@lukas-prokop.at>",
    "description" : "",
    "machine": {
      "current_state": "Start",
      "program": {
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
          'E' : ['0', 'H', 'End'],
          'O' : ['1', 'H', 'End']
        }
      },
      "tape": {
        "default_value": " ",
        "cursor" : 0,
        "data": ["0", "1", "0", "0", "+", "1", "1", "0", "1", "="]
      },
      "inf_loop_check": 500,
      "final_states": ['End']
    },
    "testcases" : [
      {
        'name' : 'test 0001+0000=0001',
        'test_cursor_position' : false,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['0', '0', '0', '1', '+',
                     '0', '0', '0', '0', '='] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 13, 'data' : ['0', '0', '0', '1', '+',
                     '0', '0', '0', '0', '=', '0', '0', '0', '1'] },
          'current_state' : 'End'
        }
      }, {
        'name' : 'test 0000+0001=0001',
        'test_cursor_position' : false,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['0', '0', '0', '0', '+',
                     '0', '0', '0', '1', '='] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 13, 'data' : ['0', '0', '0', '0', '+',
                     '0', '0', '0', '1', '=', '0', '0', '0', '1'] },
          'current_state' : 'End'
        }
      }, {
        'name' : 'test 0001+0001=0010',
        'test_cursor_position' : false,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['0', '0', '0', '1', '+',
                     '0', '0', '0', '1', '='] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 13, 'data' : ['0', '0', '0', '1', '+',
                     '0', '0', '0', '1', '=', '0', '0', '1', '0'] },
          'current_state' : 'End'
        }
      }, {
        'name' : 'test 0101+0011=1000',
        'test_cursor_position' : false,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['0', '1', '0', '1', '+',
                     '0', '0', '1', '1', '='] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 13, 'data' : ['0', '1', '0', '1', '+',
                     '0', '0', '1', '1', '=', '1', '0', '0', '0'] },
          'current_state' : 'End'
        }
      }, {
        'name' : 'test 1110+0010=0000',
        'test_cursor_position' : false,
        'final_states' : ['End'],
        'input' : {
          'tape' : { 'cursor' : 0, 'data' : ['1', '1', '1', '0', '+',
                     '0', '0', '1', '0', '='] },
          'current_state' : 'Start'
        },
        'output' : {
          'tape' : { 'cursor' : 13, 'data' : ['1', '1', '1', '0', '+',
                     '0', '0', '1', '0', '=', '0', '0', '0', '0'] },
          'current_state' : 'End'
        }
      }
    ],
    "prev_steps": 1,
    "next_steps": 1
  };

  return out;
}

function main()
{
  $("#tm_control_prev").click(function () { app.event$back(); });
  $("#tm_control_next").click(function () { app.event$forward(); });
  $("#tm_control_reset").click(function () { app.event$reset(); });
  $("#tm_control_run").click(function () { app.event$run(); });

  $("#tm_import_now").click(function () { app.event$importNow(); });
  $("#tm_import").click(function () { app.event$import(); });
  $("#tm_export").click(function () { app.event$export(); });
  $("#tm_format").change(function () { app.event$format(); });

  $("#tm_testcase_run").click(function () { app.event$runTestcase(); });
  $("#tm_testcase_runall").click(function () { app.event$runAllTestcases(); });
  $("#tm_example_run").click(function () { app.event$loadExampleProgram(); });

  $("#tm_name").change(function () { app.event$updateMachineName(); });
  /*$("#tm_history_size").change(function () { app.updateHistorySize(); });*/
  $("#tm_speed").change(function () { app.event$updateSpeed(); });

  $("#tm_apply_tape").click(function () { app.event$applyTape(); });
  $("#tm_transition_table").change(function () { app.event$updateTransitionTable(); });

  // overlay
  function toggle_overlay() {
    if (!$("#overlay").is(':visible')) {
      $("#overlay").show(100);
      $("#overlay_text").delay(150).show(400);
    }
  }
  $("#tm_import").click(function () {
    app.event$import();
    toggle_overlay();
  });
  $("#tm_export").click(function () {
    app.event$export();
    toggle_overlay();
  });
  $("#overlay").click(function () {
    if ($("#overlay").is(':visible')) {
      $("#overlay").delay(200).hide(100);
      $("#overlay_text").hide(200);
    }
  });

  testsuite();
  var app = new Application(app_name, app_version, app_author);
  app.fromJSON(twobit_xor());
  app.write();

  return app;
}
