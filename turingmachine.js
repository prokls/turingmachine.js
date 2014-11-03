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
// - and lots of students and tutors of winter term 2014/15.
// Thank you!
//
// (C) 2013-2014, Public Domain, Lukas Prokop
//

'use strict';

// --------------------------- global variables ---------------------------

var app_name = "turingmachine.js";
var app_version = "0.9.2-unstable";
var app_author = "Lukas Prokop <admin@lukas-prokop.at>";

// Movement values, immutable const
var mov = {
  LEFT  : "Left",
  RIGHT : "Right",
  STOP  : "Stop"
};

// default value for tapes, immutable const
var generic_default_value = 0;

// iterations before possiblyInfinite event is thrown, immutable const
var generic_check_inf_loop = 1000;

// generic Turing markets
var generic_markets = ["intro"];

// global variable containing all occuring states
// Remark. Will be redefined as OrderedSet instance.
var states = [];

// global variable containing all written letters
// Remark. Will be redefined as OrderedSet instance.
var alphabet = [];

// -------------------------------- Helpers -------------------------------

// Default parameters abstraction
function def(arg, val) { return (typeof arg !== 'undefined') ? arg : val; }

// assert statement
function require(cond, msg)
{
  if (!cond)
    throw new AssertionException(msg);
}

// Testing array equivalence
var arrayEqualIdentity = function (arr1, arr2) {
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

// Deep copy implementation
var deepCopy = function (val)
{
  require(!(val instanceof Date));
  if (Array.isArray(val))
    return val.slice().map(function (v) { return deepCopy(v); });
  else if (typeof val === 'object') {
    var copy = {};
    for (var attr in val)
      if (val.hasOwnProperty(attr))
        copy[attr] = deepCopy(val[attr]);
    return copy;
  } else if (typeof val === 'function')
    return val;  // no useful way; wait for Function.bind
  else
    // should be immutable value
    return val;
}

// Return keys of given object
var keys = function (obj)
{
  var k = [];
  for (var key in obj)
    k.push(key);
  return k;
}

// Normalizes values written to the tape
var normalizeSymbol = function (symb) {
  if (symb === null || typeof symb === "undefined")
    return " ";
  if (typeof symb === "string") {
    if (symb.match(/^\s*$/))
      return ' ';
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
// use pop() to retrieve those numeric values
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
}

// a queue implementation
var Queue = function () {
  var values = [];

  var push = function (val) {
    values.splice(0, 0, val);
  };

  var pop = function () {
    return values.pop();
  };

  var isEmpty = function () { return values.length === 0; }

  return { push : push, pop : pop, isEmpty : isEmpty };
}

// ------------------------------ Exceptions ------------------------------

// @exception thrown if value out of tape bounds is accessed
function OutOfTapeException(position)
{
  var err = new Error();
  err.name = "OutofTapeException";
  err.message = typeof position === 'undefined'
    ? "I ran outside the tape"
    : "Position " + position + " is outside of tape";
  err.stack = (new Error()).stack;
  Error.call(err);
  if (typeof console.trace === 'function')
    console.trace();
  return err;
}

// @exception thrown if number of undos exceeds history size
function OutOfHistoryException(step_id)
{
  var err = new Error();
  err.name = "OutOfHistoryException";
  err.message = "Cannot step any further back in history "
      + "(bounds are 0 and history_size).";
  err.stack = (new Error()).stack;
  Error.call(err);
  if (typeof console.trace === 'function')
    console.trace();
  return err;
}

// @exception thrown, if an assertion goes wrong
function AssertionException(msg)
{
  var err = new Error();
  err.name = "AssertionException";
  err.message = msg
    ? "Condition is not satisfied: " + msg
    : "Condition not satisfied";
  err.stack = (new Error()).stack;
  Error.call(err);
  if (typeof console.trace === 'function')
    console.trace();
  return err;
}

// @exception thrown, if invalid foswiki content is given
function InvalidFoswikiException(msg)
{
  var err = new Error();
  err.name = "InvalidFoswikiException";
  err.message = msg;
  err.stack = (new Error()).stack;
  Error.call(err);
  if (typeof console.trace === 'function')
    console.trace();
  return err;
}

// @exception thrown, if invalid JSON data is given
function InvalidJSONException(msg)
{
  var err = new Error();
  err.name = "InvalidJSONException";
  err.message = msg;
  err.stack = (new Error()).stack;
  Error.call(err);
  if (typeof console.trace === 'function')
    console.trace();
  return err;
}

// --------------------------------- State --------------------------------

// @object State: State of the Turing machine.
function State(name)
{
  // @member State.name

  if (isState(name))
    name = name.toString();
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

// Convenient function to create State objects
function state(name)
{
  return new State(name);
}

// two known states, immutable consts
var EndState = state("End");
var StartState = state("Start");

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

function normalizeMovement(move) {
  var isin = function (elem, a) { return $.inArray(elem, a) !== -1; };

  if (typeof move !== 'undefined' && move.isMovement)
    return move.toString();
  if (typeof move === 'string')
    move = move.toLowerCase();

  if (isin(move, ['l', 'left']) || move === mov.LEFT.toLowerCase())
    move = mov.LEFT;
  else if (isin(move, ['r', 'right']) || move === mov.RIGHT.toLowerCase())
    move = mov.RIGHT;
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

// Convenient function to create Movement objects
function movement(m)
{
  return new Movement(m);
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
    return position(index + summand);
  };

  // @method Position.sub: Returns Position instance at pos this+subtrahend
  var sub = function (subtrahend) {
    return position(index - subtrahend);
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
function position(p)
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

// Throw exception if `obj` is not a Instruction object
function requireInstruction(obj)
{
  if (!isInstruction(obj))
    throw new AssertionException("Is not an instruction");
}

// Convenient function to create Instruction objects
function instrtuple(a, b, c)
{
  return new InstrTuple(a, b, c);
}

// --------------------------------- Program --------------------------------

// @object Program: Abstraction for the program of the Turing machine.
function Program()
{
  // @member Program.program
  // list of [read_symbol, from_state, (write_symbol, movement, to_state)]
  // the parens denote a InstrTuple object
  var program = [];

  var _getHash = function (v) {
    if (v && v.isState)
      v = v.toString();
    return "" + normalizeSymbol(v);
  };

  var _safeGet = function (read_symbol, from_state) {
    requireState(from_state);
    from_state = _getHash(from_state);
    read_symbol = _getHash(read_symbol);
    for (var i = 0; i < program.length; i++) {
      if (program[i][0] === read_symbol && program[i][1] === from_state)
        return program[i][2];
    }
    return undefined;
  };

  var _safeSet = function (read_symbol, from_state, value, overwrite) {
    overwrite = def(overwrite, true);
    requireState(from_state);
    require(isInstruction(value));
    read_symbol = _getHash(read_symbol);
    from_state = _getHash(from_state);

    for (var i = 0; i < program.length; i++) {
      if (program[i][0] === read_symbol && program[i][1] === from_state) {
        if (overwrite) {
          program[i][2] = value;
          return true;
        }
        return false;
      }
    }

    program.push([read_symbol, from_state, value]);
    return true;
  };

  // @method Program.clear: Clear program table
  var clear = function () {
    program = [];
  };

  // @method Program.isDefined: Can we handle the specified situation?
  var exists = function (read_symbol, from_state) {
    requireState(from_state);
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
      require(typeof move !== 'undefined');
      write = normalizeSymbol(write);
      requireMovement(move);
      requireState(to_state);

      value = instrtuple(write, move, to_state);
    }

    _safeSet(read_symbol, from_state, value);
  };

  // @method Program.get: Return InstrTuple for specified situation or undefined
  var get = function (read_symbol, from_state) {
    requireState(from_state);
    return _safeGet(read_symbol, from_state);
  };

  // @method Program.getFromSymbols: Get array of all from symbols
  var getFromSymbols = function () {
    var symbol_set = [];
    for (var i in program)
      if ($.inArray(program[i][0], symbol_set) === -1)
        symbol_set.push(program[i][0]);
    return symbol_set;
  };

  // @method Program.getFromSymbols: Get array of all from symbols
  var getFromStates = function () {
    var state_set = [];
    for (var i in program)
      if ($.inArray(program[i][1], state_set) === -1)
        state_set.push(program[i][1]);
    return state_set;
  };

  // @method Program.fromJSON: Import a program
  var fromJSON = function (data) {
    if (typeof data === "string")
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new InvalidJSONException("Cannot import invalid JSON as program!");
      }

    clear();

    for (var i in data) {
      var read_symbol = data[i][0];
      var from_state = state(data[i][1]);
      var write = data[i][2][0];
      var move = movement(data[i][2][1]);
      var to_state = state(data[i][2][2]);

      set(read_symbol, from_state, write, move, to_state);
    }
  };

  // @method Program.toString: String representation of Program object
  var toString = function () {
    var repr = "<program>\n";
    for (var i in program)
      repr += "  " + program[i][0] + ";" + program[i][1] + "  = "
           + program[i][2].toString() + "\n";
    repr += "</program>";

    return repr;
  };

  // @method Program.toJSON: JSON representation of Program object
  var toJSON = function () {
    var data = [];
    for (var i in program)
      data.push([program[i][0], program[i][1], program[i][2].toJSON()]);

    return data;
  };

  return {
    clear : clear,
    exists : exists,
    set : set,
    get : get,
    getFromSymbols : getFromSymbols,
    getFromStates : getFromStates,
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
  var cursor = position(0);
  // @member Tape.tape
  var tape = [default_value];

  var _testInvariants = function () {
    require(end().sub(begin()).add(1).index === tape.length,
      "begin, end and length do not correspond"
    );
    require(typeof offset === 'number');
    require(offset >= 0, "offset invariant invalidated");
    requirePosition(cursor, "cursor is not a position");
    require(typeof tape === 'object');
  };

  // @method Tape.getDefaultValue: returns default_value
  var getDefaultValue = function () {
    return default_value;
  };

  // @method Tape.setDefaultValue: get default_value
  var setDefaultValue = function (val) {
    default_value = val;
  };

  // @method Tape.begin: Get most-left, reached Position at Tape
  var begin = function () {
    return position(-offset);
  };

  // @method Tape.end: Get most-right, reached Position at Tape
  var end = function () {
    return position(tape.length - offset - 1);
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
      throw new InvalidJSONException("data parameter incomplete.");

    default_value = def(data['default_value'], generic_default_value);
    default_value = normalizeSymbol(default_value);
    offset = def(data['offset'], 0);
    cursor = position(data['cursor']);
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
      var low_missing_elements = Math.abs(cursor.index + offset);
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
    // one position per symbol, [optional] *symbol* denotes the cursor position
    var values, cursor_idx;

    if (str.indexOf("*") < 0) {
      values = str.split(",");
      cursor_idx = parseInt(values.length / 2);

    } else {
      // expect two stars
      var cursor1 = str.indexOf("*");
      var cursor2 = str.indexOf("*", cursor1 + 1);
      if (cursor1 < 0 || cursor2 < 0 || str.indexOf("*", cursor2 + 1) >= 0)
        throw new AssertionException("Invalid tape definition string provided. "
          + "Cursor must be surrounded by two stars.");

      var slice = str.substr(cursor1, cursor2 - cursor1);
      if (slice.indexOf(",") !== -1)
        throw new AssertionException("Invalid tape definition string provided. "
          + "Cursor definition must not cross values.");

      // retrieve values
      values = str.split(",");

      // get index of cursor
      var str_idx = 0;
          cursor_idx = 0;
      for (var i in values) {
        if (str_idx <= cursor1 && cursor2 < str_idx + values[i].length) {
          cursor_idx = parseInt(i);
          values[i] = values[i].replace(/\*/g, '');
          break;
        }
        str_idx += values[i].length + 1;
      }
    }

    // normalize values
    values = values.map(normalizeSymbol);

    // set parameters
    default_value = def(default_value, generic_default_value);
    offset = def(cursor_idx, offset);
    cursor = position(0);
    tape = values;
  };

  // TODO: toHumanString

  // @method Tape.toJSON: Return JSON representation of Tape
  var toJSON = function () {
    return {
      default_value : default_value,
      offset : offset,
      cursor : cursor,
      data : deepCopy(tape)
    };
  };

  return {
    setDefaultValue : setDefaultValue,
    getDefaultValue : getDefaultValue,
    cursor : function () { return cursor; },
    begin : begin,
    end : end,
    left : left,
    right : right,
    write : write,
    read : read,
    size : size,
    fromJSON : fromJSON,
    toJSON : toJSON,
    fromHumanString : fromHumanString,
    isTape : true
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
  var _oppositeInstruction = function (instruc) {
    if (instruc[0] === "LEFT")
      return (typeof instruc[1] === 'undefined')
        ? ["RIGHT"] : ["RIGHT", instruc[1]];
    else if (instruc[0] === "RIGHT")
      return (typeof instruc[1] === 'undefined')
        ? ["LEFT"] : ["LEFT", instruc[1]];
    else if (instruc[0] === "WRITE")
      return ["WRITE", instruc[2], instruc[1]];
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

  // @method RecordedTape.getDefaultValue: returns default_value
  var getDefaultValue = function () {
    return simple_tape.getDefaultValue();
  };

  // @method RecordedTape.setDefaultValue: get default_value
  var setDefaultValue = function (val) {
    simple_tape.setDefaultValue(val);
  };

  // @method RecordedTape.getHistorySize: returns history_size
  var getHistorySize = function () {
    return history_size;
  };

  // @method RecordedTape.setHistorySize: get history_size
  var setHistorySize = function (val) {
    if (val === Infinity)
      val = Infinity;
    else if (!isNaN(parseInt(val)))
      val = parseInt(val);
    else
      throw new AssertionException("setHistorySize only accept inf or num");

    simple_tape.setHistorySize(val);
    simple_tape.setDefaultValue(val);
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
    var ops = [];
    for (var i = frame.length - 1; i >= 0; i--) {
      var undo = _oppositeInstruction(frame[i]);
      _applyNativeInstruction(undo);
      ops.push(undo);
    }
    return ops;
  };

  // @method RecordedTape.undo: Go back to last snapshot.
  //   Returns reversed operations.
  var undo = function () {
    if (history.length === 1 && history[0].length === 0)
      throw new OutOfHistoryException("Tape history under the limit");

    var frame = history.pop();
    return _undoOneSnapshot(frame);
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
    var data = simple_tape.toJSON();

    export_history = def(export_history, true);
    if (!export_history)
      return data;

    data['history'] = history.map(_simplifyHistoryFrame);
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

    return simple_tape.fromJSON(data);
  }

  return inherit(simple_tape, {
    getHistorySize : getHistorySize,
    setHistorySize : setHistorySize,
    left : left,
    right : right,
    write : write,
    undo : undo,
    snapshot : snapshot,
    getHistory : getHistory,
    clearHistory : clearHistory,
    toJSON : toJSON,
    fromJSON : fromJSON,
    isRecordedTape : true
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

  // @method ExtendedTape.size: Return length of accessed Tape elements
  var size = function () {
    var begin = rec_tape.begin();
    var end = rec_tape.end();

    return Math.abs(begin.index) + Math.abs(end.index) + 1;
  };

  // @method ExtendedTape.clear: Clear values of the tape
  var clear = function () {
    halted = false;
    var base = rec_tape.cursor();

    while (!rec_tape.cursor().equals(rec_tape.begin()))
      rec_tape.left();
    // go from left to right and reset all values to default value
    while (!rec_tape.cursor().equals(rec_tape.end())) {
      rec_tape.write(rec_tape.getDefaultValue());
      rec_tape.right();
    }
    rec_tape.write(rec_tape.getDefaultValue());

    // go back to base
    while (!rec_tape.cursor().equals(base))
      rec_tape.left();

    rec_tape.clearHistory();
  };

  // @method ExtendedTape.moveTo: Move to the given position
  var moveTo = function (goto) {
    requirePosition(goto);
    var diff = rec_tape.cursor().index - goto.index;
    if (diff > 0)
      rec_tape.left(diff);
    var diff = goto.index - rec_tape.cursor().index;
    if (diff > 0)
      rec_tape.right(diff);
    require(goto.equals(rec_tape.cursor()));
  };

  // @method ExtendedTape.read: Read value at position
  var read = function (pos) {
    if (typeof pos === 'undefined')
      return rec_tape.read();
    else
      requirePosition(pos);

    var base = rec_tape.cursor();
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

    var base = rec_tape.cursor();
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
    else if (move.equals(mov.STOP)) {
      // nothing.
    } else
      throw new AssertionException("Unknown movement '" + move + "'");
  };

  // @method ExtendedTape.strip: Give me an array and I will trim default values
  //                             but only on the left and right border
  var strip = function (array, default_val) {
    default_val = def(default_val, rec_tape.getDefaultValue());
    while (array.length > 0 && array[0] === default_val)
      array = array.slice(1);
    while (array.length > 0 && array[array.length - 1] === default_val)
      array = array.slice(0, array.length - 1);
    return array;
  };

  // @method ExtendedTape.toString: String representation of ExtendedTape objects
  var toString = function () {
    var base = rec_tape.cursor();
    var values = [];
    var finish_loop = false;

    moveTo(rec_tape.begin());
    while (!finish_loop) {
      var value = rec_tape.read();
      if (typeof value === 'undefined' || value === null)
        value = ' ';

      // Make cursor visible
      if (rec_tape.cursor().equals(base))
        values.push("*" + value + "*");
      else
        values.push(value.toString());

      if (rec_tape.cursor().equals(rec_tape.end()))
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
    var base = rec_tape.cursor();
    moveTo(rec_tape.begin());

    while (!rec_tape.cursor().equals(rec_tape.end())) {
      func(rec_tape.cursor(), rec_tape.read());
      rec_tape.right();
    }
    func(rec_tape.cursor(), rec_tape.read());

    moveTo(base);
  };

  // @method ExtendedTape.equals: Is this one and the given tape the same?
  var equals = function (tape, ignore_length, ignore_cursor) {
    ignore_length = def(ignore_length, true);
    // the absolute position
    // NOT relative to begin and end or any other stuff
    ignore_cursor = def(ignore_cursor, true);

    if (!ignore_cursor && !cursor().equals(tape.cursor()))
      return false;

    var values1 = toJSON()['data'];
    var values2 = tape.toJSON()['data'];

    if (ignore_length) {
      var values1 = strip(values1, rec_tape.getDefaultValue());
      var values2 = strip(values2, tape.getDefaultValue());
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
    rec_tape.fromJSON(data);
  };

  return inherit(rec_tape, {
    begin : begin,
    end : end,
    left : left,
    right : right,
    write : write,
    read : read,
    size : size,
    fromJSON : fromJSON,
    toJSON : toJSON,
    clear : clear,
    moveTo : moveTo,
    move : move,
    getAlphabet : getAlphabet,
    forEach : forEach,
    equals : equals,
    toString : toString,
    isExtendedTape : true
  });
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

    pos = def(pos, ext_tape.cursor());
    n = def(n, 1);
    requirePosition(pos);
    require(!isNaN(n / 2));
    require(n !== 0);

    var base = ext_tape.cursor();
    var vals = [];
    var lower_bound = pos.index - parseInt((n - 1) / 2);
    ext_tape.moveTo(position(lower_bound));

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
    ext_tape.moveTo(position(0));
    for (var i = 0; i < array.length; i++) {
      ext_tape.right();
      ext_tape.write(array[i]);
    }
    ext_tape.moveTo(position(0));
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
    while (bitstring.length > 0 && bitstring[0] === ext_tape.getDefaultValue())
      bitstring = bitstring.slice(1);
    while (bitstring.length > 0 &&
      bitstring[bitstring.length - 1] === ext_tape.getDefaultValue())
      bitstring = bitstring.slice(0, -1);

    return bitstring;
  };

  return inherit(ext_tape, {
    read : read,
    fromArray : fromArray,
    toBitString : toBitString,
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

  // @member Machine.final_states
  require(final_states.length > 0);
  for (var key in final_states)
    requireState(final_states[key]);

  // @member Machine.initial_state
  requireState(initial_state);

  // @member Machine.initial_tape
  var initial_tape = tape.toJSON();

  // @member Machine.inf_loop_check
  inf_loop_check = def(inf_loop_check, generic_check_inf_loop);

  // @member Machine.state_history
  var state_history = [initial_state];

  // @member Machine.name
  var name = 'machine ' + parseInt(Math.random() * 10000);

  // @member Machine.step_id
  var step_id = 0;

  // @member Machine.keep_running
  //   Is true while Machine is "Run"ning
  var keep_running = false;

  // @member Machine.valid_events
  // @member Machine.events
  // @callback initialized(machine name)
  // @callback possiblyInfinite(steps executed)
  //    If one callback returns false, execution is aborted
  // @callback undefinedInstruction(read symbol, state)
  //    If return value is not null, returned InstrTuple is inserted
  // @callback finalStateReached(state)
  // @callback valueWritten(old value, new value)
  // @callback movementFinished(movement)
  // @callback stateUpdated(old state, new state)
  // @callback stepFinished(new value, movement, new state)
  var valid_events = ['initialized', 'possiblyInfinite',
    'undefinedInstruction', 'finalStateReached', 'valueWritten',
    'movementFinished', 'stateUpdated', 'stepFinished', 'runFinished'];
  var events = { };

  // @method Machine.addEventListener: event listener definition
  var addEventListener = function (evt, callback) {
    if ($.inArray(evt, valid_events) !== -1) {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push(callback);
    } else
      throw new Error("Unknown event " + evt);
  };

  // @method Machine.triggerEvent: trigger event
  var triggerEvent = function (evt, clbk) {
    var args = [];
    for (var i=0; i < arguments.length; i++) {
      if (i >= 2)
        args.push(arguments[i]);
    }
    for (var e in events[evt]) {
      var res = events[evt][e].apply(events[evt], args);
      if (clbk) clbk(res);
    }
  };

  // @method Machine.initialize: Make machine ready to be run
  var initialize = function () {
    triggerEvent('initialized', null, getMachineName());
  };

  // @method Machine.getProgram: Getter for Program instance
  // @method Machine.setProgram: Setter for Program instance
  var getProgram = function () { return program; };
  var setProgram = function (p) {
    program = p;
  };

  // @method Machine.getTape: Getter for Tape instance
  // @method Machine.setTape: Setter for Tape instance
  var getTape = function () { return tape; };
  var setTape = function(t) {
    tape = t;
  };

  // @method Machine.getInitialTape: Getter for initial tape as JSON
  var getInitialTape = function () { return initial_tape; };
  var setInitialTape = function (t) {
    initial_tape = t;
  };

  // @method Machine.getFinalStates: Getter for final states
  var getFinalStates = function () {
    return final_states;
  };

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

  // @method Machine.getState: Get current state
  var getInitialState = function () {
    if (state_history.length === 0)
      throw new AssertionException("No state assigned to machine");
    return state_history[0];
  };

  // @method Machine.getState: Get current state
  var getState = function () {
    if (state_history.length === 0)
      throw new AssertionException("No state assigned to machine");
    return state_history[state_history.length - 1];
  };

  // @method Machine.setState: Set current state
  var setState = function (st) {
    if (isState(st))
      state_history.push(st);
    else
      state_history.push(state(st));
  };

  // @method Machine.getInfinityLoopCount: Get inf_loop_check
  var getInfinityLoopCount = function () { return inf_loop_check; };

  // @method Machine.setInfinityLoopCount: Set inf_loop_check
  var setInfinityLoopCount = function (v) {
    if (v === Infinity)
      inf_loop_check = v;
    else if (!isNaN(parseInt(v)))
      inf_loop_check = parseInt(v);
    else
      throw new AssertionException(
        "Cannot set infinity loop count to non-numeric"
      );
  };

  // @method Machine.getCursor: Return the current cursor Position
  var getCursor = function () {
    return tape.cursor();
  };

  // @method Machine.setCursor: Jump to a certain position on the tape
  var setCursor = function (pos) {
    tape.moveTo(pos);
    triggerEvent('movementFinished', null, null);
  };

  // @method Machine.getStep: Get number of operations performed so far
  var getStep = function () {
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

  // @method Machine.getCursor: Get tape position
  var getCursor = function () {
    return tape.cursor();
  };

  // @method Machine.replaceTapeFromJSON: Replace tape with a new one from JSON
  var replaceTapeFromJSON = function (json) {
    tape.fromJSON(json);
    step_id = 0;
  };

  // @method Machine.replaceProgramFromJSON: Replace program using JSON data
  var replaceProgramFromJSON = function (json) {
    program.fromJSON(json);
    step_id = 0;
  };

  // @method Machine.isAFinalState: Is the given state a final state?
  var isAFinalState = function (st) {
    requireState(st);
    var found = false;
    $.each(final_states, function (key, value) {
      if (value.equals(st))
        found = true;
    });
    return found;
  };

  // @method Machine.finalStateReached: Is the current state a final state?
  var finalStateReached = function () {
    return isAFinalState(getState());
  };

  // @method Machine.undefinedInstruction
  //   Does the current (symbol, state) not have an corresponding instruction?
  var undefinedInstruction = function () {
    return !program.exists(tape.read(), getState());
  };

  // @method Machine.finished: Was a final state reached or
  //   was some instruction not found?
  var finished = function () {
    return finalStateReached() || undefinedInstruction();
  };

  // @method Machine.prev: Undo last `steps` operation(s)
  var prev = function (steps) {
    var steps = def(steps, 1);

    // run `steps` operations
    /*for (var i = 0; i < steps; i++)
    {
      // undo tape
      var previous_value = tape.read();
      //try {
        console.log(tape.undo());
      /*} catch (e) {
        if (e.name === "Out of History Exception")
          return false;
        throw e;
      }* /

      // undo state
      state_history.pop();

      // undo step_id
      if (step_id > 0)
        step_id -= 1;
      else
        return false; // Out of history


      // trigger events
      /*if (old_value !== instr.write)
        triggerEvent('valueWritten', null, old_value, instr.write);
      triggerEvent('movementFinished', null, instr.move);
      if (!old_state.equals(instr.state))
        triggerEvent('stateUpdated', null, old_state, instr.state);
      triggerEvent('stepFinished', null,
        instr.write, instr.move, instr.state);

      console.log("Transitioning from '" + read_symbol.toString() + "' in "
        + old_state.toString() + " by moving to " + instr.move.toString()
        + " writing '" + instr.write + "' going into "
        + instr.state.toString());
      * /
    }*/
    alert("Undo not available");

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

    var lookup = function (instr) {
      // write
      var old_value = tape.read();
      tape.write(instr.write);

      // move
      tape.move(instr.move);

      // set state
      var old_state = getState();
      state_history.push(instr.state);

      // trigger events
      if (old_value !== instr.write)
        triggerEvent('valueWritten', null, old_value, instr.write);
      triggerEvent('movementFinished', null, instr.move);
      if (!old_state.equals(instr.state))
        triggerEvent('stateUpdated', null, old_state, instr.state);
      triggerEvent('stepFinished', null,
        instr.write, instr.move, instr.state);

      console.log("Transitioning from '" + read_symbol.toString() + "' in "
        + old_state.toString() + " by moving to " + instr.move.toString()
        + " writing '" + instr.write + "' going into "
        + instr.state.toString());

      if (isAFinalState(instr.state)) {
        triggerEvent('finalStateReached', null, instr.state.toString());
        return false;
      }
      return true;
    };

    // save current state
    tape.snapshot();

    // run `steps` operations
    for (var i = 0; i < steps; i++)
    {
      var read_symbol = tape.read();
      var instr = program.get(read_symbol, getState());

      if (typeof instr !== 'undefined')
      {
        if (!lookup(instr))
          return false;
      } else {
        var fixed = false;
        triggerEvent('undefinedInstruction',
          function (result) {
            if (typeof result !== 'undefined' && result !== null) {
              program.set(read_symbol, getState(), result);
              fixed = true;
            }
          }, read_symbol, getState().toString()
        );

        if (!fixed) {
          return false;
        } else {
          if (!lookup(program.get(read_symbol, getState())))
            return false;
        }
      }

      step_id += 1;

      if (step_id % inf_loop_check === 0 && inf_loop_check !== 0) {
        var return_false = false;
        triggerEvent('possiblyInfinite', function (res) {
          if (res === true)
            return_false = true;
        }, step_id);
        if (return_false)
          return false;
      }
    }

    return true;
  };

  // @method Machine.run: Run operations until a final state is reached
  var event_listener_registered = false;
  var run = function () {
    if (keep_running)
      return false;

    if (!event_listener_registered) {
      addEventListener('stepFinished', function () {
        if (keep_running)
          setTimeout(function () {
            if (finished()) {
              keep_running = false;
              triggerEvent('runFinished', null);
              return;
            }
            next(1);
          }, 1);
      });
      event_listener_registered = true;
    }

    keep_running = true;
    next(1);
    return true;
  };

  // @method Machine.interrupt: Interrupt running machine
  var interrupt = function () {
    if (keep_running) {
      keep_running = false;
      return true;
    } else {
      return false;
    }
  };

  // @method Machine.reset: Reset machine to initial state
  var reset = function () {
    tape.clear();
    tape.fromJSON(initial_tape);
    state_history = [getInitialState()];
    step_id = 0;
    events = {};
  };

  // @method Machine.clone: Clone this machine
  var clone = function () {
    var cloned = new Machine(new Program(), new UserFriendlyTape(),
      [state("end")], getInitialState(), generic_check_inf_loop);
    cloned.fromJSON(toJSON());
    if (cloned.getMachineName()) {
      var r = new RegExp(/^.*?( cloned( (\d+))?)?$/);
      var m = r.exec(cloned.getMachineName());
      if (typeof m[1] === 'undefined')
        cloned.setMachineName(cloned.getMachineName() + " cloned");
      else if (typeof m[2] === 'undefined')
        cloned.setMachineName(cloned.getMachineName() + " 2");
      else {
        var old_num = parseInt(m[3]);
        cloned.setMachineName(m[0].substr(0, m[0].length - m[2].length + 1)
          + "" + (old_num + 1));
      }
    }
    return cloned;
  };

  // @method Machine.fromJSON: Import a Machine
  var fromJSON = function (data) {
    if (data['state_history'].length === 0 ||
        typeof data['state_history'].length === 'undefined' ||
        typeof data['tape'] === 'undefined' ||
        typeof data['program'] === 'undefined' ||
        typeof data['final_states'] === 'undefined')
      throw AssertionException("data parameter is incomplete");

    var convState = function (v) { return state(v); };

    program.fromJSON(data['program']);
    tape.fromJSON(data['tape']);
    final_states = data['final_states'].map(convState);
    initial_state = state(data['state_history'][0]);

    if (typeof data['initial_tape'] !== 'undefined')
      initial_tape = data['initial_tape'];
    if (typeof data['inf_loop_check'] !== 'undefined')
      if (data['inf_loop_check'] === null)
        inf_loop_check = Infinity;
      else
        inf_loop_check = parseInt(data['inf_loop_check']);
    if (typeof data['state_history'] !== 'undefined')
      state_history = data['state_history'].map(convState);
    if (typeof data['name'] !== 'undefined')
      name = data['name'];
    if (typeof data['step'] !== 'undefined')
      step_id = parseInt(data['step']);

    require(inf_loop_check === Infinity || !isNaN(inf_loop_check));
    require(!isNaN(step_id));
  };

  // @method Machine.toJSON: Get JSON representation
  var toJSON = function () {
    var convToJSON = function (v) { return v.toJSON(); };
    return {
      program : program.toJSON(),
      tape : tape.toJSON(),
      final_states : final_states.map(convToJSON),
      initial_state : initial_state.toJSON(),
      initial_tape : initial_tape,
      inf_loop_check : inf_loop_check === Infinity ? null : inf_loop_check,
      state_history: state_history.map(convToJSON),
      name : name,
      step : step_id
    };
  };

  return {
    addEventListener : addEventListener,
    triggerEvent : triggerEvent,
    initialize : initialize,
    getProgram : getProgram,
    setProgram : setProgram,
    getTape : getTape,
    setTape : setTape,
    getInitialTape : getInitialTape,
    setInitialTape : setInitialTape,
    isAFinalState : isAFinalState,
    getFinalStates : getFinalStates,
    addFinalState : addFinalState,
    setFinalStates : setFinalStates,
    getState : getState,
    setState : setState,
    setInfinityLoopCount : setInfinityLoopCount,
    getInfinityLoopCount : getInfinityLoopCount,
    getCursor : getCursor,
    setCursor : setCursor,
    getStep : getStep,
    getMachineName : getMachineName,
    setMachineName : setMachineName,
    replaceTapeFromJSON : replaceTapeFromJSON,
    replaceProgramFromJSON : replaceProgramFromJSON,
    finalStateReached : finalStateReached,
    undefinedInstruction : undefinedInstruction,
    finished : finished,
    prev : prev,
    next : next,
    run : run,
    interrupt : interrupt,
    reset : reset,
    clone : clone,
    fromJSON : fromJSON,
    toJSON : toJSON
  };
};

// ------------------------ TuringmachineAnimation ------------------------

var AnimatedTuringMachine = function (program, tape, final_states,
  initial_state, inf_loop_check, element)
{
  // The following events are supported:
  //   @callback initialized(machine name, visible values)
  //   @callback possiblyInfinite(steps_done)
  //     If one callback returns false, execution is aborted
  //   @callback undefinedInstruction(read symbol, state)
  //     If return value is not null, returned InstrTuple is inserted
  //   @callback finalStateReached(state)
  //   @callback valueWritten(old value, new value)
  //   @callback movementFinished(movement)
  //   @callback stateUpdated(old state, new state)
  //   @callback stepFinished(visible values, Movement object, to_state,
  //                          from_symbol, from_state)
  //   @callback runFinished()
  //   @callback resetFinished(visible values, current state)
  //   @callback speedUpdated(speed in milliseconds)

  // @member AnimatedTuringMachine.machine: Machine instance
  var machine = new Machine(program, tape, final_states,
    initial_state, inf_loop_check);

  // @member AnimatedTuringMachine.offset: Offset of .numbers instances
  var offset = 100;
  // @member AnimatedTuringMachine.width_one_number: Width of one .numbers
  var width_one_number = 60;
  // @member AnimatedTuringMachine.width_one_number: Width of focused .numbers
  var width_main_number = 185;
  // @member AnimatedTuringMachine.running_operation: Is some op running?
  var running_operation = false;
  // @member AnimatedTuringMachine.speed: Animation speed
  var speed = 2000;
  // @member AnimatedTuringMachine.animation_enabled: Disable/enable animation
  var animation_enabled = true;
  // @member AnimatedTuringMachine.keep_running: Is true while TM is "Run"ning
  var keep_running = false;

  // @member AnimatedTuringMachine.events
  // @member AnimatedTuringMachine.handled_events
  var events = {};
  var handled_events = ['initialized', 'possiblyInfinite',
    'undefinedInstruction', 'finalStateReached', 'valueWritten',
    'movementFinished', 'stateUpdated', 'stepFinished',
    'runFinished', 'resetFinished', 'speedUpdated', // public
    '_writeDone', '_moveDone', '_gearDone', '_moveAnimationsDone' // private
  ];

  // @member AnimatedTuringMachine.gear_queue: Gear queue handling instance
  var gear_queue = new CountingQueue();
  // @member AnimatedTuringMachine.gear: Gear of animation
  var gear = new GearVisualization(gear_queue);
  // @member AnimatedTuringMachine.queue: Queue of animations
  var queue = new Queue();

  var msg_wip = "Operation in progress. Invocation ignored.";

  // @method AnimatedTuringMachine._getTapeWidth: width in pixels of element
  var _getTapeWidth = function () {
    var padding = element.css('padding-left') || 0;
    if (padding)
      padding = parseInt(padding.substr(0, padding.length - 2));
    return (element[0].clientWidth - 2 * padding || 700);
  };

  // @method AnimatedTuringMachine._countTapePositions:
  //   return number of displayed numbers
  var _countTapePositions = function () {
    var number_elements = parseInt((_getTapeWidth() - width_main_number) /
      width_one_number) + 1;

    // left and right needs space for new-occuring element on shift
    number_elements -= 2;

    if (number_elements < 3)
      number_elements = 3;
    if (number_elements % 2 === 0)
      number_elements -= 1;

    return number_elements;
  };

  // @method AnimatedTuringMachine._rebuildTapeNumbers: copy & destroy .numbers
  var _rebuildTapeNumbers = function () {
    var numbers = element.find(".value");
    var mid = parseInt(numbers.length / 2);

    numbers.each(function () {
      var copy = $(this).clone(false);
      copy.removeClass("animated_left");
      copy.removeClass("animated_right");
      copy.css("opacity", 1);
      $(this).before(copy);
      $(this).remove();
    });
  };

  // @method AnimatedTuringMachine._assignSemanticalTapeClasses:
  //   assign semantical classes to .numbers instances
  var _assignSemanticalTapeClasses = function () {
    var numbers = $(".value");
    var mid = parseInt(numbers.length / 2);
    var i = 0;

    var semanticalClasses = ['lleft', 'rleft', 'mid', 'lright',
      'rright', 'left', 'right'];

    // reset classes
    numbers.each(function () {
      for (var c in semanticalClasses) {
        var cls = semanticalClasses[c];
        $(this).removeClass("value_" + cls);
      }
    });

    numbers.each(function () {
      if (i === 0)
        $(numbers[i]).addClass("value_lleft");
      else if (i === mid - 1)
        $(numbers[i]).addClass("value_rleft");
      else if (i === mid)
        $(numbers[i]).addClass("value_mid");
      else if (i === mid + 1)
        $(numbers[i]).addClass("value_lright");
      else if (i === numbers.length - 1)
        $(numbers[i]).addClass("value_rright");

      if (i < mid)
        $(numbers[i]).addClass("value_left");
      else if (i > mid)
        $(numbers[i]).addClass("value_right");

      i++;
    });
  };

  // @method AnimatedTuringMachine._animateMoveLeft: Going left animation
  var _animateMoveLeft = function () {
    running_operation = true;
    offset += 1;

    var moreNewValue = getCurrentTapeValues(_countTapePositions() + 10);
    var newValues = moreNewValue.slice(5, moreNewValue.length - 5);
    var newRightValue = newValues[newValues.length - 1];

    // update tool tip content
    UI['updateTapeToolTip'](element, getCurrentTapeValues(21));

    // insert element from right
    element.find(".value_rright").removeClass("value_rright");
    var elem = $("<div></div>").addClass("value").addClass("value_rright")
      .css("opacity", "0").css("right", "0px").text(newRightValue);
    element.find(".numbers").append(elem);

    // add animated-CSS-class to trigger animation
    var elem = element.find(".value");
    elem.addClass("animated_left");
    elem.css("animation-duration", "" + speed + "ms");
    var count_last = elem.length;
    elem.each(function () {
      var isRright = $(this).hasClass("value_rright");
      var isLleft = $(this).hasClass("value_lleft");
      $(this)[0].addEventListener("animationend", function () {
        $(this).removeClass("animated_left");

        // disallow most-right element to switch back to invisibility
        if (isRright)
          $(this).css("opacity", 1);

        // delete most-left element
        if (isLleft)
          $(this).remove();

        count_last -= 1;
        if (count_last === 0) { // last element triggers finalization
          // recreate DOM element to make next animation possible
          _rebuildTapeNumbers();

          // assign semantic CSS classes such as lleft
          _assignSemanticalTapeClasses();

          // trigger callback
          triggerEvent('_moveDone', null, newValues, newRightValue, 'left');
          running_operation = false;
        }
      }, true);
    });
  };

  // @method AnimatedTuringMachine._animateMoveRight: Going right animation
  var _animateMoveRight = function () {
    running_operation = true;
    offset -= 1;

    var moreNewValue = getCurrentTapeValues(_countTapePositions() + 10);
    var newValues = moreNewValue.slice(5, moreNewValue.length - 5);
    var newLeftValue = newValues[0];

    // update tool tip content
    UI['updateTapeToolTip'](element, getCurrentTapeValues(21));

    // reduce left-padding to get space for new element
    var numbers = element.find(".numbers");
    var oldPadding = parseInt(numbers.css("padding-left"));
    if (!isNaN(oldPadding)) {
      var newPadding = (oldPadding - width_one_number);
      numbers.css("padding-left", newPadding + "px");
    }

    // insert element from left
    element.find(".value_lleft").removeClass("value_lleft");
    var elem = $("<div></div>").addClass("value").addClass("value_lleft")
      .css("opacity", "0").css("left", "0px").text(newLeftValue);
    element.find(".numbers").prepend(elem);

    // add animated-CSS-class to trigger animation
    var elem = element.find(".value");
    elem.addClass("animated_right");
    elem.css("animation-duration", "" + speed + "ms");
    var count_last = elem.length;
    elem.each(function () {
      var isLleft = $(this).hasClass("value_lleft");
      var isRright = $(this).hasClass("value_rright");

      $(this)[0].addEventListener("animationend", function () {
        $(this).removeClass("animated_right");

        // reset padding-left to old value (only one time)
        if (isLleft)
          numbers.css("padding-left", oldPadding);

        // disallow most-left element to switch back to invisibility
        if (isLleft)
          $(this).css("opacity", 1);

        // delete most-right element
        if (isRright)
          $(this).remove();

        count_last -= 1;
        if (count_last === 0) { // last element triggers finalization
          // recreate DOM element to make next animation possible
          _rebuildTapeNumbers();

          // assign semantic CSS classes such as lleft
          _assignSemanticalTapeClasses();

          // trigger callback
          triggerEvent('_moveDone', null, newValues, newLeftValue, 'right');
          running_operation = false;
        }
      }, true);
    });
  };

  var _animateMoveLeftJump = function () {
    running_operation = true;
    offset -= 1;

    var moreNewValue = getCurrentTapeValues(_countTapePositions() + 10);
    var newValues = moreNewValue.slice(5, moreNewValue.length - 5);
    var newRightValue = newValues[newValues.length - 1];

    // update tool tip content
    UI['updateTapeToolTip'](element, getCurrentTapeValues(21));

    // insert element from left
    element.find(".value_rright").removeClass("value_rright");
    var elem = $("<div></div>").addClass("value")
      .addClass("value_rright").text(newRightValue);
    element.find(".numbers").append(elem);

    // delete most-left element
    element.find(".value_lleft").remove();

    // recompute semantical classes
    _assignSemanticalTapeClasses();

    // trigger callback
    triggerEvent('_moveDone', null, newValues, newRightValue, 'right');
    running_operation = false;
  };

  var _animateMoveRightJump = function () {
    running_operation = true;
    offset -= 1;

    var moreNewValue = getCurrentTapeValues(_countTapePositions() + 10);
    var newValues = moreNewValue.slice(5, moreNewValue.length - 5);
    var newLeftValue = newValues[0];

    // update tool tip content
    UI['updateTapeToolTip'](element, getCurrentTapeValues(21));

    // insert element from left
    element.find(".value_lleft").removeClass("value_lleft");
    var elem = $("<div></div>").addClass("value")
      .addClass("value_lleft").text(newLeftValue);
    element.find(".numbers").prepend(elem);

    // delete most-right element
    element.find(".value_rright").remove();

    // recompute semantical classes
    _assignSemanticalTapeClasses();

    // trigger callback
    triggerEvent('_moveDone', null, newValues, newLeftValue, 'right');
    running_operation = false;
  };

  // @method AnimatedTuringMachine._animateNoMove: animate STOP movement
  var _animateNoMove = function () {
    var moreNewValue = getCurrentTapeValues(_countTapePositions() + 10);
    var newValues = moreNewValue.slice(5, moreNewValue.length - 5);

    // be sure not be too fast
    setTimeout(function () {
      triggerEvent('_moveDone', null, newValues, null, 'right');
    }, 20);
  };

  // @method AnimatedTuringMachine._animateWriteValue: Write new focused value
  var _animateWriteValue = function (new_value) {
    var mid = parseInt($(".value").length / 2);
    var old_value = $(".value:eq(" + mid + ")").text();
    var halftime = parseInt(speed / 4);
    var animationSpeed = parseInt(speed / 2);

    var writingValue = function () {
      if (new_value)
        $(".value:eq(" + mid + ")").text(new_value);
    };
    var removeEventHandlers = function () { // cloning dump event handlers
      var original = element.find(".writer");
      var copy = original.clone();
      original.after(copy);
      original.first().remove();
    };
    running_operation = true;

    // update tool tip content
    UI['updateTapeToolTip'](element, getCurrentTapeValues(21));

    element.find(".writer").css("animation-duration", animationSpeed + "ms");
    element.find(".writer").addClass("animated_writer");
    setTimeout(writingValue, halftime);
    element.find(".writer")[0].addEventListener("animationend", function () {
      $(this).removeClass("animated_writer");
      running_operation = false;

      triggerEvent('_writeDone', null, old_value, new_value);
      removeEventHandlers();
    }, true);
  };

  // @method AnimatedTuringMachine._animateNoWrite: write w/o animation
  var _animateNoWrite = function (new_value) {
    var mid = parseInt($(".value").length / 2);
    var old_value = $(".value:eq(" + mid + ")").text();
    element.find(".value_mid").text(new_value);

    // be sure not be too fast
    setTimeout(function () { triggerEvent('_writeDone', null, old_value, new_value); }, 20);
  };

  // @method AnimatedTuringMachine.addEventListener: add event listener
  var addEventListener = function (evt, callback) {
    if ($.inArray(evt, handled_events) !== -1) {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push(callback);
    } else {
      throw new Error("Unknown event: " + evt);
    }
  };

  // @method AnimatedTuringMachine.triggerEvent: trigger event
  var triggerEvent = function (evt, _) {
    var args = [];
    for (var i=0; i < arguments.length; i++) {
      if (i >= 2)
        args.push(arguments[i]);
    }
    for (var e in events[evt]) {
      var res = events[evt][e].apply(events[evt], args);
      if (res === false)
        events[evt].splice(e, 1);
    }
  };

  // @method AnimatedTuringMachine.getCurrentTapeValues
  var getCurrentTapeValues = function (count) {
    count = def(count, _countTapePositions());
    var selection = machine.getTape().read(undefined, count);

    if (selection.length !== count)
      throw new Error("Bug: Size of selected elements invalid");

    return selection;
  };

  // @method AnimatedTuringMachine.enableAnimation
  var enableAnimation = function () {
    animation_enabled = true;
  };

  // @method AnimatedTuringMachine.disableAnimation
  var disableAnimation = function () {
    animation_enabled = false;
  };

  // @method AnimatedTuringMachine.speedUp: Increase speed
  var speedUp = function () {
    if (speed <= 200)
      return false;
    speed -= 100;
    triggerEvent('speedUpdated', null, speed);
    return true;
  };

  // @method AnimatedTuringMachine.speedDown: Decrease speed
  var speedDown = function () {
    speed += 100;
    triggerEvent('speedUpdated', null, speed);
    return true;
  };

  // @method AnimatedTuringMachine.initialize
  var initialize = function () {
    running_operation = true;
    var vals = getCurrentTapeValues();
    var mid = parseInt(vals.length / 2);

    // create numbers
    for (var i = 0; i < vals.length; i++) {
      var elem = $("<div></div>").addClass("value").text(vals[i]);
      element.find(".numbers").append(elem);
    }

    // assign CSS classes
    _assignSemanticalTapeClasses();

    // define left padding
    var computedWidth = width_one_number * (_countTapePositions() - 1);
    computedWidth += width_main_number;
    var actualWidth = _getTapeWidth();
    var diff = actualWidth - computedWidth;

    $(".numbers").css("padding-left", parseInt(diff / 2) + "px");

    // trigger _moveAnimationsDone if _moveDone AND _gearDone was triggered
    var _move_animations_done = false;
    addEventListener('_moveDone', function () {
      if (_move_animations_done) {
        _move_animations_done = false;
        triggerEvent('_moveAnimationsDone', null);
      } else {
        _move_animations_done = true;
      }
    });
    addEventListener('_gearDone', function () {
      if (_move_animations_done) {
        _move_animations_done = false;
        triggerEvent('_moveAnimationsDone', null);
      } else {
        _move_animations_done = true;
      }
    });

    // trigger events for performStep continuation
    addEventListener('_writeDone', function () {
      performStepContinue();
    });
    addEventListener('_moveAnimationsDone', function () {
      performStepContinue2();
    });

    // connect gear events
    gear.addEventListener('animationsFinished', function () {
      triggerEvent('_gearDone', null);
    });

    // trigger step animations only machine's step finished
    var latest_state = machine.getState();
    var latest_symbol = machine.getTape().read(undefined, 1);
    machine.addEventListener('valueWritten', function (old_value, new_value) {
      latest_symbol = new_value;
    });
    machine.addEventListener('stateUpdated', function (old_state, new_state) {
      latest_state = new_state;
    });
    machine.addEventListener('stepFinished', function (write_symbol,
      move, to_state) {
      performStep(latest_symbol, latest_state, write_symbol, move, to_state);
    });

    // trigger machine's undefinedInstruction if instruction undefined
    machine.addEventListener('undefinedInstruction', function (v, s) {
      // TODO: Fix needed: return value should be InstrTuple or null
      //       to provide missing instruction. Difficult to do async.
      triggerEvent('undefinedInstruction', null, v, s);
    });

    triggerEvent('initialized', null, machine.getMachineName(), vals);

    machine.initialize();
    running_operation = false;
  };

  // @method AnimatedTuringMachine.reset: Reset machine to initial state
  var reset = function () {
    if (running_operation) {
      console.warn(msg_wip);
      return;
    }

    running_operation = true;
    machine.reset();

    element.find(".numbers *").remove();

    events = {};
    initialize();
    running_operation = false;
  };

  // @method AnimatedTuringMachine.performStep:
  //   move gear & tape, write value, update state
  var _step_params;
  var performStep = function (from_symbol, from_state,
    write_symbol, move, to_state)
  {
    running_operation = true;

    var runWrite = function () {
      if (animation_enabled)
        _animateWriteValue(write_symbol);
      else
        _animateNoWrite(write_symbol);
    };

    runWrite();
    // will continue in performStepContinue
    //   it waits for runWrite() to finish
    //   is triggered by _writeDone event
    _step_params = [from_symbol, from_state, write_symbol, move, to_state];
  };

  var performStepContinue = function () {
    var from_symbol = _step_params[0],
        from_state = _step_params[1],
        write_symbol = _step_params[2],
        move = _step_params[3],
        to_state = _step_params[4];

    var left = move.equals(mov.LEFT),
        right = move.equals(mov.RIGHT),
        stop = move.equals(mov.STOP);

    var runGear = function () {
      if (!animation_enabled) {
        gear.done();
        return;
      }
      if (left)
        gear.addStepsLeft(1);
      else if (right)
        gear.addStepsRight(1);
      else
        gear.done();
    };

    // Remark. "Moving turingmachine left" means moving the tape *right*!
    var runMovement = function () {
      if (!animation_enabled || speed < 1000) {
        if (left)
          _animateMoveRightJump();
        else if (right)
          _animateMoveLeftJump();
        else
          _animateNoMove();
      } else {
        if (left)
          _animateMoveRight();
        else if (right)
          _animateMoveLeft();
        else
          _animateNoMove();
      }
    };

    runGear();
    runMovement();

    // will continue in performStepContinue2
    //   it just waits for runGear() and runMovement() to finish
    //   is triggered by _moveAnimationsDone event
  };

  var performStepContinue2 = function () {
    var from_symbol = _step_params[0],
        from_state = _step_params[1],
        write_symbol = _step_params[2],
        move = _step_params[3],
        to_state = _step_params[4];

    var runUpdateState = function () {
      UI['updateState'](element, to_state, machine.finalStateReached(),
        machine.undefinedInstruction());
    };

    runUpdateState();

    // trigger events
    if (machine.finalStateReached())
      triggerEvent('finalStateReached', null, machine.getState());
    if (from_symbol !== write_symbol)
      triggerEvent('valueWritten', null, from_symbol, write_symbol);
    triggerEvent('movementFinished', null, move);
    if (!from_state.equals(to_state))
      triggerEvent('stateUpdated', null, from_state, to_state);

    var abort = false;
    if (machine.getStep() !== 0 &&
        machine.getStep() % machine.getInfinityLoopCount() === 0)
      triggerEvent('possiblyInfinite', /* TODO function (result) {
        if (result === true) {
          keep_running = false;
          abort = true;
        }
      }*/ null, machine.getStep());

    //if (abort)
    //  return;

    var vals = getCurrentTapeValues();
    triggerEvent('stepFinished', null, vals,
      move, to_state, from_symbol, from_state);

    running_operation = false;
  };

  // @method AnimatedTuringMachine.next: Perform the next `steps` operation
  var next = function (steps) {
    if (running_operation) {
      console.warn(msg_wip);
      return;
    }

    machine.next(steps);
    // animations will be triggered through machine's stepFinished event
  };

  // @method AnimatedTuringMachine.run: Run this turing machine
  var run_listener_registered = false;
  var run = function () {
    if (keep_running)
      return false;

    if (!run_listener_registered) {
      addEventListener('stepFinished', function () {
        if (keep_running)
          setTimeout(function () {
            if (machine.finished()) {
              keep_running = false;
              triggerEvent('runFinished', null);
              return;
            }
            next(1);
          }, 1);
      });
      run_listener_registered = true;
    }

    keep_running = true;
    next(1);
    return true;
  };

  // @method Machine.interrupt: Interrupt running machine
  var interrupt = function () {
    if (keep_running) {
      machine.interrupt();
      keep_running = false;
      return true;
    } else {
      return false;
    }
  };

  return inherit(machine, {
    addEventListener : addEventListener,
    triggerEvent : triggerEvent,
    initialize : initialize,
    interrupt : interrupt,
    reset : reset,
    enableAnimation : enableAnimation,
    disableAnimation : disableAnimation,
    getCurrentTapeValues : getCurrentTapeValues,
    speedUp : speedUp,
    speedDown : speedDown,
    next : next,
    run : run
  });
};

// ---------------------------- Testcase Runner ---------------------------

function TestcaseRunner(tm, market) {
  // @callback testsuiteSucceeded(program name)
  // @callback testsuiteFailed(program name)
  // @callback testcaseSucceeded(testcase name)
  // @callback testcaseFailed(testcase name)
  // @member TestcaseRunner.events
  var events = {};
  var valid_events = ['testsuiteSucceeded', 'testsuiteFailed',
    'testcaseSucceeded', 'testcaseFailed'];
  // @member TestcaseRunner.tests
  var tests = [];

  var N_SUCCESS = " Testcase '%1' succeeded.";
  var N_FAILURE = " Testcase '%1' failed.";

  // @method TestcaseRunner.addEventListener
  var addEventListener = function (evt, callback) {
    if ($.inArray(evt, valid_events) !== -1) {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push(callback);
    } else
      throw new Error("Unknown event " + evt);
  };

  // @method TestcaseRunner.triggerEvent
  var triggerEvent = function (evt, clbk) {
    var args = [];
    for (var i=0; i < arguments.length; i++) {
      if (i >= 2)
        args.push(arguments[i]);
    }
    for (var e in events[evt]) {
      var res = events[evt][e].apply(events[evt], args);
      if (clbk) clbk(res);
    }
  };

  // @method TestcaseRunner.getTestcases: Retrieve all testcases
  var getTestcases = function () {
    if (typeof market['testcases'] === 'undefined')
      return [];
    else
      return market['testcases'].map(function (t) { return t['name']; });
  };

  // @method TestcaseRunner.lookupTestcase: Lookup testcase by name
  var lookupTestcase = function (tc_name) {
    if (typeof market['testcases'] === 'undefined')
      throw new Error("No testcase available in market " + market['title']);

    for (var t in market['testcases']) {
      if (market['testcases'][t]['name'] === tc_name)
        return market['testcases'][t];
    }

    return null;
  };

  // @method TestcaseRunner._inputTestcase: Set testcase to initial config
  var _inputTestcase = function (testcase) {
    if (typeof testcase['final_states'] !== 'undefined')
      tm.setFinalStates(testcase['final_states']
        .map(function (v) { return state(v); }));

    if (typeof testcase['input'] === 'undefined')
      return;

    var tap = deepCopy(testcase['input']['tape']);

    if (typeof testcase['input']['state'] === 'undefined')
      tm.setState(state(testcase['input']['state']));
    if (typeof tap['default_value'] === 'undefined')
      tap['default_value'] = "0";
    if (typeof tap['offset'] === 'undefined')
      tap['offset'] = 0;
    else
      tap['offset'] = parseInt(tap['offset']);
    if (typeof tap['cursor'] === 'undefined')
      tap['cursor'] = -1;
    else
      tap['cursor'] = parseInt(tap['cursor']);

    tm.getTape().fromJSON(tap);
  };

  // @method TestcaseRunner._validateTapeContent: normalized tape cmp
  function _validateTapeContent(a_content, a_cursor, e_content, e_cursor)
  {
    var i = -e_cursor;
    while (i < e_content.length - e_cursor) {
      if (def(e_content[e_cursor + i], '0') !==
        def(a_content[a_cursor + i], '0'))
        return false;
      i++;
    }
    return true;
  };

  // @method TestcaseRunner._outputTestcase: Test final state
  var _outputTestcase = function (testcase, value_written, move_done) {
    var out = testcase['output'];

    if (typeof out['final_state'] !== 'undefined')
      if (!tm.getState().equals(state(out['final_state'])))
        return { success : false, msg :
          'I started in state "' + testcase['input']['state'] +
          '" and expected to end up in state "' + out['final_state'] +
          '". But the final state was "' + tm.getState().toString() + '"'
        };

    var occ = tm.undefinedInstruction();
    var halted = (tm.getInfinityLoopCount() !== tm.getStep());
    var fin = tm.finalStateReached();
    if (typeof out['unknown_instruction'] !== 'undefined')
      if (!occ && out['unknown_instruction'])
        return { success : false, msg :
          'I expected to run into an undefined transition. ' +
          (!halted ? 'Instead the machine did not terminate.' : '') +
          (fin ? 'Instead the machine reached a final state.' : '')
        };
      else if (occ && !out['unknown_instruction'])
        return { success : false, msg :
          'An undefined transition occured: No transition for state "' +
          tm.getState() + '" and symbol "' + tm.getTape().read(undefined, 1) +
          '"'
        };

    if (typeof out['halt'] !== 'undefined')
      if (!halted && halt)
        return { success : false, msg :
          'I expected the machine to terminate, but it was running forever.'
        };
      else if (halted && !halt)
        return { success : false, msg :
          'I expected the machine to run forever, but it terminated.'
        };

    if (typeof out['value_written'] !== 'undefined')
      if (!value_written)
        return { success : false, msg :
          'Expected value "' + out['value_written'] + '" to be written ' +
          'at least once. But never happened during the run.'
        };

    if (typeof out['movement_done'] !== 'undefined')
      if (!move_done)
        return { success : false, msg :
          'Expected movement "' + out['movement_done'] + '" to happen ' +
          'at least once. But never occured during the run.'
        };

    if (typeof out['exact_number_of_iterations'] !== 'undefined')
      if (tm.getStep() !== parseInt(out['exact_number_of_iterations']))
        return { success : false, msg :
          'Expected to make exactly ' + out['exact_number_of_iterations'] +
          ' steps. But it was ' + tm.getStep()
        };

    if (typeof out['tape'] !== 'undefined') {
      var actual = tm.getTape().toJSON();
      var expected = out['tape'];
      var err = 'Expected default_value "%1" at tape, but was "%2"';

      if (typeof expected['default_value'] !== 'undefined')
        if (expected['default_value'] !== actual['default_value'])
          return { success : false, msg : err.replace('%1', expected['default_value'])
                   .replace('%2', actual['default_value']) };

      if (typeof expected['offset'] !== 'undefined')
        if (parseInt(expected['offset']) !== parseInt(actual['offset']))
          return { success : false, msg : err.replace('%1', expected['offset'])
                   .replace('%2', actual['offset']) };

      if (typeof expected['cursor'] !== 'undefined')
        if (parseInt(expected['cursor']) !== parseInt(actual['cursor']))
          return { success : false, msg : err.replace('%1', expected['cursor'])
                   .replace('%2', actual['cursor']) };

      if (!_validateTapeContent(actual['data'], def(actual['cursor'], -1),
        expected['data'], def(expected['cursor'], -1)))
        return { success : false, msg :
          'Resulting tape differs. Expected "' + expected['data'].join(",") +
          '" with cursor at ' + def(expected['cursor'], -1) + ' but was "' +
          actual['data'].join(",") + '" with cursor at ' +
          def(actual['cursor'], -1)
        };
    }

    return { success : true, msg : N_SUCCESS.replace('%1', testcase['name']) };
  };

  // @method TestcaseRunner.run: Run one testcase
  var run = function (tc_name) {
    var value_written = false, move_done = false;
    var testcase = lookupTestcase(tc_name);

    _inputTestcase(tc_name);
    if (typeof testcase['output']['value_written'] !== 'undefined')
      tm.addEventListener('valueWritten', function (old_v, new_v) {
        if (old_v === testcase['output']['value_written'] ||
            new_v === testcase['output']['value_written'])
          value_written = true;
      });
    if (typeof testcase['output']['movement_done'] !== 'undefined')
      tm.addEventListener('movementFinished', function (move) {
        if (move.equals(movement(testcase['output']['movement_done'])))
          move_done = true;
      });

    tm.run();
    return _outputTestcase(tc_name, value_written, move_done);
  };

  // @method TestcaseRunner.runAll: Run all testcases in this market
  var runAll = function () {
    var tests = getTestcases();
    var first_failing;
    var count = [0, 0];

    for (var t in tests) {
      var res = run(tests[t]);
      if (res['success'])
        count[0] += 1;
      else {
        count[1] += 1;
        if (!first_failing) {
          first_failing = res;
          first_failing['testcase'] = tests[t]['name'];
        }
      }
    }

    if (count[1] === 0)
      return { success : true, msg :
        'All testcases of ' + market['title'] + ' succeeded.'
      };
    else {
      first_failing['msg'] = 'Testcase "' + first_failing['testcase'] +
        '" failed. Totally ' + count[1] + ' failed and ' + count[0] +
        ' succeeded.\n\nTestcase yielded:\n' + first_failing['msg'];
      return first_failing;
    }
  };

  return {
    addEventListener : addEventListener,
    triggerEvent : triggerEvent,
    getTestcases : getTestcases,
    lookupTestcase : lookupTestcase,
    run : run,
    runAll : runAll
  };
};

// --------------------------- GearVisualization ---------------------------

function GearVisualization(queue) {
  var currently_running = false;
  var events = {};
  var valid_events = ['animationFinished', 'animationsFinished'];

  var addEventListener = function (evt, clbk) {
    if ($.inArray(evt, valid_events) === -1)
      throw new Error("Unknown event " + evt);
    if (typeof events[evt] === 'undefined')
      events[evt] = [];
    events[evt].push(clbk);
  };

  var triggerEvent = function (evt, clbk) {
    var args = [];
    for (var i=0; i < arguments.length; i++) {
      if (i >= 2)
        args.push(arguments[i]);
    }
    for (var e in events[evt]) {
      var res = events[evt][e].apply(events[evt], args);
      if (clbk) clbk(res);
    }
  };

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

  var done = function () {
    currently_running = false;
    triggerEvent('animationFinished', null);
    if (queue.isEmpty()) {
      triggerEvent('animationsFinished', null);
      return;
    }
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
    if (queue.isEmpty()) {
      triggerEvent('animationsFinished', null);
      return;
    }

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
    for (var prop in properties)
      defaultProperties[prop] = properties[prop];
    defaultProperties['animationPlayState'] = 'running';

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
      done();
      nextAnimation();
    }, false);
  };

  return {
    addEventListener : addEventListener, triggerEvent : triggerEvent,
    done : done, addStepsLeft: addStepsLeft, addStepsRight: addStepsRight,
    startAnimation: startAnimation
  };
};

// ------------------------------ TuringMarket ----------------------------

var MarketManager = function (current_machine, ui_notes, ui_meta, ui_data) {
  // @callback marketActivate(market id, market)
  var load_interval = 5000; // milliseconds
  var ui_programs = ui_meta.find("select.example");
  var ui_testcases = ui_meta.find("select.testcase");
  var ui_transitiontable = ui_data.find(".transition_table");
  var loaded_markets = {};
  var events = {};
  var valid_events = ['marketActivated'];

  // @method MarketManager.init: Initialize market handling
  var initialize = function () {
    var changes = loadMarkets();
    clearMarkets();
    updateMarketsAtUI(changes[0], changes[1]);
    clearTestcases();
    activateMarket(getActiveMarket());
    setInterval(loadMarkets, load_interval);

    ui_programs.change(function () {
      var data = loaded_markets[getActiveMarket()].getData();
      clearTestcases();
      for (var tc in data['testcases'])
        addTestcase(data['testcases'][tc]);
    });
    ui_meta.find(".example_run").click(function () {
      activateMarket(getActiveMarket());
      UI['alertNote'](ui_notes, "That feature is not yet available");
    });
  };

  // @method MarketManager._marketChanges: Return [new markets, depr markets]
  var _marketChanges = function (l, m) {
    var ls = keys(l).sort();
    var ms = m.slice().sort();

    var new_m = [];
    var new_l = [];
    var i = 0, j = 0;
    if (ls.length === 0)
      return [ms, []];
    if (ms.length === 0)
      return [[], ls];
    while (i < ls.length && j < ms.length) {
      if (ls[i] === ms[j]) {}
      else if (ls[i] < ms[j]) {
        new_l.push(ls[i]);
        j -= 1;
      } else if (ls[i] > ms[j]) {
        new_m.push(ms[j]);
        i -= 1;
      }
      i += 1;
      j += 1;
    }

    return [new_m, new_l];
  };

  // @method MarketManager.addEventListener: Add event listener
  var addEventListener = function (evt, clbk) {
    if ($.inArray(evt, valid_events) !== -1) {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push(clbk);
    } else
      throw new Error("Unknown event " + evt);
  };

  // @method MarketManager.marketLoaded: Is the given market loaded?
  var marketLoaded = function (name) {
    return typeof loaded_markets[name] !== 'undefined';
  };

  // @method MarketManager.getActiveMarket: get active market
  var getActiveMarket = function () {
    return ui_programs.find("option:selected").text();
  };

  // @method MarketManager.loadMarkets: Load markets given in URL hash
  var loadMarkets = function () {
    var hash_markets = window.location.hash.slice(1).split(";");
    if (hash_markets.length === 1 && hash_markets[0] === "")
      hash_markets = generic_markets.slice();
    hash_markets.sort();

    // special market "test", actually runs testsuite without loading market
    var idx = $.inArray("test", hash_markets);
    if (idx !== -1) {
      var t = testsuite();
      UI['alertNote'](ui_notes,
        typeof t === 'string' ? t : 'Testsuite: ' + t.message
      );
      hash_markets.splice(idx, 1);
      loaded_markets['test'] = null; // TODO
    }

    // do not update, if hasn't changed
    if (arrayEqualIdentity(keys(loaded_markets).sort(),
      hash_markets.slice().sort()))
      return;

    var changes = _marketChanges(loaded_markets, hash_markets);
    $.each(changes[0], function (_, new_m) {
      loaded_markets[new_m] = new TuringMarket(current_machine, new_m);
      loaded_markets[new_m].load();
    });
    $.each(changes[1], function (_, depr_m) {
      delete loaded_markets[depr_m];
    });

    return changes;
  };

  // @method MarketManager.clearMarkets: Remove all markets from UI
  var clearMarkets = function () {
    ui_programs.find("option").remove();
  };

  // @method MarketManager.updateMarketsAtUI: Update all markets in UI
  var updateMarketsAtUI = function (intro, deprecate) {
    for (var i in intro) {
      var doit = false;
      ui_programs.find("option").each(function (_, e) {
        if (!doit && $(e).text() > intro[i]) {
          $(e).after($("<option></option>").text(intro[i]));
          doit = true;
        }
      });
      if (!doit)
        ui_programs.append($("<option></option>").text(intro[i]));
    }
    for (var i in deprecate) {
      var doit = false;
      ui_program.find("option").each(function (_, e) {
        if (!doit && $(e).text() === deprecate[i]) {
          $(e).remove();
          doit = true;
        }
      });
    }
  };

  // @method MarketManager.activateMarket: Activate a given market
  var activateMarket = function (market_id) {
    var market = loaded_markets[market_id];
    require(typeof market !== 'undefined', "market to activate unknown");
    var dat = market.getData();

    var activate = function (data) {
      require(typeof data['title'] !== 'undefined', "data is empty");
      setDescription(data['title'], data['description']);
      if (typeof data['tape'] !== 'undefined')
        setTape(data['tape']);
      if (typeof data['program'] !== 'undefined')
        setProgram(data['program']);
      if (typeof data['final_states'] !== 'undefined')
        current_machine.setFinalStates(data['final_states'].map(state));
      if (typeof data['max_iterations'] !== 'undefined')
        current_machine.setInfinityLoopCount(data['max_iterations']);
      clearTestcases(ui_testcases);
      for (var tc in data['testcases'])
        addTestcase(data['testcases'][tc]);

      for (var e in events['marketActivated'])
        events['marketActivated'][e](market_id);
    };

    if (typeof dat['title'] === 'undefined')
      market.addEventListener('loaded', function (m, d) { activate(d); });
    else
      activate(dat);
  };

  // @method TuringMarket.clearTestcases: Clear testcases in UI
  var clearTestcases = function () {
    ui_testcases.find("option").remove();
  };

  // @method TuringMarket.addTestcase: Add testcase to element
  var addTestcase = function (testcase) {
    ui_testcases.append($("<option></option>").text(testcase['name']));
  };

  // @method TuringMarket.setDescription: Update description & title
  var setDescription = function (title, desc) {
    var elem = UI['createDescription'](title, desc);
    ui_meta.find(".description").replaceWith(elem);
  };

  // @method TuringMarket.setTape: Set tape in JSON of current machine
  var setTape = function (tape) {
    current_machine.getTape().fromJSON(deepCopy(tape));
    current_machine.setInitialTape(deepCopy(tape));
  };

  // @method TuringMarket.setProgram: Set program in JSON of current machine
  var setProgram = function (prg) {
    var data = [];
    for (var i in prg)
      data.push([prg[i][0], prg[i][1], [prg[i][2], prg[i][3], prg[i][4]]]);
    current_machine.getProgram().fromJSON(data);
  };

  return {
    addEventListener : addEventListener,
    initialize : initialize,
    marketLoaded : marketLoaded,
    getActiveMarket : getActiveMarket,
    loadMarkets : loadMarkets,
    updateMarketsAtUI : updateMarketsAtUI,
    activateMarket : activateMarket,
    clearTestcases : clearTestcases,
    addTestcase : addTestcase
  };
};

// @function verifyMarket: Verify whether provided market data validate
var verifyMarket = function (market) {
  var inArray = function (needle, haystack) {
    for (var n in haystack)
      if (haystack[n] === needle)
        return true;
    return false;
  };
  var isString = function (v) {
    require(typeof(v) === 'string', "Is not a string: " + JSON.stringify(v));
  };
  var isNumber = function (v) {
    require(typeof(v) === 'number', "Is not a number: " + JSON.stringify(v));
  };
  var isBool = function (v) {
    require(typeof(v) === 'boolean', "Is not a boolean: " + JSON.stringify(v));
  };
  var isList = function (v) {
    require(typeof(v) === 'object');
    for (var key in v) {
      if (isNaN(parseInt(key)))
        require(false, "Does not appear to be a list (key " +
          JSON.stringify(key) + " invalid)");
    }
  };
  var isObject = function (v) { require(typeof(v) === 'object'); };
  var expectKeys = function (obj, keys) {
    for (var key in obj)
      require(inArray(key, keys) || inArray(key + '?', keys),
        "Unexpected object key: " + JSON.stringify(key));
    for (var k in keys) {
      var key = keys[k];
      var name = key.replace(/\?$/, '');
      if (key[key.length - 1] !== '?')
        require(typeof obj[name] !== 'undefined', key + " required");
    }
  };
  var isTape = function (obj) {
    expectKeys(obj, ['default_value?', 'offset?', 'cursor?', 'data']);
    require(typeof obj['offset'] === 'number' ||
      typeof obj['offset'] === 'undefined');
    require(typeof obj['cursor'] === 'number' ||
      typeof obj['cursor'] === 'undefined');
    isList(obj['data']);
  };
  var isProgram = function (obj) {
    for (var i in obj) {
      isMovement(obj[i][3]);
      isString(obj[i][1]);
      isString(obj[i][4]);

      var count = 0;
      for (var j in obj[i])
        count += 1;
      require(count === 5, "Expected 5 values in transition table entry");
    }
  };
  var isMovement = function (str) {
    require(typeof str !== 'undefined', "Invalid movement: undefined");
    require(inArray(str.toLowerCase(),
      ['l', 'left', 'r', 'right', 's', 'stop']),
      "Invalid movement: " + str);
  };

  expectKeys(market, ['title', 'description', 'tape?', 'program?',
    'state?', 'final_states?', 'max_iterations?', 'testcases?']);
  isString(market['title']);
  require(market['description'].length > 0);
  market['description'].map(function (v) { isString(v); });
  if (typeof market['tape'] !== 'undefined')
    isTape(market['tape']);
  if (typeof market['program'] !== 'undefined')
    isProgram(market['program']);
  if (typeof market['state'] !== 'undefined')
    isString(market['state']);
  if (typeof market['final_states'] !== 'undefined') {
    require(market['final_states'].length > 0);
    market['final_states'].map(function (v) { isString(v); });
  }
  if (typeof market['max_iterations'] !== 'undefined')
    isNumber(market['max_iterations']);
  if (typeof market['testcases'] !== 'undefined') {
    var count = 0;
    for (var key in market['testcases']) {
      count += 1;
      var test = market['testcases'][key];

      expectKeys(test, ['name', 'final_states?', 'input', 'output']);
      isString(test['name']);
      if (typeof test['final_states'] !== 'undefined') {
        isList(test['final_states']);
        require(test['final_states'].length > 0);
        test['final_states'].map(function (v) { isString(v); });
      }
      isObject(test['input']);
      isString(test['input']['state']);
      isTape(test['input']['tape']);
      isObject(test['output']);
      expectKeys(test['output'], ['final_state?', 'unknown_instruction?', 'halt?',
        'value_written?', 'movement_done?', 'exact_number_of_iterations?', 'tape?']);
      if (typeof test['output']['final_state'] !== 'undefined')
        isString(test['output']['final_state']);
      if (typeof test['output']['unknown_instruction'] !== 'undefined')
        isBool(test['output']['unknown_instruction']);
      if (typeof test['output']['halt'] !== 'undefined')
        isBool(test['output']['halt']);
      if (typeof test['output']['movement_done'] !== 'undefined')
        isMovement(test['output']['movement_done']);
      if (typeof test['output']['exact_number_of_iterations'] !== 'undefined')
        isNumber(test['output']['exact_number_of_iterations']);
      if (typeof test['output']['tape'] !== 'undefined')
        isTape(test['output']['tape']);
    }
    require(count > 0, "testcases must contain at least one testcase");
  }
};

var TuringMarket = function (machine, market_id) {
  var data = {};
  var example_element = $("select.example");
  var testcase_element = $(".testcase");
  var events = {};

  // @method TuringMarket.addEventListener: add event listener
  var addEventListener = function (evt, clbk) {
    if (evt === 'loaded' || evt === 'verified')
      if (typeof events[evt] === 'undefined')
        events[evt] = [clbk];
      else
        events[evt].push(clbk);
    else
      throw new Error("Unknown event " + evt);
  };

  // @method TuringMarket.load: Load data of market via network
  var load = function () {
    var loaded = false;
    setTimeout(function () {
      if (!loaded)
        console.error("Seems like " + market_id + " was not loaded.");
    }, 5000);
    addEventListener('loaded', function () {
      loaded = true;
      console.log("Market " + market_id + " was loaded.");
    });

    $.get("markets/" + market_id + ".js", function (dat) {
      verify(dat);
      data = dat;
      for (var e in events['loaded'])
        events['loaded'][e](market_id, data);
    }, "json");
  };

  // @method TuringMarket.verify: Verify correctness of market data
  var verify = function (dat) {
    verifyMarket(dat);
    for (var e in events['verified'])
      events['verified'][e](data);
  };

  // @method TuringMarket.getData: Retrieve data of TuringMarket
  var getData = function () {
    return data;
  };

  return { addEventListener : addEventListener, load : load,
           verify : verify, getData : getData };
}

// ------------------------------- UI-Tools -------------------------------

var readFoswikiText = function (text) {
  var normalizeFoswikiText = function (v) {
    v = v.trim();
    v = v.replace(/(\s|^)\*(\S.*?\S|\S)\*(\s|$)/, "$1$2$3");
    v = v.replace(/(\s|^)__(\S.*?\S|\S)__(\s|$)/, "$1$2$3");
    v = v.replace(/(\s|^)_(\S.*?\S|\S)_(\s|$)/, "$1$2$3");
    v = v.replace(/(\s|^)==(\S.*?\S|\S)==(\s|$)/, "$1$2$3");
    v = v.replace(/(\s|^)=(\S.*?\S|\S)=(\s|$)/, "$1$2$3");
    v = v.replace(/<(\w|\/)[^>]*?>/, "");
    return v.trim();
  };

  var readDefinitionLine = function (line, lineno) {
    var m = line.match(/( +)\$ ([^:]+?): (.*)/);
    if (m === null)
      return null;
    if (m[1].length !== 3)
      throw new InvalidFoswikiException("Foswiki definition list items "
        + "must start with exactly 3 spaces! Error on line " + lineno);
    // returns [key, value]
    return [m[2], m[3]].map(normalizeFoswikiText);
  };

  var readTableHeaderLine = function (line) {
    var tabs = line.split("|");
    if (tabs.length <= 3)
      return null;
    if (tabs[0].trim() !== "")
      throw new InvalidFoswikiException("Table header line must start with |");
    if (tabs[tabs.length - 1].trim() !== "")
      throw new InvalidFoswikiException("Table header line must end with |");
    // returns cells which denote the tape values
    return tabs.slice(2, -1).map(normalizeFoswikiText);
  };

  var readTableValueLine = function (line) {
    var tabs = line.split("|");
    if (tabs.length <= 3)
      return null;
    if (tabs[0].trim() !== "")
      throw new InvalidFoswikiException("Transition line must start with |");
    if (tabs[tabs.length - 1].trim() !== "")
      throw new InvalidFoswikiException("Transition line must end with |");

    tabs = tabs.slice(1, -1).map(function (v) { return v.trim(); });
    var cols = [normalizeFoswikiText(tabs[0])];  // state
    var elems = tabs.slice(1).map(function (v) {
      if (v.trim() === "" || v.trim() === "..." || v.trim() === "…")
        return "";
      var vals = v.split(" - ");
      if (vals.length !== 3)
        throw new InvalidFoswikiException("Transition cell must contain "
          + "3 values but '" + v + "' is given");
      vals = vals.map(normalizeFoswikiText);
      vals[0] = normalizeSymbol(vals[0]);
      vals[1] = normalizeMovement(vals[1]);
      return vals;
    });
    for (var e in elems) {
      cols.push(elems[e]);
    }
    return cols;
  };

  if (typeof text !== 'string' || text.trim().length === 0)
    throw new InvalidFoswikiException("Cannot import empty Foswiki text");

  var program = new Program();
  var initial_state = "";
  var final_states = [];
  var tape = [];
  var name = "";
  var cursor = Infinity;
  var columns = [];

  var lines = text.split("\n");
  var mode = 'definition';
  var header_read = false;
  for (var l = 0; l < lines.length; l++) {
    var line = lines[l];
    if (line.match(/^\s*$/))
      continue;

    // mode transition
    if (line.trim()[0] === '|')
      if (header_read)
        mode = 'value';
      else {
        mode = 'header';
        header_read = true;
      }
    else
      mode = 'definition';

    // mode dispatching
    if (mode === 'definition') {
      var def = readDefinitionLine(line, l);
      if (def === null)
        throw new InvalidFoswikiException("Expected definition line, "
          + "but got: " + line);

      if (def[0].match(/name/i))
        name = normalizeFoswikiText(def[1]);
      else if (def[0].match(/final state/i))
        def[1].split(",").map(normalizeFoswikiText)
          .filter(function (v) { return Boolean(v); })
          .map(function (st) { final_states.push(st); return st; });
      else if (def[0].match(/state/i))
        initial_state = normalizeFoswikiText(def[1]);
      else if (def[0].match(/tape/i))
        tape = def[1].split(",").map(normalizeFoswikiText)
          .filter(function (v) { return Boolean(v); });
      else if (def[0].match(/cursor/i)) {
        cursor = parseInt(def[1]);
        if (isNaN(cursor))
          throw new InvalidFoswikiException("Cursor must be integer "
            + "(line " + l + ")");
      }

    } else if (mode === 'header') {
      var head = readTableHeaderLine(line);
      if (head === null)
        throw new InvalidFoswikiException("Expected transition table "
          + "header line, but got: " + line);
      columns = head.slice();

    } else if (mode === 'value') {
      var vals = readTableValueLine(line);
      if (vals === null)
        throw new InvalidFoswikiException("Expected transition line, "
          + "but got: " + line);

      if (vals.length !== columns.length + 1)
        throw new InvalidFoswikiException("Inconsistent number of columns "
          + "in Foswiki table. Recognized " + (columns.length + 1) + " "
          + "header columns, but got " + vals.length + " on line " + l + ".");

      var from_state;
      for (var colid = 0; colid < vals.length; colid++) {
        var val = vals[colid];
        if (colid === 0) {
          if (val.trim() === '')
            from_state = ' ';
          else
            from_state = val;
        } else if (val) {
          program.set(columns[colid - 1], state(from_state),
            val[0], movement(val[1]), state(val[2]));
        }
      }
    }
  }

  if (columns.length === 0)
    throw new InvalidFoswikiException("No definition list found");
  if (tape.length === 0)
    throw new InvalidFoswikiException("No tape definition found");
  if (!initial_state)
    initial_state = "Start";
  if (final_states.length === 0)
    final_states.push("End");
  if (name === "")
    name = UI['getRandomMachineName']();
  if (cursor === Infinity)
    cursor = -1;

  tape = { 'data': tape, 'cursor': cursor };

  return {
    program : program.toJSON(),
    state_history : [initial_state],
    tape : tape,
    final_states : final_states,
    initial_state : initial_state,
    initial_tape : deepCopy(tape),
    name : name,
    step : 0
  };
};

var toFoswikiText = function (tm) {
  var justify = function (text, size) {
    size = def(size, 25);
    if (typeof text === 'undefined')
      return repeat(" ", size);
    var chars = size - text.toString().length;
    if (chars < 0)
      chars = 0;
    return text.toString() + repeat(" ", chars);
  };

  var text = '';
  var defi = function (a, b) { return "   $ __" + a + "__: " + b + "\n"; };
  var data = tm.toJSON();
  var current_state = data['state_history'][data['state_history'].length - 1];

  // metadata header
  text += defi('Name', data['name']);
  text += defi('State', current_state);
  text += defi('Final states', data['final_states'].join(", "));
  text += defi('Cursor', tm.getTape().size() - 1);
  text += defi('Tape', tm.getTape().read(undefined, tm.getTape().size() * 2));

  // retrieve possible symbols and states to start with
  var from_symbols = tm.getProgram().getFromSymbols();
  var from_states = tm.getProgram().getFromStates();

  var j = function (v) { return justify(v); };
  text += "\n| " + j("") + " | " + from_symbols.map(j).join(" | ") + " |\n";

  for (var j = 0; j < from_states.length; j++) {
    var from_state = from_states[j];
    var cols = [];

    for (var i = 0; i < from_symbols.length; i++) {
      var from_symb = from_symbols[i];
      var instr = tm.getProgram().get(from_symb, state(from_state));

      if (!instr)
        cols.push(justify(""));
      else
        cols.push(justify(instr.toJSON().join(" - ")));
    }

    text += "| " + justify(from_state) + " | " + cols.join(" | ") + " |\n";
  }

  return text;
};

var UI = {
  // @function import: Import machine in JSON from textarea
  import : function (ui_notes, ui_meta, ui_tm, ui_data, tm, text, format) {
    // read data
    var data;
    try {
      if (format === "json")
        data = JSON.parse(text);
      else
        data = readFoswikiText(text);
      if (!data)
        throw new Error("Empty data");
      UI['alertNote'](ui_notes, "Input data parsed. Continue with import.");
    } catch (e) {
      UI['alertNote'](ui_notes, "Failed to parse given input. Import aborted.");
      if (format === "json" && text.substr(0, 7) === "   $ __")
        UI['alertNote'](ui_notes, "Seems to be Foswiki syntax. Please select Foswiki.");
      if (format === "foswiki" && text.substr(0, 2) === '{"')
        UI['alertNote'](ui_notes, "Seems to be JSON syntax. Please select JSON.");
      console.debug(e);
      return;
    }

    // try to import it
    try {
      tm.fromJSON(data);
      UI['alertNote'](ui_notes, "Import of " + format + " succeeded.");
    } catch (e) {
      UI['alertNote'](ui_notes, "Import failed. Seems like invalid data was provided.");
      console.debug(e);
      return;
    }

    this.loadTMState(ui_notes, ui_meta, ui_tm, ui_data, tm, false);
  },

  // @function export: Export machine in JSON to textarea
  export : function (tm, format) {
    var text;
    if (format === "json") {
      text = JSON.stringify(tm.toJSON());
    } else {
      text = toFoswikiText(tm);
    }
    $("#overlay_text .data").val("" + text);
  },

  // @function interrupt: Interrupt computation of turingmachine
  interrupt : function (ui_tm, tm, only_hide_ui_element) {
    only_hide_ui_element = def(only_hide_ui_element, false);
    ui_tm.find('.controls .interrupt').hide();
    if (!only_hide_ui_element)
      return tm.interrupt();
  },

  // @function run: User clicked "Run"
  run : function (ui_tm, tm) {
    var result = tm.run();
    if (result !== false)
      ui_tm.find('.controls .interrupt').show();
    return result;
  },

  // @function loadTMState
  loadTMState : function (ui_notes, ui_meta, ui_tm, ui_data, tm, notify) {
    notify = def(notify, true);

    // update UI elements
    // - machine name
    this.setMachineName(ui_meta, tm.getMachineName());

    // - tape values
    var vals = tm.getCurrentTapeValues();
    this.writeTapeValues(ui_tm, vals);
    this.setTapeContent(ui_data, vals, parseInt((vals.length - 1) / 2));

    // - final states
    this.setFinalStates(ui_data, tm.getFinalStates());

    // - state
    this.updateState(ui_tm, tm.getState(), tm.finalStateReached(),
      tm.undefinedInstruction());

    // - transition table
    this.writeTransitionTable(ui_data, tm.toJSON()['program']);

    if (notify)
      UI['alertNote'](ui_notes, "TM state loaded!");
  },

  // @function updateTapeToolTip: set tape tool tip information
  updateTapeToolTip : function (ui_tm, values, cursor) {
    cursor = def(cursor, parseInt(values.length / 2));
    values[cursor] = "*" + values[cursor] + "*";

    values = values.map(function (v) { return "" + v; });
    ui_tm.find(".tape").attr("title", values.join(","));
  },

  // @function updateState: set state to a new value
  updateState : function (ui_tm, new_state, is_final, is_undefined) {
    is_final = def(is_final, false);
    var text = "" + new_state;
    var new_size = parseInt((-4.0 / 11) * text.length + 22);
    if (new_size < 12)
      new_size = 12;
    else if (new_size > 20)
      new_size = 20;
    ui_tm.find(".state").text(new_state);
    ui_tm.find(".state").css("font-size", new_size + "px");
    if (is_final) {
      ui_tm.find(".state").addClass("final");
      ui_tm.find(".state").attr("title", "Final state reached");
    } else {
      ui_tm.find(".state").removeClass("final");
      ui_tm.find(".state").attr("title", "");
    }
    if (!is_final && is_undefined) {
      ui_tm.find(".state").addClass("undefined");
      ui_tm.find(".state").attr("title", "No instruction found!");
    } else {
      ui_tm.find(".state").removeClass("undefined");
      ui_tm.find(".state").attr("title", "");
    }
  },

  // @function writeTapeValues
  writeTapeValues : function (ui_tm, vals) {
    var values = ui_tm.find(".value");
    var i = 0;
    require(vals.length === values.length);
    values.each(function () {
      $(this).text(vals[i++]);
    });
  },

  // @function getSelectedProgram
  getSelectedProgram : function (ui_meta) {
    return $(ui_meta).find(".example").val();
  },

  // @function clearPrograms
  clearPrograms : function (ui_meta) {
    $(ui_meta).find(".example option").remove();
  },

  // @function addProgram
  addProgram : function (ui_meta, program) {
    var option = $("<option></option>").text(program);
    $(ui_meta).find(".example option").each(function () {
      if ($(this).text() > program) {
        $(this).after(option);
        return;
      }
    });
    $(ui_meta).find(".example option").append(option);
  },

  // @function removeProgram
  removePrograms : function (ui_meta, program) {
    $(ui_meta).find(".example option").each(function () {
      if ($(this).val() === program)
        $(this).remove();
    });
  },

  // @function getSelectedTestcase
  getSelectedTestcase : function (ui_meta) {
    return $(ui_meta).find(".testcase").val();
  },

  // @function clearTestcases
  clearTestcases : function (ui_meta) {
    $(ui_meta).find(".testcase option").remove();
  },

  // @function addTestcase
  addTestcase : function (ui_meta, tc) {
    $(ui_meta).find(".testcase").append($("<option></option>").text(tc));
  },

  // @function getMachineName
  getMachineName : function (ui_meta) {
    return $(ui_meta).find(".machine_name").val();
  },

  // @function setMachineName
  setMachineName : function (ui_meta, name) {
    $(ui_meta).find(".machine_name").val(name);
  },

  // @function getTapeContent
  getTapeContent : function (ui_data) {
    return $(ui_data).find(".tape").val();
  },

  // @function setTapeContent
  setTapeContent : function (ui_data, tape, cursor) {
    if (typeof tape !== 'string')  // array to string
      tape = tape.map(function (v) { return v.toString(); });
    if (typeof cursor !== 'undefined')
      tape[parseInt(cursor)] = "*" + tape[parseInt(cursor)] + "*";

    $(ui_data).find(".tape").val(tape.join(", "));
  },

  // @function getFinalStates
  getFinalStates : function (ui_data) {
    var text = $(ui_data).find(".final_states").val();
    return text.split(/\s*,\s*/).map(function (s) { return state(s); });
  },

  // @function setFinalStates
  setFinalStates : function (ui_data, final_states) {
    var fs = final_states.map(function (v) {
      return v.isState ? v.toString() : v;
    });
    $(ui_data).find(".final_states").val(fs.join(", "));
  },

  // @function readTransitionTable: read transition table from DOM to JS object
  readTransitionTable : function (ui_data) {
    var prg = [];
    ui_data.find(".transition_table tbody tr").each(function () {
      var from_symbol = $(this).find("td:eq(0) input").val();
      var from_state = $(this).find("td:eq(1) input").val();
      var write_symbol = $(this).find("td:eq(2) input").val();
      var move = $(this).find("td:eq(3) select").val();
      var to_state = $(this).find("td:eq(4) input").val();

      var already_exists = function (v, s) {
        for (var i in prg) {
          if (prg[i][0] === v && prg[i][1] === s)
            return true;
        }
        return false;
      };

      if (already_exists(from_symbol, from_state)) {
        $(this).addClass('nondeterministic');
        $(this).removeClass('deterministic');
        $(this).attr("title", "this line is non-deterministic "
          + "(2 left-most values occur multiple times)")
      } else {
        $(this).addClass('deterministic');
        $(this).removeClass('nondeterministic');
        $(this).attr("title", "")

        prg.push([from_symbol, from_state, [write_symbol, move, to_state]]);
      }
    });

    if (UI['isLastTransitionTableRowEmpty'](ui_data))
      prg.pop();

    return prg;
  },

  // @function writeTransitionTable: write transition table to DOM
  writeTransitionTable : function (ui_data, table) {
    var clearRows = function () {
      ui_data.find(".transition_table tbody tr").slice(1).remove();
      ui_data.find(".transition_table tbody td").each(function () {
        if ($(this).find("input").length > 0)
          $(this).find("input").val("");
      });
    };

    clearRows();
    for (var i in table) {
      var from_symbol = table[i][0];
      var from_state = table[i][1];
      var elements = [from_symbol, from_state,
          table[i][2][0], table[i][2][1], table[i][2][2]];
      UI['writeLastTransitionTableRow'](ui_data, elements);
      UI['addTransitionTableRow'](ui_data);
      UI['writeLastTransitionTableRow'](ui_data);
    }
  },

  // @function writeLastTransitionTableRow: write elements to last row
  writeLastTransitionTableRow : function (ui_data, elements) {
    if (typeof elements === 'undefined')
      elements = new Array(5);

    var row = ui_data.find(".transition_table tbody tr").last();
    row.find("td:eq(0) input").val(elements[0] || "");
    row.find("td:eq(1) input").val(elements[1] || "");
    row.find("td:eq(2) input").val(elements[2] || "");
    row.find("td:eq(3) select").val(elements[3] || "Stop");
    row.find("td:eq(4) input").val(elements[4] || "");
  },

  // @function readLastTransitionTableRow: read elements of last row
  readLastTransitionTableRow : function (ui_data, last_with_content) {
    last_with_content = def(last_with_content, false);
    var all_rows = ui_data.find(".transition_table tbody tr");
    var row;
    if (last_with_content) {
      var i = all_rows.length - 1;
      while ($(all_rows[i]).find("td:eq(1) input").val() === "" && i > 0)
        i -= 1;
      row = $(all_rows[i]);
    } else {
      row = all_rows.last();
    }

    return [row.find("td:eq(0) input").val(),
            row.find("td:eq(1) input").val(),
            row.find("td:eq(2) input").val(),
            row.find("td:eq(3) select").val(),
            row.find("td:eq(4) input").val()];
  },

  // @function isLastTransitionTableRowEmpty: is the last row empty?
  isLastTransitionTableRowEmpty : function (ui_data) {
    var last_row = UI['readLastTransitionTableRow'](ui_data);
    return last_row[0] === '' && last_row[1] === '' &&
           last_row[2] === '' && last_row[3] === 'Stop' &&
           last_row[4] === '';
  },

  // @function addTransitionTableRow: add one empty row to table
  addTransitionTableRow : function (ui_data) {
    // assumption. last row is always empty
    var row = ui_data.find(".transition_table tbody tr").last();
    var clone = row.clone();
    clone.removeClass("nondeterministic").removeClass("deterministic");

    ui_data.find(".transition_table tbody").append(clone);
  },

  // @function alertNote: write note to the UI as user notification
  alertNote : function (ui_notes, note_text) {
    note_text = "" + note_text;
    var removeNote = function (id) {
      if (ui_notes.find(".note").length === 1)
        ui_notes.fadeOut(1000);
      $("#" + id).fadeOut(1000);
      $("#" + id).remove();
    };

    var hash_id = 0;
    for (var index in note_text)
      hash_id += index * note_text.charCodeAt(index);
    hash_id %= 12365478;
    hash_id = 'note' + hash_id.toString();

    ui_notes.show();
    ui_notes.append($('<p></p>').addClass("note")
      .attr("id", hash_id).text(note_text)
    );

    setTimeout(function () { removeNote(hash_id); }, 5000);
  },

  // @function createDescription: Create a new description box
  createDescription : function (title, lst) {
    var markup = function (t) {
      var v = $("<div></div>").text(t).html();
      v = v.replace(/(\W)\*((\w|\s)+)?\*(\W)/g, "$1<em>$2</em>$4");
      v = v.replace(/\((.*?)\)\[([^\]]+)\]/g, "<a href='$2'>$1</a>");
      return v;
    };

    var text = $("<div></div>").addClass("description_text");
    lst = lst.map(function (v) { return $("<p></p>").html(markup(v)); })
    $.each(lst, function (_, p) { text.append(p); });

    var element = $("<div></div>").addClass("description");
    element.append($("<h3></h3>").addClass("description_title").text(title));
    element.append(text);

    return element;
  },

  getRandomMachineName : function () {
    var names = ['Dolores', 'Aileen', 'Margarette', 'Donn', 'Alyce', 'Buck',
      'Walter', 'Malik', 'Chantelle', 'Ronni', 'Will', 'Julian', 'Cesar',
      'Hyun', 'Porter', 'Herta', 'Kenyatta', 'Tajuana', 'Marvel', 'Sadye',
      'Terresa', 'Kathryne', 'Madelene', 'Nicole', 'Quintin', 'Joline',
      'Brady', 'Luciano', 'Turing', 'Marylouise', 'Sharita', 'Mora',
      'Georgene', 'Madalene', 'Iluminada', 'Blaine', 'Louann', 'Krissy',
      'Leeanna', 'Mireya', 'Refugio', 'Glenn', 'Heather', 'Destiny',
      'Billy', 'Shanika', 'Franklin', 'Shaunte', 'Dirk', 'Elba'];
    return names[parseInt(Math.random() * (names.length))] + ' ' +
      new Date().toISOString().slice(0, 10);
  },

  loadTestcaseToUI : function (testcase, tm, ui_tm, ui_data) {
    if (typeof testcase['final_states'] !== 'undefined') {
      ui_data.find('.final_states').val(testcase['final_states'].join(", "));
      tm.setFinalStates(testcase['final_states']
        .map(function (v) { return state(v); }));
    }
    ui_tm.find('.state').text(testcase['input']['state']);
    tm.setState(state(testcase['input']['state']));

    // TODO: testcase['input']['tape']
  }
};

// ----------------------------- Main routine -----------------------------

function main()
{
  // initialize application
  var ui_tm = $(".turingmachine:eq(0)");
  var ui_meta = $(".turingmachine_meta:eq(0)");
  var ui_data = $(".turingmachine_data:eq(0)");
  var ui_notes = $("#notes");

  require(ui_tm.length > 0 && ui_meta.length > 0);
  require(ui_data.length > 0 && ui_notes.length > 0);

  var program = new Program();
  var tape = new UserFriendlyTape('0', Infinity);
  var final_states = [state('End')];
  var initial_state = state('Start');

  var tm = new AnimatedTuringMachine(program, tape, final_states,
    initial_state, undefined, ui_tm);

  function update_anistate() {
    var input = $(ui_tm).find("input[name='wo_animation']");
    var is_disabled = Boolean(input.is(":checked"));
    if (is_disabled)
      tm.disableAnimation();
    else
      tm.enableAnimation();
  }

  tm.addEventListener('initialized', function (name) {
    update_anistate();
  });
  tm.addEventListener('possiblyInfinite', function (steps) {
    var ret = confirm("I have run " + steps +
      " iterations without reaching a final state. " +
      "Do you still want to continue?");
    return Boolean(ret);
  });
  tm.addEventListener('undefinedInstruction', function (read, st) {
    UI['alertNote'](ui_notes, 'Undefined instruction for symbol ' + read + ' and state ' + st);
  });
  tm.addEventListener('finalStateReached', function (state) {
    UI['alertNote'](ui_notes, 'Final state ' + state + ' reached :) Yay!');
  });
  tm.addEventListener('valueWritten', function (old_value, new_value) {
  });
  tm.addEventListener('movementFinished', function (move) {
  });
  tm.addEventListener('stateUpdated', function (old_state, new_state) {
    UI['updateState'](ui_tm, new_state, tm.finalStateReached(),
      tm.undefinedInstruction());
  });
  tm.addEventListener('stepFinished', function (vals, move, st, fv, fs) {
    UI['updateState'](ui_tm, st, tm.finalStateReached(),
      tm.undefinedInstruction());
  });
  tm.addEventListener('speedUpdated', function (speed) {
  });
  tm.addEventListener('runFinished', function () {
    UI['interrupt'](ui_tm, tm, true);
  });

  // controls
  function next() {
    var how_many_steps = parseInt(ui_tm.find(".steps_next").val());
    if (isNaN(how_many_steps)) {
      UI['alertNote'](ui_notes, "Invalid steps given. Assuming 1.");
      how_many_steps = 1;
    }
    tm.next(how_many_steps);
    UI['interrupt'](ui_tm, tm, true);
  }
  function prev() {
    /*var how_many_steps = parseInt(ui_tm.find(".steps_prev").val());
    if (isNaN(how_many_steps)) {
      UI['alertNote'](ui_notes, "Invalid steps given. Assuming 1.");
      how_many_steps = 1;
    }
    tm.prev(how_many_steps);*/
    UI['alertNote'](ui_notes, "Sorry, that feature is not yet available");
    UI['interrupt'](ui_tm, tm, true);
  }
  function slower() {
    tm.speedDown();
  }
  function faster() {
    tm.speedUp();
  }
  function reset() {
    tm.reset();
    UI['loadTMState'](ui_notes, ui_meta, ui_tm, ui_data, tm, true);
    UI['interrupt'](ui_tm, tm, true);
  }
  function run() {
    if (!UI['run'](ui_tm, tm))
      UI['alertNote'](ui_notes, "Could not start run of turingmachine. Is it running already?");
  }
  function interrupt() {
    if (!UI['interrupt'](ui_tm, tm))
      UI['alertNote'](ui_notes, "Could not interrupt. It is not running.");
  }

  $(".turingmachine .control_prev").click(prev);
  $(".turingmachine .control_next").click(next);
  $(".turingmachine .control_reset").click(reset);
  $(".turingmachine .control_run").click(run);
  $(".turingmachine .control_slower").click(slower);
  $(".turingmachine .control_faster").click(faster);
  $(".turingmachine .control_interrupt").click(interrupt);
  $(".turingmachine input[name=wo_animation]").change(update_anistate);

  $(".turingmachine .testcase_run").click(function () {
    UI['alertNote'](ui_notes, "That feature is not yet available");
  });
  $(".turingmachine .testcase_runall").click(function () {
    UI['alertNote'](ui_notes, "That feature is not yet available");
  });

  // overlay
  function toggle_overlay() {
    if (!$("#overlay").is(':visible')) {
      $("#overlay").show(100);
      $("#overlay_text").delay(150).show(400);
    } else {
      $("#overlay").delay(200).hide(100);
      $("#overlay_text").hide(200);
    }
  }
  $("#overlay").click(toggle_overlay);

  // update machine name
  $(".machine_name").change(function () {
    var new_name = UI['getMachineName'](ui_meta);
    tm.setMachineName(new_name);

    UI['alertNote'](ui_notes, "Machine name updated!");
  });

  // update tape content
  $(".tape").change(function () {
    var string = $(this).parent().find(".tape").val();
    tm.getTape().fromHumanString(string);
    var vals = tm.getCurrentTapeValues();

    var i = 0;
    $(".turingmachine .value").each(function () {
      $(this).text(vals[i++]);
    });

    UI['alertNote'](ui_notes, "Tape updated!");
  });

  // update final states
  $(".final_states").change(function () {
    var final_states = UI['getFinalStates'](ui_data);
    tm.setFinalStates(final_states);
    var out = final_states.map(function (v) { return v.toString(); });
    if (out.length > 1)
      UI['alertNote'](ui_notes, "Final states set:\n" + out.slice(0, -1)
        + " and " + out[out.length - 1] + "");
    else
      UI['alertNote'](ui_notes, "Final state " + out[0] + " set.");
  });

  // import
  $(".turingmachine .import_button").click(function () {
    toggle_overlay();

    $("#overlay_text .action").text("Import");
    $("#overlay_text .data").attr("readonly", false).val("");
    $("#overlay_text .import").show();
  });
  $("#overlay_text .import").click(function () {
    var data = $("#overlay_text .data").val();
    var format = $("#overlay_text .export_format").val();
    UI['import'](ui_notes, ui_meta, ui_tm, ui_data, tm, data, format);
  });

  // export
  $(".turingmachine .export_button").click(function () {
    toggle_overlay();

    $("#overlay_text .action").text("Export");
    $("#overlay_text .data").attr("readonly", true);
    $("#overlay_text .import").hide();

    UI['export'](tm, $("#overlay_text").find(".export_format").val());
  });
  $("#overlay_text .export_format").change(function () {
    var is_export = $("#overlay_text .action").text().indexOf("Export") !== -1;
    if (is_export)
      UI['export'](tm, $("#overlay_text").find(".export_format").val());
  });

  $(".transition_table").change(function () {
    var table = UI['readTransitionTable'](ui_data);
    tm.getProgram().fromJSON(table);

    var last_row_empty = true;
    var last_row = UI['readLastTransitionTableRow'](ui_data);
    var last_row_empty = UI['isLastTransitionTableRowEmpty'](ui_data);

    if (!last_row_empty) {
      UI['addTransitionTableRow'](ui_data);
      UI['writeLastTransitionTableRow'](ui_data);
    }

    UI['alertNote'](ui_notes, "Transition table updated!");
  });

  $(".turingmachine_data .copy_last_line").click(function () {
    var last_row = UI['readLastTransitionTableRow'](ui_data, true);
    UI['writeLastTransitionTableRow'](ui_data, last_row);
    $(".transition_table").change();
  });

  $(document).on("change", ".transition_table .tt_from", function () {
    var from_state = $(this).val();
    if (tm.isAFinalState(state(from_state)))
      UI['alertNote'](ui_notes, "Transition from final state "
        + "will never be executed.");
  });

  // Turing's markets
  var manager = new MarketManager(tm, ui_notes, ui_meta, ui_data);

  manager.addEventListener('marketActivated', function (market_id) {
    console.info("Market " + market_id + " activated. " +
                 "I initialized the machine :)");

    ui_meta.find(".machine_name").val(tm.getMachineName());
    ui_data.find(".final_states").val(tm.getFinalStates()
      .map(function (v) { return v.toString(); }).join(", "));

    var values = tm.getCurrentTapeValues().slice();
    var mid = parseInt(values.length / 2);
    UI['setTapeContent'](ui_data, values, mid);

    UI['writeTransitionTable'](ui_data, tm.getProgram().toJSON());

    tm.initialize();
  });

  manager.initialize();
  return tm;
}
