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

// iterations before possiblyInfinite event is thrown, immutable const
generic_check_inf_loop = 1000;

// generic Turing markets
generic_markets = ["intro", "palindrome"];

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

  if (navigator.userAgent.search("Firefox") >= 0)
    console.trace();
  else
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

  if (navigator.userAgent.search("Firefox") >= 0)
    console.trace();
  else
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

  if (navigator.userAgent.search("Firefox") >= 0)
    console.trace();
  else
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

  if (navigator.userAgent.search("Firefox") >= 0)
    console.trace();
  else
    Object.defineProperty(this, 'stack',
      { get: function() { return interm.stack; } }
    );

  return this;
}

// @exception thrown, if invalid foswiki content is given
function InvalidFoswikiException(msg)
{
  var err = {
    name : "Foswiki error",
    message : msg,
    toString : function () { return this.name + ": " + this.message }
  };
  var interm = Error.apply(this, inherit(arguments, err));
  interm.name = this.name = err.name;
  this.message = interm.message = err.message;

  if (navigator.userAgent.search("Firefox") >= 0)
    console.trace();
  else
    Object.defineProperty(this, 'stack',
      { get: function() { return interm.stack; } }
    );

  return this;
}

// @exception thrown, if invalid JSON data is given
function InvalidJSONException(msg)
{
  var err = {
    name : "JSON error",
    message : msg,
    toString : function () { return this.name + ": " + this.message }
  };
  var interm = Error.apply(this, inherit(arguments, err));
  interm.name = this.name = err.name;
  this.message = interm.message = err.message;

  if (navigator.userAgent.search("Firefox") >= 0)
    console.trace();
  else
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

  // @method Program.fromUserJSON: Import a program from JSON
  var fromUserJSON = function (data) {
    if (typeof data === "string")
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new InvalidJSONException("Cannot import invalid JSON as program!");
      }

    clear();

    for (var read_symbol in data)
      for (var from_state in data[read_symbol]) {
        var d = data[read_symbol][from_state];
        var i = new InstrTuple(d[0], movement(d[1]), state(d[2]));
        _safeSet(read_symbol, state(from_state), i, true);
      }
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

    for (var key1 in data) {
      program[key1] = {};
      for (var key2 in data[key1])
      {
        var write_symbol = data[key1][key2][0];
        var movement = new Movement(data[key1][key2][1]);
        var to_state = state(data[key1][key2][2]);

        program[key1][key2] = instrtuple(write_symbol, movement, to_state);
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
    fromUserJSON : fromUserJSON,
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
    // TODO: redesign, do not require *star*
    // one position per symbol, *symbol* denotes the cursor position
    var cur = str.indexOf("*") + 1;
    if (str[cur + 1] !== "*" || str.indexOf("*", cur + 2) !== -1) {
      throw new AssertionException("Invalid human-readable string provided");
    }

    default_value = normalizeSymbol(generic_default_value);
    offset = def(data['offset'], cur - 1);

    tape = [];
    for (var i = 0; i < str.length; i++) {
      if (i !== cur - 1 && i !== cur + 1)
        tape.push(str[i]);
    }
  };

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
    var data = simple_tape.toJSON();

    export_history = def(export_history, true);
    if (!export_history)
      return data;

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
    while (goto.index < rec_tape.cursor().index)
      rec_tape.left();
    while (goto.index > rec_tape.cursor().index)
      rec_tape.right();
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

  // @member Machine.final_state_reached
  var final_state_reached = false;

  // @member Machine.undefined_instruction
  var undefined_instruction = false;

  // @member Machine.name
  var name = 'machine ' + parseInt(Math.random() * 10000);

  // @member Machine.step_id
  var step_id = 0;

  // @member Machine.valid_events
  // @member Machine.events
  // @callback initialized(machine name)
  // @callback possiblyInfinite(steps executed)
  //    If one callback returns false, execution is aborted
  // @callback undefinedInstruction(read symbol, state)
  // @callback finalStateReached(state)
  // @callback valueWritten(old value, new value)
  // @callback movementFinished(movement)
  // @callback stateUpdated(old state, new state)
  var valid_events = ['initialized', 'possiblyInfinite',
    'undefinedInstruction', 'finalStateReached', 'valueWritten',
    'movementFinished', 'stateUpdated'];
  var events = { };

  // @method Machine.addEventListener: event listener definition
  var addEventListener = function (evt, callback) {
    if ($.inArray(evt, valid_events) !== -1) {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push(callback);
    } else {
      require(false, "Unknown event " + evt);
    }
  };

  // @method Machine.triggerEvent: trigger event
  var triggerEvent = function (evt, clbk) {
    var args = Array.slice(arguments, 2);
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
    final_state_reached = false;
    undefined_instruction = false;
    program = p;
  };

  // @method Machine.getTape: Getter for Tape instance
  // @method Machine.setTape: Setter for Tape instance
  var getTape = function () { return tape; };
  var setTape = function(t) {
    final_state_reached = false;
    undefined_instruction = false;
    tape = t;
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
    final_state_reached = false;
    undefined_instruction = false;
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
  var setState = function (state) {
    final_state_reached = false;
    undefined_instruction = false;

    if (isState(st))
      state_history.push(st);
    else
      state_history.push(state(st));
  };

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
    final_state_reached = false;
    undefined_instruction = false;

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
    undefined_instruction = false;
    final_state_reached = false;
    step_id = 0;
  };

  // @method Machine.replaceProgramFromJSON: Replace program using JSON data
  var replaceProgramFromJSON = function (json) {
    program.fromJSON(json);
    undefined_instruction = false;
    final_state_reached = false;
    step_id = 0;
  };

  // @method Machine.finalStateReached: Has a final state been reached?
  var finalStateReached = function () {
    return final_state_reached;
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
  };

  // @method Machine.prev: Undo last `steps` operation(s)
  var prev = function (steps) {
    var steps = def(steps, 1);

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

    state_history.pop();
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

    // run `steps` operations
    for (var i = 0; i < steps; i++)
    {
      var read_symbol = tape.read();
      var instr = program.get(read_symbol, getState());

      if (typeof instr !== 'undefined')
      {
        // write
        var old_value = tape.read();
        tape.write(instr.write);

        // move
        tape.move(instr.move);

        // set state
        var old_state = getState();
        var new_state = state(instr.state);
        state_history.push(new_state);

        // trigger events
        triggerEvent('valueWritten', null, old_value, instr.write);
        triggerEvent('movementFinished', null, instr.move);
        triggerEvent('stateUpdated', null, old_state, new_state.toString());

        console.log("Transitioning from '" + read_symbol.toString() + "' in "
          + old_state.toString() + " by moving to " + instr.move.toString()
          + " writing '" + instr.write + "' going into "
          + new_state.toString());

        for (var fs in final_states) {
          if (final_states[fs].equals(new_state)) {
            final_state_reached = true;
            triggerEvent('finalStateReached', null, new_state.toString());
            return false;
          }
        }
      } else {
        var fixed = false;
        triggerEvent('undefinedInstruction',
          function (result) {
            if (typeof result !== 'undefined') {
              program.set(read_symbol, getState(), result);
              fixed = true;
            }
          }, read_symbol, getState().toString()
        );

        if (!fixed) {
          undefined_instruction = true;
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
  //   returns true if final state reached, else false
  var run = function () {
    while (!finished())
      if (!next(1))
        break;

    return final_state_reached;
  };

  // @method Machine.reset: Reset machine to initial state
  var reset = function () {
    tape.clear();
    tape.fromJSON(initial_tape);
    state_history = [getInitialState()];
    final_state_reached = false;
    undefined_instruction = false;
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
      initial_tape = tape.fromJSON(data['initial_tape']);
    if (typeof data['inf_loop_check'] !== 'undefined')
      if (data['inf_loop_check'] === null)
        inf_loop_check = Infinity;
      else
        inf_loop_check = parseInt(data['inf_loop_check']);
    if (typeof data['state_history'] !== 'undefined')
      state_history = data['state_history'].map(convState);
    if (typeof data['final_state_reached'] !== 'undefined')
      final_state_reached = Boolean(data['final_state_reached']);
    if (typeof data['undefined_instruction'] !== 'undefined')
      undefined_instruction = Boolean(data['undefined_instruction']);
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
      final_state_reached : final_state_reached,
      undefined_instruction : undefined_instruction,
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
    getFinalStates : getFinalStates,
    addFinalState : addFinalState,
    setFinalStates : setFinalStates,
    getState : getState,
    setState : setState,
    setInfinityLoopCount : setInfinityLoopCount,
    getCursor : getCursor,
    setCursor : setCursor,
    getStep : getStep,
    getMachineName : getMachineName,
    setMachineName : setMachineName,
    getCursor : getCursor,
    replaceTapeFromJSON : replaceTapeFromJSON,
    replaceProgramFromJSON : replaceProgramFromJSON,
    finalStateReached : finalStateReached,
    undefinedInstructionOccured : undefinedInstructionOccured,
    finished : finished,
    prev : prev,
    next : next,
    run : run,
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
  // @member AnimatedTuringMachine.toggle: Disable/enable animation
  var toggle = true;

  // @member AnimatedTuringMachine.events
  // @member AnimatedTuringMachine.handled_events
  // @callback movementFinished(visible values,
  //    new focused value, Movement object)
  // @callback initialized(machine name, visible values)
  // @callback speedUpdated(speed in microseconds)
  var events = {};
  var handled_events = ['initialized', 'movementFinished', 'speedUpdated'];

  // @member AnimatedTuringMachine.gear_queue: Gear queue handling instance
  var gear_queue = new CountingQueue();
  // @member AnimatedTuringMachine.gear: Gear of animation
  var gear = new GearVisualization(gear_queue);

  // @method AnimatedTuringMachine.addEventListener: add event listener
  var addEventListener = function (evt, callback) {
    if ($.inArray(evt, handled_events) === -1) {
      machine.addEventListener(evt, callback);
    } else {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push(callback);
    }
  };

  // @method AnimatedTuringMachine.triggerEvent: trigger event
  var triggerEvent = function (evt, clbk) {
    var args = Array.slice(arguments, 2);
    for (var e in events[evt]) {
      var res = events[evt][e].apply(events[evt], args);
      if (clbk)
        clbk(res);
    }
  };

  // @method AnimatedTuringMachine.getTapeWidth: width in pixels of element
  var getTapeWidth = function () {
    return (element[0].clientWidth || 700);
  };

  // @method AnimatedTuringMachine.getCurrentTapeValues
  var getCurrentTapeValues = function (count) {
    count = def(count, countPositions());
    var selection = machine.getTape().read(undefined, count);

    if (selection.length !== count)
      throw new Error("Bug: Size of selected elements invalid");

    return selection;
  };

  // @method AnimatedTuringMachine.countPositions:
  //   return number of displayed numbers
  var countPositions = function () {
    var number_elements = parseInt((getTapeWidth() - width_main_number) /
      width_one_number) + 1;

    // left and right needs space for new-occuring element on shift
    number_elements -= 2;

    if (number_elements < 3)
      number_elements = 3;
    if (number_elements % 2 === 0)
      number_elements -= 1;

    return number_elements;
  };

  // @method AnimatedTuringMachine.rebuildValues: copy & destroy .numbers
  var rebuildValues = function () {
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

  // @method AnimatedTuringMachine.assignSemanticalClasses:
  //   assign semantical classes to .numbers instances
  var assignSemanticalClasses = function () {
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

  // @method AnimatedTuringMachine.initialize
  var initialize = function () {
    running_operation = true;
    var vals = getCurrentTapeValues(countPositions());
    var mid = parseInt(vals.length / 2);

    // create numbers
    for (var i = 0; i < vals.length; i++) {
      var elem = $("<div></div>").addClass("value").text(vals[i]);
      element.find(".numbers").append(elem);
    }

    // assign CSS classes
    assignSemanticalClasses();

    // define left padding
    var computedWidth = width_one_number * (countPositions() - 1) + width_main_number;
    var actualWidth = getTapeWidth();
    var diff = actualWidth - computedWidth;

    $(".numbers").css("padding-left", parseInt(diff / 2) + "px");

    // interacting event listeners
    machine.addEventListener('movementFinished', function (move) {
      if (move.toString() === mov.RIGHT) {
        goRight();
        gear.addStepsRight(1);
      } else if (move.toString() === mov.LEFT) {
        goLeft();
        gear.addStepsLeft(1);
      }
    });
    machine.addEventListener('valueWritten', function (old_value, new_value) {
      writeValue(new_value);
      updateToolTip();
    });

    triggerEvent('initialized', null, machine.getMachineName(),
      getCurrentTapeValues());

    machine.initialize();
    running_operation = false;
  };

  // @method AnimatedTuringMachine.updateToolTip: set tool tip information
  var updateToolTip = function () {
    var vals = getCurrentTapeValues(21);
    vals[parseInt(vals.length / 2)] = "*" + vals[parseInt(vals.length / 2)] + "*";

    vals = vals.map(function (v) { return "" + v; });
    element.attr("title", vals.join(","));
  };

  // @method AnimatedTuringMachine.moveFinished: event handler
  var moveFinished = function (newValue, direction) {
    // recreate DOM element to make next animation possible
    rebuildValues();

    // assign semantic CSS classes such as lleft
    assignSemanticalClasses();

    // trigger callback
    var visibleValues = getCurrentTapeValues(countPositions());
    triggerEvent('movementFinished', null, visibleValues, newValue, direction);
    running_operation = false;
  };

  // @method AnimatedTuringMachine.goLeft: Do the going left animation
  var goLeft = function () {
    if (!toggle) {
      drawLeft(); // TODO
      return;
    }
    if (running_operation) {
      console.warn("Already working");
      return;
    }

    running_operation = true;
    offset += 1;
    updateToolTip();

    var newValues = getCurrentTapeValues(countPositions());
    var newRightValue = newValues[newValues.length - 1];

    // insert element from right
    element.find(".value_rright").removeClass("value_rright");
    var elem = $("<div></div>").addClass("value").addClass("value_rright")
      .css("opacity", "0").css("right", "0px").text(newRightValue);
    element.find(".numbers").append(elem);

    // add animated-CSS-class to trigger animation
    var elem = element.find(".value");
    elem.addClass("animated_left");
    elem.css("animation-duration", "" + speed + "ms");
    elem.each(function () {
      var isRright = $(this).hasClass("value_rright");
      var isLleft = $(this).hasClass("value_lleft");
      $(this)[0].addEventListener("animationend", function () {
        $(this).removeClass("animated_left");

        // disallow most-right element to switch back to invisibility
        if (isRright) {
          $(this).css("opacity", 1);
        }

        // delete most-left element
        if (isLleft) {
          $(this).remove();
          moveFinished(newRightValue, 'left');
        }
      }, true);
    });
  };

  // @method AnimatedTuringMachine.goRight: Do the going right animation
  var goRight = function () {
    if (!toggle) {
      drawRight(); // TODO
      return;
    }
    if (running_operation) {
      console.warn("Already working");
      return;
    }

    running_operation = true;
    offset -= 1;
    updateToolTip();

    var newValues = getCurrentTapeValues(countPositions());
    var newLeftValue = newValues[0];

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
        if (isRright) {
          $(this).remove();
          moveFinished(newLeftValue, 'right');
        }
      }, true);
    });
  };

  // @method AnimatedTuringMachine.writeValue: Write new focused value
  var writeValue = function (val) {
    if (running_operation) {
      console.warn("Already working");
      return;
    }
    var mid = parseInt($(".value").length / 2);
    var writingValue = function () {
      if (val)
        $(".value:eq(" + mid + ")").text(val);
    };
    var iShallRunThisAnimation = (speed >= 1000);
    var halftime = parseInt(speed / 4);

    if (iShallRunThisAnimation) {
      var animationSpeed = parseInt(speed / 2);
      element.find(".writer").css("animation-duration", animationSpeed + "ms");
      running_operation = true;
      element.find(".writer").addClass("animated_writer");
      setTimeout(writingValue, halftime);
      element.find(".writer")[0].addEventListener("animationend",
        function () {
          $(this).removeClass("animated_writer");
          running_operation = false;

          for (var evt in events['valueWritten']) {
            events['valueWritten'][evt]($(".value:eq(" + mid + ")").text(), val);
          }
        }, true);
    } else {
      writingValue();
      for (var evt in events['valueWritten'])
        events['valueWritten'][evt]($(".value:eq(" + mid + ")").text(), val);
    }
  };

  // @method AnimatedTuringMachine.speedUp: Increase speed
  var speedUp = function () {
    if (speed <= 200)
      return;
    speed -= 100;
    for (var i in events['speedUpdated']) {
      events['speedUpdated'][i](speed);
    }
  };

  // @method AnimatedTuringMachine.speedDown: Decrease speed
  var speedDown = function () {
    speed += 100;
    for (var i in events['speedUpdated']) {
      events['speedUpdated'][i](speed);
    }
  };

  // @method AnimatedTuringMachine.updateProgram: Update the transition table
  var updateProgram = function (table) {
    program.fromJSON(table);
  };

  // connect events with machine
  addEventListener('initialized', function () {
    machine.triggerEvent('initialized', null,
      machine.getTape().read(undefined, countPositions()));
  });
  addEventListener('movementFinished', function (move) {
    machine.triggerEvent('movementFinished', null,
      machine.getTape().read(undefined, countPositions()),
      machine.getTape().read(undefined, 1),
      move);
  });

  return inherit(machine, {
    initialize : initialize,
    getCurrentTapeValues : getCurrentTapeValues,
    speedUp : speedUp,
    speedDown : speedDown,
    addEventListener : addEventListener,
    updateProgram : updateProgram
  });
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
        fs.push(state(test['final_states'][i]));

      var default_value = def(test['tape_default_value'], null);

      var program = new Program();
      var tape = new Tape(default_value, 0);
      if (typeof test['input']['tape'] !== 'undefined')
        tape.fromArray(test['input']['tape']);
      if (typeof test['input']['cursor'] !== 'undefined')
        tape.moveTo(position(test['input']['cursor']));
      var machine = new Machine(program, tape, fs,
        state(test['input']['state']), max_iterations);

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
      if (!machine.getCursor().equals(position))
        return 'Expected final position ' + machine.getCursor().toString() +
          ' but was ' + position.toString();

    if (typeof tape_data !== 'undefined') {
      var content = machine.tapeToJSON();
      for (var i in content)
        if (content[i] !== tape_data[i]) {
          return 'Tape content was expected to equal ' +
            JSON.stringify(tape_data) + ' but value "' + content[i] +
            '" differs from "' + tape_data[i] + '"';
        }
    }

    return null;
  };

  var validate = function (testcase) {
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

  // @method TestsuiteRunner.run: run tests, return {name: error msg or null}
  var run = function () {
    var results = {};

    for (var t in tests) {
      var test = tests[t];
      test.run();

      var expected_state = state(test['output']['state']);
      var expected_reached = test['output']['final_state_reached'];
      var expected_position = position(test['output']['tape']['cursor']);
      var expected_tape = test['output']['tape']['data'];

      var tc_name = testsuite_name + "." + test['name'];
      results[tc_name] = _checkFinalState(test, test['machine'],
        expected_state, expected_reached, expected_position, expected_tape);
    }

    return results;
  };

    if (result)
      alertNote(" Testcase '" + testcase_name + "' succeeded.");
    else {
      alertNote(last_testcase_error);
      alertNote(" Testcase '" + testcase_name + "' failed.");
    }


  return {
    addEventListener : addEventListener,
    initialize : initialize,
    run : run
  };
};

// --------------------------- GearVisualization ---------------------------

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

  return {
    addStepsLeft: addStepsLeft, addStepsRight: addStepsRight,
    startAnimation: startAnimation
  };
};

// ------------------------------ TuringMarket ----------------------------

var MarketManager = function (current_machine, ui_meta, ui_data) {
  // @callback marketActivate(market id, market)
  var load_interval = 5000; // microseconds
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
    } else {
      throw new Error("Unknown event " + evt);
    }
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
    current_machine.getTape().fromJSON(tape);
  };

  // @method TuringMarket.setProgram: Set program in JSON of current machine
  var setProgram = function (prg) {
    current_machine.getProgram().fromUserJSON(prg);
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
    for (var read_symbol in obj) {
      for (var state in obj[read_symbol]) {
        isList(obj[read_symbol][state]);
        isMovement(obj[read_symbol][state][1]);
        isString(obj[read_symbol][state][2]);
      }
    }
  };
  var isMovement = function (str) {
    require(inArray(str.toLowerCase(),
      ['l', 'r', 'h', 'left', 'right', 'halt', 's', 'stop']),
      "Invalid movement " + str);
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

      expectKeys(test, ['name', 'final_states?',
        'tape_default_value?', 'input', 'output'])
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
        'value_written?', 'movement?', 'exact_number_of_iterations?', 'tape?']);
      if (typeof test['output']['final_state'] !== 'undefined')
        isString(test['output']['final_state']);
      if (typeof test['output']['unknown_instruction'] !== 'undefined')
        isBool(test['output']['unknown_instruction']);
      if (typeof test['output']['halt'] !== 'undefined')
        isBool(test['output']['halt']);
      if (typeof test['output']['movement'] !== 'undefined')
        isMovement(test['output']['movement']);
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
    v = v.replace(/\*(\S.*?\S|\S)\*/, "$1");
    v = v.replace(/__(\S.*?\S|\S)__/, "$1");
    v = v.replace(/_(\S.*?\S|\S)_/, "$1");
    v = v.replace(/==(\S.*?\S|\S)==/, "$1");
    v = v.replace(/=(\S.*?\S|\S)=/, "$1");
    v = v.replace(/<(\w|\/)[^>]*?>/, "");
    return v.trim();
  };

  var readDefinitionLine = function (line) {
    var m = line.match(/   \$ ([^:]+?): (.*)/);
    if (m === null)
      return null;
    return [m[1], m[2]].map(normalizeFoswikiText);
  };

  var readTableHeaderLine = function (line) {
    var tabs = line.split("|");
    if (tabs.length <= 3)
      return null;
    if (tabs[0] !== "")
      throw new InvalidFoswikiException("Table header line must start with |");
    if (tabs[tabs.length - 1] !== "")
      throw new InvalidFoswikiException("Table header line must end with |");
    return tabs.slice(2, -1).map(normalizeFoswikiText);
  };

  var readTableValueLine = function (line) {
    var tabs = line.split("|");
    if (tabs.length <= 3)
      return null;
    tabs = tabs.slice(1, -1).map(function (v) { return v.trim(); });
    var cols = [normalizeFoswikiText(tabs[0])];
    var elems = tabs.slice(1).map(function (v) {
      if (v.trim() === "" || v.trim() === "..." || v.trim() === "…")
        return "";
      var vals = v.split("-");
      if (vals.length !== 3)
        throw new InvalidFoswikiException("Triples must contain 3 values: '"
          + v + "' is given");
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
    throw new InvalidFoswikiException("Cannot import empty foswiki text");

  var program = {}, initial_state = "", final_states = [];
  var tape = [], name = "", cursor = Infinity, columns = [];

  var lines = text.split("\n");
  var mode = 'start';
  for (var l = 0; l < lines.length; l++) {
    var line = lines[l];
    if (mode === 'start') {
      if (line.match(/^\s*$/))
        continue;
      var def = readDefinitionLine(line);
      var head = readTableHeaderLine(line);
      if (def === null && head === null)
        throw new InvalidFoswikiException("Uninterpretable line: " + line);
      else if (def !== null) {
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
            throw new InvalidFoswikiException("Cursor must be integer");
        }
        mode = 'start';
      } else if (head !== null) {
        columns = head.slice();
        $.each(head, function (k, v) { program[v] = []; });
        mode = 'rows';
      }
    } else if (mode === 'rows') {
      var vals = readTableValueLine(line);
      if (vals === null) {
        mode = 'ignore';
        continue;
      }
      if (vals.length !== columns.length + 1)
        throw new InvalidFoswikiException("Inconsistent number of columns " +
          "in Foswiki table");

      var from_state;
      for (var colid in vals) {
        var val = vals[colid];
        if (colid === "0")
          from_state = val;
        else
          if (val)
            program[columns[parseInt(colid) - 1]][from_state] = val;
      }
    } else if (mode === 'ignore') {
      if (!line.match(/^\s*$/))
        throw new InvalidFoswikiException("Cannot parse Foswiki line: " + line);
    }
  }

  if (columns.length === 0 || mode === "start")
    throw new InvalidFoswikiException("No definition list found");
  if (tape.length === 0)
    throw new InvalidFoswikiException("Missing tape in Foswiki definition");
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
    program : program,
    state_history : [initial_state],
    tape : tape,
    final_states : final_states,
    initial_state : initial_state,
    initial_tape : tape,
    final_state_reached : false,
    undefined_instruction : false,
    name : name,
    step : 0
  };
};

var toFoswikiText = function (tm) {
  var justify = function (text, size) {
    size = def(size, 28);
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

  text += defi('Name', data['name']);
  text += defi('State', current_state);
  text += defi('Final states', data['final_states'].join(", "));
  text += defi('Cursor', tm.getTape().size() - 1);
  text += defi('Tape', tm.getTape().read(undefined, tm.getTape().size() * 2));

  var from_symbols = keys(data['program']);
  from_symbols.splice(0, 0, "");
  var states = new OrderedSet();
  for (var i in from_symbols) {
    keys(data['program'][from_symbols[i]]).map(function (v2) {
      states.push(v2);
    });
  }
  states = states.toJSON();

  var j = function (v) { return justify(v); };
  text += "\n| " + from_symbols.map(j).join(" | ") + " |\n";

  for (var i in states) {
    var from_state = states[i];

    var cols = [];
    for (var idx in from_symbols) {
      var symb = from_symbols[idx];
      if (symb === "")
        continue;
      var instr = data['program'][symb][from_state];
      if (!instr)
        cols.push(justify(""));
      else
        cols.push(justify(instr.join(" - ")));
    }

    var from_symbol = from_symbols[idx];
    text += "| " + justify(from_state) + " | " + cols.join(" | ") + " |\n";
  }

  return text;
};

var UI = {
  // @function import: Import machine in JSON from textarea
  import : function (ui_notes, tm) {
    var text = $("#data").val();
    var format = $("#overlay_text .format").val();
    try {
      if (format === "json") {
        var data = JSON.parse(text);
        try {
          tm.fromJSON(data);
          UI['alertNote'](ui_notes, "Program imported");
        } catch (e) {
          UI['alertNote'](ui_notes, "Unsuccessful import")
        }
      } else {
        var data = readFoswikiText(text);
        if (!data) {
          UI['alertNote'](ui_notes, "Unsuccessful import");
        } else {
          tm.fromJSON(data);
          UI['alertNote'](ui_notes, "Program imported");
        }
      }
    } catch (e) {
      UI['alertNote'](ui_notes, "Could not parse given JSON");
    }
  },

  // @function export: Export machine in JSON to textarea
  export : function (tm) {
    var format = $("#overlay_text").find(".format").val();
    var text;
    if (format === "json") {
      text = JSON.stringify(tm.toJSON());
    } else {
      text = tm.toFoswiki();
    }
    $("#data").val("" + text);
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
  setTapeContent : function (ui_data, tape) {
    var text = tape.map(function (v) { return v.toString(); }).join("");
    $(ui_data).find(".tape").val(text);
  },

  // @function getFinalStates
  getFinalStates : function (ui_data) {
    var text = $(ui_data).find(".final_states").val();
    return text.split("\s+,\s+").map(function (s) { return state(s); });
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
    var table = {};
    ui_data.find(".transition_table tbody tr").each(function () {
      var from_symbol = $(this).find("td:eq(0) input").val();
      var from_state = $(this).find("td:eq(1) input").val();
      var write_symbol = $(this).find("td:eq(2) input").val();
      var move = $(this).find("td:eq(3) select").val();
      var to_state = $(this).find("td:eq(4) input").text();

      if (typeof table[from_symbol] === 'undefined')
        table[from_symbol] = {};
      if (typeof table[from_symbol][from_state] === 'undefined')
        table[from_symbol][from_state] = [];

      table[from_symbol][from_state].push(write_symbol);
      table[from_symbol][from_state].push(move);
      table[from_symbol][from_state].push(to_state);
    });

    return table;
  },

  // @function writeTransitionTable: write transition table to DOM
  addTransitionTableRow : function (ui_data, elements) {
    // assumption. last row is always empty
    var row = ui_data.find(".transition_table tbody tr").last();
    ui_data.find(".transition_table tbody").append(row.clone());

    row.find("td:eq(0) input").val(elements[0] || "");
    row.find("td:eq(1) input").val(elements[1] || "");
    row.find("td:eq(2) input").val(elements[2] || "");
    row.find("td:eq(3) select").val(elements[3] || "Stop");
    row.find("td:eq(4) input").val(elements[4] || "");
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
    for (var from_symbol in table) {
      for (var from_state in table[from_symbol]) {
        var elems = table[from_symbol][from_state];
        var elements = [from_symbol, from_state, elems[0], elems[1], elems[2]];
        UI['addTransitionTableRow'](ui_data, elements);
      }
    }
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

  // before semester begin, always run testsuite
  if ((new Date).getTime() / 1000 < 1412460000) {
    var t = testsuite();
    UI['alertNote'](ui_notes,
      typeof t === 'string' ? t : 'Testsuite: ' + t.message
    );
  }

  // events
  tm.addEventListener('stateUpdated', function (old_state, new_state) {
    ui_tm.find(".state").text(new_state);
  });
  tm.addEventListener('movementFinished', function (vals, val, move) {
    console.log("Finished movement to the " + move + ". Created value " + val);
    console.debug(vals);
  });
  tm.addEventListener('speedUpdated', function (speed) {
    console.debug("Speed got updated to " + speed + " ms");
    $("#speed_info").val(speed + " ms");
  })
  tm.addEventListener('valueWritten', function (old_value, new_value) {
    console.debug("I overwrote value " + old_value + " with " + new_value);
  });
  tm.addEventListener('possiblyInfinite', function () {
    var ret = confirm("I have run " + base +
      " iterations without reaching a final state. " +
      "Do you still want to continue?");
    return Boolean(ret);
  });

  // controls
  function next() {
    tm.next(1);
  }
  function prev() {
    tm.prev(1);
  }
  function slower() {
    tm.speedDown();
  }
  function faster() {
    tm.speedUp();
  }
  function reset() {
    tm.reset();
  }
  function run() {
    tm.run();
  }

  $(".turingmachine .control_prev").click(prev);
  $(".turingmachine .control_next").click(next);
  $(".turingmachine .control_reset").click(reset);
  $(".turingmachine .control_run").click(run);
  $(".turingmachine .control_slower").click(slower);
  $(".turingmachine .control_faster").click(faster);

  /*
  // overlay
  function toggle_overlay() {
    if (!$("#overlay").is(':visible')) {
      $("#overlay").show(100);
      $("#overlay_text").delay(150).show(400);
    }
  }
  $(".turingmachine .import").click(toggle_overlay);
  $(".turingmachine .export").click(toggle_overlay);
  $("#overlay").click(function () {
    if ($("#overlay").is(':visible')) {
      $("#overlay").delay(200).hide(100);
      $("#overlay_text").hide(200);
    }
  });

  $(".turingmachine .import").click(function () {
    $("#overlay_text").find(".action").text("Import");
    $("#data").attr("readonly", false);
    $("#import_now").show();
    $("#data").val("");
  });
  $(".turingmachine .export").click(function () {
    $("#overlay_text .action").text("Export");
    $("#data").attr("readonly", true);
    $("#import_now").hide();
    UI['export'](tm);
  });
  $("#overlay_text .import_now").click(UI['import'](ui_notes, tm));
  $("#overlay_text .format").change(function () {
    var is_export = $("#overlay_text .action").text().indexOf("Export") !== -1;
    if (is_export)
      UI['export'](tm);
    else
      UI['import'](ui_notes, tm);
  });

  $(".transition_table").change(function () {
    var table = UI['readTransitionTable'](ui_data);
    tm.updateProgram(table);
  });*/

  // Turing's markets
  var manager = new MarketManager(tm, ui_meta, ui_data);

  manager.addEventListener('marketActivated', function (market_id) {
    console.info("Market " + market_id + " activated. " +
                 "I initialized the machine :)");

    ui_meta.find(".machine_name").val(tm.getMachineName());
    ui_data.find(".final_states").val(tm.getFinalStates()
      .map(function (v) { return v.toString(); }).join(", "));

    var values = tm.getCurrentTapeValues().slice();
    var mid = parseInt(values.length / 2);
    values[mid] = '*' + values[mid] + "*";
    ui_data.find(".tape").val(values.join(","));

    UI['writeTransitionTable'](ui_data, tm.getProgram().toJSON());

    tm.initialize();
  });

  manager.initialize();
  return tm;
}