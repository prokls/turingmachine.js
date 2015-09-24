//
// turingmachine.js
//
// A turing machine web application for educational purposes.
// The main routine is at the end of the document.
//
// Dependencies:
//   - jQuery (tested with 1.11.3)
//
// Remarks:
//   - TODO, NOTE and FEATURE flags are used in the source code.
//   - toJSON and fromJSON can be used to export/import data from every object
//
// Contributions:
// - FelixHOer (design discussion)
// - Martina Tscheckl (zero writer turingmachine)
// - and lots of students and tutors of winter term 2014/15.
// Thank you!
//
// (C) 2013-2015, Public Domain, Lukas Prokop
//

'use strict';

// --------------------------- global variables ---------------------------

var app_name = "turingmachine.js";
var app_version = "1.0.0-stable";
var app_author = "Lukas Prokop <admin@lukas-prokop.at>";

// blank symbol for tapes, immutable const
var generic_blank_symbol = '_';

// iterations before possiblyInfinite event is thrown, immutable const
var generic_check_inf_loop = 1000;

// -------------------------------- Helpers -------------------------------

// Default parameters abstraction
function def(arg, val) { return (typeof arg !== 'undefined') ? arg : val; }

// Generic comparison function
function cmp(a, b) { return (a < b) ? -1 : (a === b ? 0 : 1); }

// Get string representation
function toStr(v) { return (v === undefined) ? "" + undefined : v.toString(); }

// Get JSON representation
function toJson(v) { return (v === undefined) ? null : v.toJSON(); }

// Inheritance wrapper
var inherit = function (prot, child, args) {
  require(child !== undefined, "You need to construct objects with the new operator");
  prot.apply(child, args);
  for (var a in args)
    prot = prot.bind({}, args[a]);
  var inst = new prot();
  for (var key in inst) {
    var desc = Object.getOwnPropertyDescriptor(inst, key);
    Object.defineProperty(child, key, desc);
  }
  return inst;
};

// any f(element) of iterable returned true
function any(iter, f) {
  if (iter.length === 0)
    return false;
  return iter.map(f).reduce(
    function (a, b) { return (!!a) || (!!b); }
  );
}

// all f(element) of iterable returned true
function all(iter, f) {
  if (iter.length === 0)
    return true;
  return iter.map(f).reduce(
    function (a, b) { return (!!a) && (!!b); }
  );
}

// Membership test
function isIn(needle, haystack, cmp_fn) {
  cmp_fn = def(cmp_fn, cmp);
  for (var i = 0; i < haystack.length; i++) {
    if (cmp_fn(needle, haystack[i]) === 0)
      return true;
  }
  return false;
}

// Return all keys of given object
var keys = function (obj)
{
  var k = [];
  for (var key in obj)
    k.push(key);
  return k;
}

// Array equivalence
function arrayCmp(array1, array2, cmp_fn) {
  cmp_fn = def(cmp_fn, cmp);
  if (array1.length !== array2.length)
    return cmp(array1.length, array2.length);
  for (var i = 0; i < array1.length; i++) {
    if (cmp_fn(array1[i], array2[i]) < 0)
      return -1;
    else if (cmp_fn(array1[i], array2[i]) > 0)
      return 1;
  }
  return 0;
}

// String repetition as per String.prototype.repeat by ECMAScript 6.0
var repeat = function (str, rep) {
  var result = '';
  for (var i = 0; i < rep; i++)
    result += str;
  return result;
}

// assert statement
function require(cond, msg)
{
  if (!cond)
    throw AssertionException(msg);
}

// user representation which also shows datatype
function repr(value)
{
  if (typeof value === 'string')
    return "'" + value + "'";
  else if (typeof value === 'undefined')
    return 'undefined';
  else if (value === null)
    return 'null';
  else if (typeof value === 'object') {
    if (isState(value))
      return "state<" + value.toString() + ">";
    else if (isSymbol(value))
      return "symbol<" + value.toString() + ">";
    else if (isMotion(value))
      return "motion<" + value.toString() + ">";
    else if (isInstrTuple(value))
      return "instruction<" + value.toString() + ">";
    else if (isPosition(value))
      return "position<" + value.toString() + ">";
    else if (value.isProgram)
      return "program<count=" + value.count() + ">";
    else if (value.isTape)
      return "tape<" + value.toHumanString() + ">";
    else {
      var count_props = 0;
      for (var prop in value)
        count_props += 1;
      if (count_props < 5)
        return "object<" + JSON.stringify(value) + ">";
      else if (!value.toString().match(/Object/))
        return "object<" + value.toString() + ">";
      else
        return "object";
    }
  }
  else if (typeof value === 'boolean')
    return "bool<" + value + ">";
  else if (typeof value === 'number')
    return "" + value;
  else if (typeof value === 'symbol')
    return "symbol<" + value + ">";
  else if (typeof value === 'function') {
    if (value.name === "")
      return "anonymous function";
    else
      return "function<" + value.name + ">";
  } else
    return "unknown value: " + value;
}

// Deep copy implementation
var deepCopy = function (val)
{
  require(!(val instanceof Date));
  if (Array.isArray(val))
    return val.slice().map(function (v) { return deepCopy(v); });
  else if (val === null)
    return null;
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

// --------------------------- data structures ----------------------------

// a set implementation with ordering
function OrderedSet(initial_values, cmp_fn) {
  cmp_fn = def(cmp_fn, cmp);
  // @member values
  var values = [];

  this._findIndex = function (value) {
    if (values.length === 0)
      return 0;
    else if (cmp_fn(values[values.length - 1], value) === -1)
      return values.length;
    else
      // linear search
      for (var i = 0; i < values.length; i++)
        if (cmp_fn(value, values[i]) < 1)
          return i;
  };

  // @method OrderedSet.push: append some value to the set
  this.push = function (value) {
    var index = this._findIndex(value);
    var found = (index < values.length) && (cmp_fn(values[index], value) === 0);
    if (!found)
      values.splice(index, 0, value);
    return !found;
  };

  // @method OrderedSet.remove: remove some value from the set
  this.remove = function (value) {
    var index = this._findIndex(value);
    if (index < values.length && cmp_fn(values[index], value) === 0) {
      values.splice(index, 1);
      return true;
    } else
      return false;
  };

  // @method OrderedSet.contains: Does this OrderedSet contain this value?
  this.contains = function (value) {
    var idx = this._findIndex(value);
    return idx < values.length && cmp_fn(values[idx], value) === 0;
  };

  // @method OrderedSet.size: Returns size of the set
  this.size = function () {
    return values.length;
  };

  // @method OrderedSet.equals: Do this set equal with the given parameter?
  this.equals = function (other) {
    var o = other.toJSON();
    if (o.length !== values.length)
      return false;
    for (var i = 0; i < o.length; i++) {
      if (cmp_fn(values[i], o[i]) !== 0)
        return false;
    }
    return true;
  };

  // @method OrderedSet.toString: returns OrderedSet in string repr
  this.toString = function () {
    return "set[" + values.join(",") + "]";
  };

  // @method OrderedSet.toJSON: export set into JSON data structure
  this.toJSON = function () {
    return values.slice(0);
  };

  // @method OrderedSet.fromJSON: import set from JSON data structure
  this.fromJSON = function (data) {
    values = data;
  };

  if (typeof initial_values !== 'undefined')
    for (var i = 0; i < initial_values.length; i++)
      this.push(initial_values[i]);
}

// a set implementation
function UnorderedSet(initial_values, cmp_fn) {
  cmp_fn = def(cmp_fn, cmp);
  // @member values
  var values = [];

  // @method UnorderedSet.push: append some value to the set
  this.push = function (value) {
    if (this.contains(value))
      return false;
    values.push(value);
    return true;
  };

  // @method UnorderedSet.remove: remove some value from the set
  this.remove = function (value) {
    for (var i = 0; i < values.length; i++)
      if (cmp_fn(values[i], value) === 0) {
        values.splice(i, 1);
        return true;
      }
    return false;
  };

  // @method UnorderedSet.contains: Does this UnorderedSet contain this value?
  this.contains = function (value) {
    for (var i = 0; i < values.length; i++)
      if (cmp_fn(value, values[i]) === 0)
        return true;
    return false;
  };

  // @method UnorderedSet.size: Returns size of the set
  this.size = function () {
    return values.length;
  };

  // @method UnorderedSet.equals: Do this set equal with the given parameter?
  this.equals = function (other) {
    if (typeof other.toJSON === 'undefined' && typeof other.length !== 'undefined')
      other = new UnorderedSet(other, cmp_fn);
    else if (typeof other !== 'object')
      return false;

    var o = other.toJSON();
    var m = this.toJSON();
    if (o.length !== m.length)
      return false;

    var compare = function (a, b) {
      if (!a.equals)
        return cmp(a, b);
      return (a.equals(b))
        ? 0
        : cmp_fn(a.toString(), b.toString());
    };
    o.sort(compare);
    m.sort(compare);
    for (var i = 0; i < o.length; i++) {
      if (cmp_fn(m[i], o[i]) !== 0)
        return false;
    }
    return true;
  };

  // @method UnorderedSet.toString: returns UnorderedSet in string repr
  this.toString = function () {
    return "uset[" + values.join(",") + "]";
  };

  // @method UnorderedSet.toJSON: export set into JSON data structure
  this.toJSON = function () {
    return values.slice(0).map(function (v) {
      if (v.toJSON)
        return v.toJSON();
      else
        return v;
    });
  };

  // @method UnorderedSet.fromJSON: import set from JSON data structure
  this.fromJSON = function (data) {
    values = data;
  };

  if (typeof initial_values !== 'undefined')
    for (var i = 0; i < initial_values.length; i++)
      this.push(initial_values[i]);
}

// a queue implementation
var Queue = function (initial_values) {
  var values = [];

  this.push = function (val) {
    values.splice(0, 0, val);
  };

  this.pop = function () {
    return values.pop();
  };

  this.clear = function () {
    values = [];
  };

  this.isEmpty = function () {
    return values.length === 0;
  };

  if (typeof initial_values !== 'undefined')
    for (var i = 0; i < initial_values.length; i++)
      this.push(initial_values[i]);
}

// EventRegister adds event handlers and triggers event
var EventRegister = function (valid_events) {
  var events = {};

  // @method EventRegister.add: event listener definition
  //   Call `clbk` at most `max_calls` times whenever `evt` is triggered
  this.add = function (evt, clbk, max_calls) {
    require(clbk, "callback must be given");
    require(evt, "event name must be given");
    max_calls = def(max_calls, Infinity);
    if (valid_events === undefined || isIn(evt, valid_events)) {
      if (typeof events[evt] === 'undefined')
        events[evt] = [];
      events[evt].push([clbk, max_calls]);
    } else
      throw new Error("Unknown event " + evt);
  };

  // @method EventRegister.trigger: trigger event
  //   Trigger event `evt` and call `clbk` with the result of every event handler
  this.trigger = function (evt) {
    var args = [];
    for (var i = 1; i < arguments.length; i++)
      args.push(arguments[i]);

    for (var e = 0; events[evt] !== undefined && e < events[evt].length; e++) {
      var event_listener = events[evt][e][0];
      events[evt][e][1] -= 1;
      if (events[evt][e][1] === 0)
        events[evt].splice(e, 1);
      setTimeout(function (event_listener, events_evt, args) {
        return function () {
          event_listener.apply(events_evt, args);
        };
      }(event_listener, events[evt], args), 10);
    }
  };

  // @method EventRegister.clear: clear all registered event callbacks
  this.clear = function () {
    events = {};
  };

  // @method EventRegister.toString: string representation
  this.toString = function () {
    var out = "EventRegister with\n";
    var keys = Object.getOwnPropertyNames(events);
    for (var e in keys) {
      var len = events[keys[e]].length;
      out += "  " + keys[e] + " slot with " + len + " callback(s)\n";
    }
    if (keys.length === 0)
      out += "  no events\n";
    return out;
  };
}

// ------------------------------ exceptions ------------------------------

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
    ? "Condition is not satisfied: \n" + msg
    : "Condition not satisfied";
  err.stack = (new Error()).stack;
  Error.call(err);
  if (typeof console.trace === 'function')
    console.trace();
  return err;
}

// @exception thrown, if invalid JSON data is given
function SyntaxException(msg)
{
  var err = new Error();
  err.name = "SyntaxException";
  err.message = msg;
  err.stack = (new Error()).stack;
  Error.call(err);
  if (typeof console.trace === 'function')
    console.trace();
  return err;
}

// -------------------------------- Symbol --------------------------------

// @object Symbol: Symbol on Turing machine tape.
function Symbol(value)
{
  // @member Symbol.value
  require(typeof value !== 'undefined');  // disallowed value
  if (value.isSymbol)
    throw AssertionException("Symbol cannot be created by Symbol instance");

  // @method Symbol.equals: Equality comparison for Symbol objects
  this.equals = function (other) {
    return value === other.toJSON();
  };

  // @method Symbol.cmp: Compare two symbols
  var global_cmp = cmp;
  this.cmp = function (other) {
    if (!isSymbol(other))
      return -1;
    return global_cmp(value, other.toJSON());
  };

  // @method Symbol.copy: Return copy of the Symbol instance
  this.copy = function () {
    return new Symbol(value);
  };

  // @method Symbol.toString: String representation of Symbol objects
  this.toString = function () {
    return repr(value);
  };

  // @method Symbol.toJSON: JSON representation of Symbol objects
  this.toJSON = function() {
    return value;
  };

  // @method Symbol.fromJSON: Get object from JSON
  this.fromJSON = function (j) {
    value = j;
  };

  this.isSymbol = true;
}

// Default mapping for arbitrary values to TM tape values
//  will normalize all values to trimmed strings
function normalizeSymbol(val) {
  if (val === null || typeof val === "undefined")
    return " ";

  val = "" + val;
  val = val.trim();
  if (val === "")
    return ' ';
  else
    return val;
}

// is given `val` a Symbol instance?
function isSymbol(val) {
  try {
    return val.isSymbol === true;
  } catch (e) {
    return false;
  }
}

// require `val` to be a symbol
function requireSymbol(val) {
  if (!isSymbol(val))
    throw AssertionException(
      "Given value is not a tape symbol: " + repr(val)
    );
}

// create Symbol instance from `val`
function symbol(val, norm_fn) {
  norm_fn = def(norm_fn, normalizeSymbol);

  var value = norm_fn(val);
  require(typeof value !== 'undefined',
    "Cannot create symbol from " + repr(value));

  return new Symbol(value);
}

// --------------------------------- State --------------------------------

// @object State: State of the Turing machine.
function State(name)
{
  // @member State.name
  require(typeof name !== 'undefined');  // disallowed value

  if (isState(name))
    name = name.toJSON();

  // @method State.equals: Equality comparison for State objects
  this.equals = function (other) {
    return this.toJSON() === other.toJSON();
  };

  // @method State.copy: Return a copy from the current state
  this.copy = function () {
    return new State(name);
  };

  // @method State.toString: String representation of State objects
  this.toString = function () {
    return name.toString();
  };

  // @method State.toJSON: JSON representation of State objects
  this.toJSON = function() {
    return name;
  };

  // @method State.fromJSON: Get object from JSON
  this.fromJSON = function (j) {
    value = j;
  };

  this.isState = true;
}

// Default mapping for arbitrary values to state names
//  will normalize all values to strings
function normalizeState(val) {
  if (val === null || typeof val === 'undefined')
    return ' ';
  val = ("" + val).trim();
  if (val === "")
    return " ";
  else
    return val;
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
    throw AssertionException("Is not a valid state: " + obj);
}

// create State instance from `name`
function state(name, norm_fn)
{
  norm_fn = def(norm_fn, normalizeState);

  var value = norm_fn(name);
  require(typeof value !== 'undefined',
    "Cannot create state from " + repr(value));

  return new State(value);
}

// -------------------------------- Motion --------------------------------

// @object Motion: Abstraction for moving operation.
function Motion(value)
{
  // @member Motion.value
  require(typeof value !== 'undefined');  // disallowed value

  // @method Motion.equals: Equality comparison for Motion objects
  this.equals = function (other) {
    if (isMotion(other))
      return value === other.toString();
    else
      return value === other;
  };

  // @method Motion.copy: Copy this motion object
  this.copy = function () {
    return new Motion(value);
  };

  // @method Motion.toString: String representation of Motion objects
  this.toString = function () {
    return value;
  };

  // @method Motion.toJSON: JSON representation of Motion objects
  this.toJSON = function () {
    return value;
  };

  // @method Motion.fromJSON: Get object from JSON
  this.fromJSON = function (j) {
    value = j;
  };

  this.isMotion = true;
};

function normalizeMotion(move) {
  var norm = { 'r': 'Right', 'l': 'Left', 'h': 'Halt', 's': 'Stop' };

  if (typeof move !== 'undefined' && move.isMotion)
    return move;
  if (typeof move === 'string')
    move = move.toLowerCase();

  if (isIn(move, ['l', 'left']) || move === norm['l'].toLowerCase())
    move = norm['l'];
  else if (isIn(move, ['r', 'right']) || move === norm['r'].toLowerCase())
    move = norm['r'];
  else if (isIn(move, ['s', 'stop']) || move === norm['s'].toLowerCase())
    move = norm['s'];
  else if (isIn(move, ['h', 'halt']) || move === norm['h'].toLowerCase())
    move = norm['h'];
  else
    move = undefined;
  return move;
}

// Test whether or not the given parameter `obj` describes a motion
function isMotion(obj)
{
  return typeof normalizeMotion(obj) !== 'undefined';
}

// Throw exception if `obj` is not a Motion object
function requireMotion(obj)
{
  if (!(isMotion(obj)))
    throw AssertionException("Is not a valid motion: " + obj);
}

// Convenient function to create Motion objects
function motion(m)
{
  var move = normalizeMotion(m);
  require(typeof move !== 'undefined', "Unknown motion " + repr(m));
  return new Motion(move);
}

// Motion values, immutable const
var mot = {
  LEFT  : motion("Left"),
  RIGHT : motion("Right"),
  STOP  : motion("Stop"),
  HALT : motion("Halt")  // implemented, but please do not use
};

// ------------------------------- Position -------------------------------

// @object Position: Abstraction for Position at Tape.
function Position(idx)
{
  // @member Position.idx
  require((idx % 1) < 0.01);

  // @method Position.equals: Equality comparison for Position objects
  this.equals = function (other) {
    if (isPosition(other))
      return this.toJSON() === other.toJSON();
    else
      return idx === other;
  };

  // @method Position.add: Returns Position instance at pos this+summand
  this.add = function (summand) {
    return position(idx + summand);
  };

  // @method Position.sub: Returns Position instance at pos this+subtrahend
  this.sub = function (subtrahend) {
    return position(idx - subtrahend);
  };

  // @method Position.diff: Return integer diff between this and given Position
  this.diff = function (other) {
    return other.idx - this.idx;
  };

  // @method Position.toString: String representation of Position objects
  this.toString = function () {
    return idx.toString();
  };

  // @method Position.toJSON: JSON representation of Position objects
  this.toJSON = function () {
    return idx;
  };

  // @method Position.fromJSON: Retrieve object from JSON representation
  this.fromJSON = function (j) {
    idx = j;
  };

  this.index = idx;
  this.isPosition = true;
}

// Default mapping for some arbitrary value to a position
//   returns undefined in case of an error
function normalizePosition(val) {
  val = parseInt(val);
  if (isNaN(val))
    return undefined;
  else
    return val;
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
    throw AssertionException("Is not a position");
}

// Convenient function to create position objects
function position(val, norm_fn)
{
  norm_fn = def(norm_fn, normalizePosition);

  var value = norm_fn(val);
  require(typeof value !== 'undefined',
    "Cannot create Position instance from " + repr(val));

  return new Position(value);
}

// ------------------------------ InstrTuple ------------------------------

// @object InstrTuple: Instruction tuple (value, movement, to state)
function InstrTuple(write, move, state)
{
  // @member InstrTuple.write
  // @member InstrTuple.move
  // @member InstrTuple.state

  requireSymbol(write);
  requireMotion(move);
  requireState(state);

  this.write = write;
  this.move = move;
  this.state = state;

  // @method InstrTuple.equals: Equality comparison for InstrTuple objects
  this.equals = function (other) {
    require(isInstrTuple(other), "InstrTuple object required for comparison");
    if (!other)
      return false;
    return write.equals(other.write) && move.equals(other.move) &&
        state.equals(other.state);
  };

  // @method InstrTuple.toString: String representation of InstrTuple objects
  this.toString = function () {
    return "{instruction: write " + write + ", move "
      + move + " and goto state "
      + state + "}";
  };

  // @method InstrTuple.toJSON: JSON representation of InstrTuple objects
  this.toJSON = function () {
    return [write.toJSON(), move.toJSON(), state.toJSON()];
  };

  // @method InstrTuple.fromJSON: Import JSON representation
  this.fromJSON = function (obj, symbol_norm_fn, state_norm_fn) {
    symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
    state_norm_fn = def(state_norm_fn, normalizeState);

    var it_symbol = symbol(obj[0], symbol_norm_fn);
    var it_move = motion(obj[1]);
    var it_state = state(obj[2], state_norm_fn);

    write = it_symbol;
    move = it_move;
    state = it_state;
  };

  this.isInstrTuple = true;
}

// Test whether or not the given parameter `obj` is an InstrTuple object
function isInstrTuple(obj)
{
  try {
    return obj.isInstrTuple === true;
  } catch (e) {
    return false;
  }
}

// Throw exception if `obj` is not a Instruction object
function requireInstrTuple(obj)
{
  if (!isInstrTuple(obj))
    throw AssertionException("Is not an instruction");
}

// Convenient function to create Instruction objects
function instrtuple(w, m, s)
{
  return new InstrTuple(w, m, s);
}

// -------------------------------- Program -------------------------------

function defaultProgram() {
  // TODO: normalization functions for symbol & state
  var prg = new Program();
  prg.set(symbol(generic_blank_symbol), state('Start'),
    symbol(generic_blank_symbol), mot.RIGHT, state('End'));
  return prg;
}

// @object Program: Abstraction for the program of the Turing machine.
function Program()
{
  // @member Program.program
  // list of [from_symbol, from_state, (to_symbol, motion, to_state)]
  // the parens denote a InstrTuple object
  var program = [];

  this._safeGet = function (from_symbol, from_state) {
    requireSymbol(from_symbol);
    requireState(from_state);
    for (var i = 0; i < program.length; i++)
      if (program[i][0].equals(from_symbol) && program[i][1].equals(from_state))
        return program[i][2];

    return undefined;
  };

  this._safeSet = function (from_symbol, from_state, instr, overwrite) {
    overwrite = def(overwrite, true);
    requireSymbol(from_symbol);
    requireState(from_state);
    requireInstrTuple(instr);

    for (var i = 0; i < program.length; i++)
      if (program[i][0].equals(from_symbol) && program[i][1].equals(from_state))
        if (overwrite) {
          program[i][2] = instr;
          return true;
        } else
          return false;

    program.push([from_symbol, from_state, instr]);
    return true;
  };

  // @method Program.clear: Clear program table
  this.clear = function () {
    program = [];
  };

  // @method Program.exists: Does (from_symbol, from_state) exist in table?
  this.exists = function (from_symbol, from_state) {
    requireSymbol(from_symbol);
    requireState(from_state);
    return typeof this._safeGet(from_symbol, from_state) !== 'undefined';
  };

  // @method Program.set: Set entry in program
  this.set = function (from_symbol, from_state, write, move, to_state) {
    requireSymbol(from_symbol);
    requireState(from_state);
    var value;

    if (isInstrTuple(write)) {
      // InstrTuple was provided instead of (write, move, to_state)
      value = write;
    } else {
      require(typeof move !== 'undefined');
      requireSymbol(write);
      requireMotion(move);
      requireState(to_state);

      value = instrtuple(write, move, to_state);
    }

    this._safeSet(from_symbol, from_state, value, true);
  };

  // @method Program.get: Return InstrTuple for given (symbol, state) or undefined
  this.get = function (from_symbol, from_state) {
    requireSymbol(from_symbol);
    requireState(from_state);
    return this._safeGet(from_symbol, from_state);
  };

  // @method Program.size: Count number of instructions stored in program
  this.size = function () {
    return program.length;
  };

  // @method Program.getFromSymbols: Get UnorderedSet of all from symbols
  this.getFromSymbols = function () {
    var symbol_set = new UnorderedSet([], function (a, b) { return a.equals(b) ? 0 : -1 });
    for (var i in program)
      symbol_set.push(program[i][0]);
    return symbol_set;
  };

  // @method Program.getFromSymbols: Get array of all from symbols
  this.getFromStates = function () {
    var state_set = new UnorderedSet([], function (a, b) { return a.equals(b) ? 0 : -1 });
    for (var i in program)
      state_set.push(program[i][1]);
    return state_set;
  };

  // @method Program.toString: String representation of Program object
  this.toString = function () {
    var repr = "<program>\n";
    for (var i in program) {
      var f = [program[i][0], program[i][1]].map(toStr).join(";");
      var s = program[i][2].toString();
      repr += "  " + f + "  = " + s + "\n";
    }
    repr += "</program>";

    return repr;
  };

  // @method Program.toJSON: JSON representation of Program object
  this.toJSON = function () {
    var data = [];
    for (var i in program)
      data.push([program[i][0].toJSON(), program[i][1].toJSON(),
                 program[i][2].toJSON()]);

    return data;
  };

  // @method Program.fromJSON: Import a program
  // @example
  //    fromJSON([['0', 'Start', ['1', 'RIGHT', 'End']]])
  this.fromJSON = function (data, symbol_norm_fn, state_norm_fn) {
    if (typeof data === "string")
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new SyntaxException(
          "Cannot import JSON as program. JSON is invalid."
        );
      }

    this.clear();

    for (var i in data) {
      var from_symbol = symbol(data[i][0], symbol_norm_fn);
      var from_state = state(data[i][1], state_norm_fn);
      var write = symbol(data[i][2][0], symbol_norm_fn);
      var move = motion(data[i][2][1]);
      var to_state = state(data[i][2][2], state_norm_fn);

      this.set(from_symbol, from_state, write, move, to_state);
    }
  };

  this.isProgram = true;
};

// --------------------------------- Tape ---------------------------------

function defaultTape(symbol_norm_fn) {
  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
  return new Tape(symbol(generic_blank_symbol, symbol_norm_fn));
}

// @object Tape: Abstraction for an infinite tape.
function Tape(blank_symbol)
{
  // @member Tape.blank_symbol: value to written if new space is created
  blank_symbol = def(blank_symbol, symbol(generic_blank_symbol));
  requireSymbol(blank_symbol);

  // @member Tape.offset: Offset of position 0 to values index 0
  //   if index 3 at tape contains position 0, then offset=3
  // @domain arbitrary integer
  var offset = 0;
  // @member Tape.cursor: Cursor position
  // @domain Position instance of arbitrary value
  var cur = position(0);
  // @member Tape.tape
  //   stores undefined instead for blank symbols and
  //   replaces them with blank_symbol when represented as string
  //   cursor always points to element which exists here
  // @domain ordered sequence of Symbol instances or undefined
  var tape = [];

  var min = 0, max = 0;

  // Determine the actual index of the cursor inside `tape`
  this._cursorIndex = function () {
    return cur.index + offset;
  };

  // Retrieve some value from the stack by Position
  this._get = function (p) {
    requirePosition(p);
    return tape[p.index + offset];
  };

  // invariants check
  this._testInvariants = function () {
    require(typeof offset === 'number');
    require((offset % 1) < 0.01);  // does not have decimal places
    requirePosition(cur, "cursor is not a position object");
    require(typeof tape === 'object');
    require(all(tape, function (v) { return isSymbol(v) || v === undefined; }));
  };

  // take this JSON and trim blank symbols left and right
  this._simplifyJSON = function (j, only_undefined) {
    only_undefined = def(only_undefined, true);
    var empty = function (v) {
      if (only_undefined)
        return v === undefined;
      else
        return (v === undefined || v === j['blank_symbol']);
    };

    while (j['data'].length > 0 && empty(j['data'][0]))
    {
      j['data'].splice(0, 1);
      j['offset'] -= 1;
    }
    while (j['data'].length > 0 && empty(j['data'][j['data'].length - 1]))
    {
      j['data'].pop();
    }
  };

  // @method Tape.getBlankSymbol: returns blank symbol
  this.getBlankSymbol = function () {
    return blank_symbol;
  };

  // @method Tape.setBlankSymbol: get blank symbol
  this.setBlankSymbol = function (val) {
    requireSymbol(val);
    require(typeof val.toJSON() !== 'undefined',   // disallowed value
      "undefined must not be used as blank symbol");
    blank_symbol = val;
  };

  // @method Tape.clear: Clear values of this tape
  this.clear = function () {
    offset = 0;
    cur = position(0);
    tape = [];
    min = 0;
    max = 0;
  };

  // @method Tape.begin: Get smallest Position at Tape ever accessed
  this.begin = function () {
    return position(min);
  };

  // @method Tape.end: Get largest Position at Tape ever accessed
  this.end = function () {
    return position(max);
  };

  // @method Tape.left: Go left at tape
  this.left = function (positions) {
    cur = cur.sub(def(positions, 1));
    if (cur.index < min)
      min = cur.index;
  };

  // @method Tape.right: Go right at tape
  this.right = function (positions) {
    cur = cur.add(def(positions, 1));
    if (cur.index > max)
      max = cur.index;
  };

  // @method Tape.moveTo: Move to the given position
  this.moveTo = function (pos) {
    requirePosition(pos);
    cur = pos;

    if (cur.index > max)
      max = cur.index;
    if (cur.index < min)
      min = cur.index;
  };

  // @method Tape.write: Write value to tape at current cursor position
  this.write = function (value) {
    requireSymbol(value);
    do {
      var idx = this._cursorIndex();
      if (0 <= idx && idx < tape.length) {
        tape[idx] = value;
        break;
      } else if (idx < 0) {
        tape.splice(0, 0, undefined);
        offset += 1;
      } else {
        tape.push(undefined);
      }
    } while (true);
    this._testInvariants();
  };

  // @method Tape.read: Return `count` values at given position `pos`
  //   if `count` = 1 (default), then the value is returned directly
  //   otherwise an array of `count` elements is returned where
  //   `pos` is at math.floor(return_value.length / 2);
  this.read = function (pos, count) {
    count = def(count, 1);
    require(count >= 1);
    pos = def(pos, position(cur));
    requirePosition(pos);
    this._testInvariants();

    if (pos.index > max)
      max = pos.index;
    if (pos.index < min)
      min = pos.index;

    var norm = function (v) {
      return (v === undefined) ? blank_symbol : v;
    };

    if (count === 1) {
      return norm(this._get(pos));
    } else {
      var values = [];
      for (var i = -Math.floor(count / 2); i <= Math.floor((count - 1) / 2); i++)
        values.push(norm(this._get(pos.add(i))));
      require(values.length === count, "Length must match");
      return values;
    }
  };

  // @method Tape.length: count positions between smallest non-blank
  //                      and largest non-blank symbol
  this.size = function () {
    return tape.length;
  };

  // @method Tape.equals: Tape equivalence
  //  If ignore_blanks, consider the blank symbol and undefined as the same symbol
  //  If ignore_cursor, cursor position does not matter
  this.equals = function (other, ignore_blanks, ignore_cursor) {
    ignore_blanks = def(ignore_blanks, true);
    ignore_cursor = def(ignore_cursor, false);

    if (!other.isTape)
      throw new AssertionException("Can only compare tape with tape");

    if (!other.getBlankSymbol().equals(this.getBlankSymbol()))
      return false; // because are certainly some indices with different values

    var my_json = this.toJSON();
    var other_json = other.toJSON();

    var normVal = function (v, blank) {
      if (!ignore_blanks)
        return v;
      if (v === blank)
        return blank;
      else
        return v;
    };

    var getByIndex = function (json, i) {
      if (i < 0 || i >= json['data'].length)
        return json['blank_symbol'];
      return normVal(json['data'][i], json['blank_symbol']);
    };
    var getMyByIndex = function (i) {
      return getByIndex(my_json, i);
    };
    var getOtherByIndex = function (i) {
      return getByIndex(other_json, i);
    };

    var getByPos = function (json, i) {
      var index = json['cursor'] + json['offset'];
      return getByIndex(json, index);
    };
    var getMyByPos = function (i) {
      return getByPos(my_json, i);
    };
    var getOtherByPos = function (i) {
      return getByPos(other_json, i);
    };

    var compare = function (my, oth) {
      if (!ignore_cursor && my['cursor'] !== oth['cursor'])
        return false;
      var begin1 = 0 - my['offset'];
      var begin2 = 0 - oth['offset'];
      var end1 = my['data'].length - 1 - my['offset'];
      var end2 = oth['data'].length - 1 - oth['offset'];
      for (var p = Math.min(begin1, begin2); p < Math.max(end1, end2); p++)
        if (getMyByPos(p) !== getOtherByPos(p))
          return false;
      return true;
    };

    return compare(my_json, other_json);
  };

  // @method Tape.fromHumanString: Human-readable representation of Tape
  this.fromHumanString = function (str, symbol_norm_fn) {
    symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
    this.clear();

    var cursor_index = undefined;
    var parts = str.split(/\s*,\s*/);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i][0] === '*' && parts[i][parts[i].length - 1] === '*') {
        cursor_index = i;
        parts[i] = parts[i].slice(1, parts[i].length - 1);
      }

      this.write(symbol(parts[i], symbol_norm_fn));
      if (i !== parts.length - 1)
        this.right();
    }

    if (cursor_index !== undefined)
      cur = position(cursor_index);
  };

  // @method Tape.toHumanString: Human-readable representation of Tape
  this.toHumanString = function () {
    var dump = this.toJSON();

    var data = dump['data'];
    var cursor_index = dump['cursor'] + dump['offset'];

    // left-strip blank symbols
    while (data.length > 0 && data[0] === dump['blank_symbol']
      && cursor_index > 0)
    {
      data = data.slice(1);
      cursor_index -= 1;
    }

    // extend such that cursor is certainly inside data
    while (cursor_index < 0) {
      data.splice(0, 0, dump["blank_symbol"]);
      cursor_index += 1;
    }
    while (cursor_index >= data.length) {
      data.push(dump["blank_symbol"]);
    }

    data = data.map(function (v) {
      if (v === null || v === undefined)
        return "" + dump['blank_symbol'];
      else
        return toStr(v);
    });
    data[cursor_index] = "*" + data[cursor_index] + "*";
    return data.join(", ");
  };

  // @method Tape.fromJSON: Import Tape data
  // @example
  //   fromJSON({'data': [], 'cursor':0, 'blank_symbol':'0', 'offset': 3})
  this.fromJSON = function (data, symbol_norm_fn) {
    if (typeof data['data'] === 'undefined' ||
        typeof data['cursor'] === 'undefined')
      throw new SyntaxException(
        "Cannot import tape from JSON. " +
        "JSON incomplete (data or cursor missing)."
      );

    this._simplifyJSON(data, true);

    // default values
    symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
    if (data['blank_symbol']) {
      blank_symbol = def(data['blank_symbol'], generic_blank_symbol);
      blank_symbol = symbol(blank_symbol, symbol_norm_fn);
    }
    requireSymbol(blank_symbol);

    offset = def(data['offset'], 0);
    require(offset >= 0);

    cur = position(data['cursor']);
    requirePosition(cur);

    tape = data['data'].map(function (v) {
      return (v === null || v === undefined)
        ? undefined
        : symbol(v, symbol_norm_fn);
    });

    min = -offset;
    max = tape.length - 1 - offset;

    this._testInvariants();
  };

  // @method Tape.toJSON: Return JSON representation of Tape
  this.toJSON = function () {
    return {
      blank_symbol : blank_symbol.toJSON(),
      offset : offset,
      cursor : cur.toJSON(),
      data : tape.map(toJson)
    };
  };

  this.cursor = function () {
    return cur;
  };

  this.isTape = true;

  this._testInvariants();
}

// ----------------------------- RecordedTape -----------------------------

function defaultRecordedTape(symbol_norm_fn) {
  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
  return new RecordedTape(symbol(generic_blank_symbol, symbol_norm_fn));
}

// @object RecordedTape: A tape with a history (can restore old states).
// invariant: RecordedTape provides a superset API of Tape

// A Tape which also provides a history with the undo and snapshot methods.
// The state is stored whenever method 'snapshot' is called.
// In other words: it can revert back to previous snapshots using 'undo'.
function RecordedTape(blank_symbol, history_size)
{
  // @member RecordedTape.history_size
  history_size = def(history_size, Infinity);
  if (history_size !== Infinity)
    history_size = parseInt(def(history_size, 10));
  require(!isNaN(history_size), "History size must be integer");

  // @member RecordedTape.history
  // Array of humantapes. One string per snapshot. Stores all actions.
  var history = [[]];

  // @member RecordedTape.simple_tape
  var simple_tape = inherit(Tape, this, arguments);

  // @member RecordedTape.logging
  var logging = true;

  // General overview for instruction set:
  //    going $x pos left     -> [-$x]
  //    going $x pos right    -> [$x]
  //    overwrite $x with $y  -> ['w', $x, $y]

  // @method RecordedTape._oppositeInstruction: Get opposite instruction
  this._oppositeInstruction = function (ins) {
    if (ins[0] === 'w')
      return ["w", ins[2], ins[1]];
    else if (isNaN(parseInt(ins[0])))
      throw AssertionException("Unknown VM instruction");
    else if (ins[0] === 0)
      return [0];
    else
      return [-ins[0]];
  };

  // @method RecordedTape._applyInstruction: Run an instruction
  //         This method runs the instruction given
  this._applyInstruction = function (ins) {
    if (ins[0] === "w")
      write(ins[1], ins[2]);
    else if (typeof ins === 'number' && ins[0] < 0)
      left(-ins[0]);
    else if (typeof ins === 'number' && ins[0] > 0)
      right(ins[0]);
    else if (typeof ins === 'number' && ins[0] === 0)
      {}
    else
      throw AssertionException("Unknown instruction");
  };

  // @method RecordedTape._applyNativeInstruction: Run instruction natively
  //         This method runs the instructions when jumping around in history
  this._applyNativeInstruction = function (ins) {
    if (ins[0] === 'w')
      simple_tape.write(ins[2]);
    else if (typeof ins[0] === 'number' && ins[0] < 0)
      simple_tape.left(-ins[0]);
    else if (typeof ins[0] === 'number' && ins[0] > 0)
      simple_tape.right(ins[0]);
    else if (typeof ins[0] === 'number' && ins[0] === 0)
      {}
    else
      throw AssertionException("Unknown instruction");
  };

  // @method RecordedTape._undoOneSnapshot: Undo all actions of latest snapshot
  this._undoOneSnapshot = function (frame) {
    var ops = [];
    for (var i = frame.length - 1; i >= 0; i--) {
      var undo = this._oppositeInstruction(frame[i]);
      this._applyNativeInstruction(undo);
      ops.push(undo);
    }
    return ops;
  };

  // @method RecordedTape.resizeHistory: Shorten history if necessary
  this._resizeHistory = function (size) {
    if (size === Infinity)
      return;
    if (size <= 0)
      return;
    history = history.slice(-size, history.length);
  };

  // @method RecordedTape.enableLogging: Enable logging of actions
  this.enableLogging = function () {
    logging = true;
  };

  // @method RecordedTape.disableLogging: Disable logging of actions
  this.disableLogging = function () {
    logging = false;
  };

  // @method RecordedTape.getHistorySize: returns history_size
  this.getHistorySize = function () {
    return history_size;
  };

  // @method RecordedTape.setHistorySize: get history_size
  this.setHistorySize = function (val) {
    if (val === Infinity)
      val = Infinity;
    else if (!isNaN(parseInt(val)))
      val = parseInt(val);
    else
      throw AssertionException("setHistorySize only accept inf or num");

    simple_tape.setHistorySize(val);
    simple_tape.setBlankSymbol(val);
  };

  // @method RecordedTape.getHistory: Return the stored history
  this.getHistory = function () {
    return history;
  };

  // @method RecordedTape.clearHistory: Clear the history of this tape
  this.clearHistory = function () {
    history = [[]];
  };

  // @method RecordedTape.clear: Clear values of the tape and its history
  this.clear = function () {
    this.clearHistory();
    simple_tape.clear();
  };

  // @method RecordedTape.left: Go left.
  this.left = function (positions) {
    positions = def(positions, 1);
    require(!isNaN(parseInt(positions)));
    history[history.length - 1].push([-positions]);
    this._resizeHistory(history_size);
    simple_tape.left(positions);
  };

  // @method RecordedTape.right: Go right.
  this.right = function (positions) {
    positions = def(positions, 1);
    require(!isNaN(parseInt(positions)));
    history[history.length - 1].push([positions]);
    this._resizeHistory(history_size);
    simple_tape.right(positions);
  };

  // @method RecordedTape.write: Write a value to tape.
  this.write = function (new_value, old_value) {
    old_value = def(old_value, simple_tape.read());
    history[history.length - 1].push(['w', old_value, new_value]);
    this._resizeHistory(history_size);
    simple_tape.write(new_value);
  };

  // @method RecordedTape.undo: Go back to last snapshot.
  //   Returns reversed operations.
  this.undo = function () {
    if (history.length === 1 && history[0].length === 0)
      throw new OutOfHistoryException("Tape history under the limit");

    var frame = history.pop();
    return this._undoOneSnapshot(frame);
  };

  // @method RecordedTape.snapshot: Take a snapshot.
  this.snapshot = function () {
    var last = history.length - 1;
    history.push([]);
    this._resizeHistory(history_size);
  };

  // @method RecordedTape.toString: Return string representation of RecordedTape
  this.toString = function () {
    return simple_tape.toHumanString(false);
  };

  // @method RecordedTape.toJSON: Return JSON representation of RecordedTape
  this.toJSON = function (export_history) {
    var data = simple_tape.toJSON();

    export_history = def(export_history, true);
    if (!export_history)
      return data;

    data['history'] = deepCopy(history);
    if (history_size === Infinity)
      data['history_size'] = null;
    else
      data['history_size'] = history_size;

    return data;
  };

  // @method RecordedTape.fromJSON: Import RecordedTape data
  // @example
  //   fromJSON({'data': [], 'cursor':0, 'blank_symbol':'0',
  //     'offset': 3, 'history': [], 'history_size': 0})
  this.fromJSON = function (data) {
    this.clearHistory();
    if (typeof data['history'] !== 'undefined')
      if (data['history'].length > 0)
        history = data['history'];
      else
        history = [[]];
    if (typeof data['history_size'] !== 'undefined')
      if (data['history_size'] === null)
        history_size = Infinity;
      else {
        history_size = parseInt(data['history_size']);
        require(!isNaN(history_size));
      }
    this._resizeHistory(history_size);
    delete data['history_size'];
    delete data['history'];

    return simple_tape.fromJSON(data);
  };

  this.isRecordedTape = true;
}

// ----------------------------- ExtendedTape -----------------------------

function defaultExtendedTape(symbol_norm_fn) {
  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
  return new ExtendedTape(symbol(generic_blank_symbol, symbol_norm_fn));
}

// @object ExtendedTape: An extension of Tape with additional features.
// invariant: ExtendedTape provides a superset API of RecordedTape

function ExtendedTape(blank_symbol, history_size)
{
  // @member ExtendedTape.rec_tape
  var rec_tape = inherit(RecordedTape, this, arguments);

  // @method ExtendedTape.move: Move 1 step in some specified direction
  this.move = function (move) {
    requireMotion(move);

    if (move.equals(mot.RIGHT))
      rec_tape.right();
    else if (move.equals(mot.LEFT))
      rec_tape.left();
    else if (move.equals(mot.STOP) || move.equals(mot.HALT)) {
      // nothing.
    } else
      throw AssertionException("Unknown motion '" + move.toString() + "'");
  };

  // @method ExtendedTape.forEach: Apply f for each element at the tape
  //   f is called as func(pos, val) from begin() to end()
  this.forEach = function (func) {
    var base = rec_tape.cursor();
    rec_tape.moveTo(rec_tape.begin());

    while (!rec_tape.cursor().equals(rec_tape.end())) {
      func(rec_tape.cursor(), rec_tape.read());
      rec_tape.right();
    }
    func(rec_tape.cursor(), rec_tape.read());

    rec_tape.moveTo(base);
  };

  // @method ExtendedTape.getAlphabet: Get alphabet of current Tape
  //         alphabet = OrderedSet of normalized characters at tape
  this.getAlphabet = function () {
    var values = new OrderedSet();

    // remove duplicate entries
    forEach(function (pos, element) {
      values.push(element.toJSON());
    });

    return values;
  };

  this.isExtendedTape = true;
}

// --------------------------- UserFriendlyTape ---------------------------

function defaultUserFriendlyTape(symbol_norm_fn) {
  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
  return new UserFriendlyTape(symbol(generic_blank_symbol), 5);
}

// @object UserFriendlyTape: Tape adding awkward & special but handy methods.
// invariant: UserFriendlyTape provides a superset API of ExtendedTape

function UserFriendlyTape(blank_symbol, history_size)
{
  // @method UserFriendlyTape.ext_tape
  var rec_tape = inherit(ExtendedTape, this, arguments);

  // @method UserFriendlyTape.setByString
  // Clear tape, store values of `array` from left to right starting with
  // position 0. Go back to position 0.
  this.fromArray = function (array, symbol_norm_fn) {
    symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);

    rec_tape.clear();
    rec_tape.moveTo(position(0));
    for (var i = 0; i < array.length; i++) {
      rec_tape.write(symbol(array[i]));
      rec_tape.right();
    }
    rec_tape.moveTo(position(0));
  };

  // @method UserFriendlyTape.readBinaryValue
  //   Assume that the tape only contains values 0 and 1.
  //   Consider this value as binary value and return
  //     [binary value as number, bitstring, number of bits]
  //   if anything fails, return null
  this.readBinaryValue = function () {
    var values = [];
    ext_tape.forEach(function (pos, val) {
      values.push(val);
    });
    var binstring = '';
    for (var i = 0; i < values.length; i++) {
      var val = ("" + values[i]).strip();
      if (val !== '0' && val !== '1')
        return false;
      else
        binstring += val;
    }
    var num = parseInt(binstring.split('').reverse().join(''), 2);
    return [num, binstring, values.length];
  };

  this.isUserFriendlyTape = true;
}

// -------------------------------- Machine -------------------------------

function defaultTuringMachine(symbol_norm_fn, state_norm_fn) {
  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
  state_norm_fn = def(state_norm_fn, normalizeState);

  var s = function (v) { return state(v, state_norm_fn) };
  return new TuringMachine(defaultProgram(),
    defaultUserFriendlyTape(symbol_norm_fn),
    [s("End"), s("Ende")], s("Start"));
}

// @object TuringMachine: Putting together Program, Tape and state handling.
// This is the actual Turingmachine abstraction.

function TuringMachine(program, tape, final_states, initial_state)
{
  // @member TuringMachine.program
  require(typeof program !== 'undefined', 'TuringMachine requires Program');

  // @member TuringMachine.tape
  require(typeof tape !== 'undefined', 'TuringMachine requires some Tape');
  require(tape.isTape);

  // @member TuringMachine.final_states
  require(final_states.length > 0);
  for (var key in final_states)
    requireState(final_states[key]);

  // @member TuringMachine.initial_state
  requireState(initial_state);

  // @member TuringMachine.initial_tape
  var initial_tape = tape.toJSON();

  // @member TuringMachine.state_history
  var state_history = [initial_state];

  // @member TuringMachine.name
  var _names = ['Dolores', 'Aileen', 'Margarette', 'Donn', 'Alyce', 'Buck',
    'Walter', 'Malik', 'Chantelle', 'Ronni', 'Will', 'Julian', 'Cesar',
    'Hyun', 'Porter', 'Herta', 'Kenyatta', 'Tajuana', 'Marvel', 'Sadye',
    'Terresa', 'Kathryne', 'Madelene', 'Nicole', 'Quintin', 'Joline',
    'Brady', 'Luciano', 'Turing', 'Marylouise', 'Sharita', 'Mora',
    'Georgene', 'Madalene', 'Iluminada', 'Blaine', 'Louann', 'Krissy',
    'Leeanna', 'Mireya', 'Refugio', 'Glenn', 'Heather', 'Destiny',
    'Billy', 'Shanika', 'Franklin', 'Shaunte', 'Dirk', 'Elba'];
  var name = _names[parseInt(Math.random() * (_names.length))] + ' ' +
    new Date().toISOString().slice(0, 10);

  // @member TuringMachine.step_id
  var step_id = 0;

  // NOTE tm state changed

  // @method TuringMachine.getProgram: Getter for Program instance
  // @method TuringMachine.setProgram: Setter for Program instance
  this.getProgram = function () { return program; };
  this.setProgram = function (p) {
    program = p;
    // NOTE tm state changed
  };

  // @method TuringMachine.getTape: Getter for Tape instance
  // @method TuringMachine.setTape: Setter for Tape instance
  this.getTape = function () { return tape; };
  this.setTape = function(t) {
    tape = t;
    // NOTE tm state changed
  };

  // @method TuringMachine.getInitialTape: Getter for initial tape as JSON
  this.getInitialTape = function () { return deepCopy(initial_tape); };
  this.setInitialTape = function (t) {
    require(typeof t.data.length !== 'undefined');
    initial_tape = t;
    // NOTE tm state changed
  };

  // @method TuringMachine.isAFinalState: Is the given state a final state?
  this.isAFinalState = function (st) {
    requireState(st);
    for (var i = 0; i < final_states.length; i++)
      if (final_states[i].equals(st))
        return true;
    return false;
  };

  // @method TuringMachine.getFinalStates: Getter for final states
  this.getFinalStates = function () {
    return final_states;
  };

  // @method TuringMachine.addFinalState
  this.addFinalState = function (state) {
    requireState(state);
    final_states.push(state);
    // NOTE tm state changed
  };

  // @method TuringMachine.setFinalStates
  this.setFinalStates = function (states) {
    for (var k in states)
      require(isState(states[k]),
        "Cannot add non-State object as final state");
    final_states = states;
    // NOTE tm state changed
  };

  // @method TuringMachine.getInitialState: Get initial state
  this.getInitialState = function () {
    if (state_history.length === 0)
      throw AssertionException("No state assigned to machine");
    return state_history[0];
  };

  // @method TuringMachine.setInitialState: Set initial state
  this.setInitialState = function (st) {
    require(isState(st), "Initial state must be state object");
    require(state_history.length === 1, "state history must be at least 1 element long");
    state_history[0] = st;
    // NOTE tm state changed
  };

  // @method TuringMachine.getState: Get current state
  this.getState = function () {
    if (state_history.length === 0)
      throw AssertionException("No state assigned to machine");
    return state_history[state_history.length - 1];
  };

  // @method TuringMachine.setState: Set current state
  this.setState = function (st) {
    if (isState(st))
      state_history = [st];
    else
      state_history = [state(st)];
    // NOTE tm state changed
  };

  // @method TuringMachine.getCursor: Return the current cursor Position
  this.getCursor = function () {
    return tape.cursor();
  };

  // @method TuringMachine.getStep: Get number of operations performed so far
  this.getStep = function () {
    return step_id;
  };

  // @method TuringMachine.getMachineName: Return the machine name
  this.getMachineName = function () {
    return name;
  };

  // @method TuringMachine.setMachineName: Give the machine a specific name
  this.setMachineName = function (machine_name) {
    name = machine_name;
    // NOTE tm state changed
  };

  // @method TuringMachine.finalStateReached: Is the current state a final state?
  this.finalStateReached = function () {
    return this.isAFinalState(this.getState());
  };

  // @method TuringMachine.undefinedInstruction
  //   Does the current (symbol, state) not have an corresponding instruction?
  this.undefinedInstruction = function () {
    return !program.exists(tape.read(), this.getState());
  };

  // @method TuringMachine.finished: Was a final state reached or
  //   was some instruction not found?
  this.finished = function () {
    return this.finalStateReached() || this.undefinedInstruction();
  };

  // @method TuringMachine.back: Undo last `steps` operation(s)
  this._back = function () {
    var outofhistory = function (e) {
      if (e === undefined || e.name === "OutOfHistoryException")
        throw new OutOfHistoryException(this.getStep());
    };

    // basic checks
    if (step_id <= 0 || state_history.length <= 0)
      outofhistory.call(this);

    // undo state
    var old_state = state_history.pop();
    var new_state = state_history[state_history.length - 1];

    // undo tape
    try {
      var old_value = tape.read();
      var tapeevents = tape.undo();
    } catch (e) {
      console.error(e);
      outofhistory(e);
    }

    // expect as tape events
    //   0-1 write operation
    //   0-1 movement operation of length 1
    //   and nothing else

    var written_value = null;
    var move_undo = null;
    for (var i = 0; i < tapeevents.length; i++) {
      if (written_value === null && tapeevents[i][0] === "w")
        written_value = tapeevents[i][2];
      else if (move_undo === null && tapeevents[i][0] === -1)
        move_undo = mot.RIGHT;
      else if (move_undo === null && tapeevents[i][0] === 1)
        move_undo = mot.LEFT;
      else if (tapeevents[i][0] === 0)
        move_undo = mot.STOP;
      else
        throw new AssertionException("Tape events of history do not "
          + "describe one iteration");
    }

    // undo step_id
    step_id -= 1;

    return [old_value, old_state, written_value, move_undo, new_state,
      step_id, this.undefinedInstruction(), this.finalStateReached()];
  };
  this.back = function (steps) {
    var steps = def(steps, 1);
    var results = [];

    for (var i = 0; i < steps; i++) {
      var result = this._back();
      if (!result)
        return results;
      results.push(result);
    }

    return results;
    // NOTE tm state changed
  };

  // @method TuringMachine.forth: run `steps` step(s)
  this._forth = function () {
    if (this.finalStateReached())
      return false;
    if (this.undefinedInstruction())
      return false;

    require(typeof this.getTape().move !== 'undefined',
      'Tape must support "move" method');

    // save current tape configuration
    if (tape.snapshot)
      tape.snapshot();

    // lookup
    var old_value = tape.read();
    var old_state = this.getState();
    var instr = program.get(old_value, old_state);
    //console.debug(old_value.toString(), old_state.toString());

    if (typeof instr === 'undefined')
      throw new Error("Internal error: could not find instruction, "
        + "but instruction is defined");

    var new_value = instr.write;
    var move = instr.move;
    var new_state = instr.state;
    //console.debug(new_value.toString(), move.toString(), new_state.toString());

    // process write
    tape.write(instr.write);
    var diff = this.getCursor().diff(position(0));

    // process movement
    this.getTape().move(instr.move);

    // process state transition
    var old_state = this.getState();
    state_history.push(instr.state);

    step_id += 1;

    return [old_value, old_state, new_value, move, new_state,
            step_id, this.undefinedInstruction(), this.finalStateReached()];
  };
  this.forth = function (steps) {
    // next `steps` iterations
    steps = def(steps, 1);
    var results = [];

    for (var i = 0; i < steps; i++) {
      var result = this._forth();
      if (!result)
        return false;
      results.push(result);
    }

    return results;
    // NOTE tm state changed
  };

  // @method TuringMachine.reset: Reset machine to initial state
  //   Event listeners are not removed
  this.reset = function () {
    tape.fromJSON(initial_tape);
    state_history = [this.getInitialState()];
    step_id = 0;
    // NOTE tm state changed
  };

  // @method TuringMachine.fromJSON: Import a Machine
  this.fromJSON = function (data) {
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
    if (typeof data['state_history'] !== 'undefined')
      state_history = data['state_history'].map(convState);
    if (typeof data['name'] !== 'undefined')
      name = data['name'];
    if (typeof data['step'] !== 'undefined')
      step_id = parseInt(data['step']);

    require(!isNaN(step_id));
    // NOTE tm state changed
  };

  // @method TuringMachine.toJSON: Get JSON representation
  this.toJSON = function () {
    return {
      program : program.toJSON(),
      tape : tape.toJSON(),
      final_states : final_states.map(toJson),
      initial_state : initial_state.toJSON(),
      initial_tape : initial_tape,
      state_history: state_history.map(toJson),
      name : name,
      step : step_id
    };
  };
};

// ------------------------- LockingTuringMachine -------------------------

var LockingTuringMachine = function (program, tape, final_states, initial_state) {
  var tm = inherit(TuringMachine, this, arguments);

  // @member LockingTuringMachine.is_locked: Locking state of TM
  var is_locked = false;

  // @method LockingTuringMachine.lock: Lock this TM to disable it to run any steps
  this.lock = function () {
    is_locked = true;
  };

  // @method LockingTuringMachine.release:
  //   Release this TM to enable it to run any steps again
  this.release = function () {
    is_locked = false;
  };

  // @method LockingTuringMachine.ĺocked:
  //   Is this turingmachine in a locked state?
  this.locked = function () {
    return is_locked;
  };
}

// ------------------------ RunningTuringMachine --------------------------

var RunningTuringMachine = function (program, tape, final_states, initial_state) {
  var tm = inherit(LockingTuringMachine, this, arguments);

  // @member RunningTuringMachine.running:
  //   positive while turingmachine should still perform next x steps
  var running = 0;
  // @member RunningTuringMachine.running_last_state:
  //   Logs the last state which was recognized as event
  var running_last_state = false;

  // @method RunningTuringMachine._startRun:
  //   Start the run. Called whenever a run starts.
  this._startRun = function () { };

  // @method RunningTuringMachine._stopRun:
  //   Stop the run. Called whenever a run stops.
  this._stopRun = function () { };

  // @method RunningTuringMachine._invokeNextIter:
  //   Perform all check before actually running one iteration
  this._invokeNextIter = function () {
    if (tm.finalStateReached() || tm.undefinedInstruction())
      running = 0;

    if (running === 0 && !running_last_state) {
      return;
    } else if ((running > 1 || running < -1) && !running_last_state) {
      this._startRun();
      running_last_state = true;
    } else if (running === 0 && running_last_state) {
      this._stopRun();
      running_last_state = false;
      return;
    }

    if (running > 0) {
      running -= 1;
      setTimeout(function () {
        // Call once method which is in the prototype of the current context
        this.iterateNext(this._invokeNextIter);
      }.bind(this), 1);

    } else if (running < 0) {
      running += 1;
      setTimeout(function () {
        // Call once method which is in the prototype of the current context
        this.iteratePrevious(this._invokeNextIter);
      }.bind(this), 1);
    }
  };

  // @method RunningTuringMachine.iterateNext:
  //   Wrapper to compute next step
  this.iterateNext = function (done) {
    this.lock();
    console.log("iterateNext() should be overwritten by a children object");
    this.release();
    done.call(this);
  };

  // @method RunningTuringMachine.iteratePrevious:
  //   Wrapper to compute previous step
  this.iteratePrevious = function (done) {
    this.lock();
    console.log("iteratePrevious() should be overwritten by a children object");
    this.release();
    done.call(this);
  };

  // @method RunningTuringMachine.next: Run operations until a final state is reached
  this.next = function (steps) {
    steps = def(steps, 1);
    if (running === Infinity || running === -Infinity) {
      running = steps;
      console.warn("Interrupt running turingmachine for some steps?"
        + " Awkward happening");
      this._invokeNextIter();
      return true;
    } else if (running === 0) {
      running = steps;
      this._invokeNextIter();
      return true;
    } else {
      console.warn("Overwriting request to compute "
        + running + " steps with " + steps + " steps");
      running = steps;
      this._invokeNextIter();
      return false;
    }
  };

  // @method RunningTuringMachine.prev: Undo operations until we run out of history
  this.prev = function (steps) {
    steps = def(steps, 1);
    if (running === Infinity || running === -Infinity) {
      running = steps;
      console.warn("Interrupt running turingmachine for some steps?"
        + " Awkward happening");
      this._invokeNextIter();
      return true;
    } else if (running === 0) {
      running = -steps;   // REMARK this is negative compared to next()
      this._invokeNextIter();
      return true;
    } else {
      console.warn("Overwriting request to compute "
        + running + " steps with " + -steps + " steps");
      running = -steps;
      this._invokeNextIter();
      return false;
    }
  };

  // @method RunningTuringMachine.run: Run operations until a final state is reached
  this.run = function () {
    if (running === Infinity) {
      console.warn("Cannot run running turingmachine");
      return false;
    } else {
      running = Infinity;
      this._invokeNextIter();
      return true;
    }
  };

  // @method RunningTuringMachine.run: Run operations until a final state is reached
  this.interrupt = function () {
    if (running === Infinity) {
      running = 0;
      this._stopRun();
      running_last_state = false;
      return true;
    } else if (running === 0) {
      return false;
    } else {
      running = 0;
      return true;
    }
  };
}

// ------------------------- AnimatedTuringMachine ------------------------

function defaultAnimatedTuringMachine(symbol_norm_fn, state_norm_fn,
  gear_viz, num_viz, ui_tm, ui_meta, ui_data, ui_notes)
{
  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
  state_norm_fn = def(state_norm_fn, normalizeState);

  var s = function (v) { return state(v, state_norm_fn) };

  return new AnimatedTuringMachine(defaultProgram(),
    defaultUserFriendlyTape(symbol_norm_fn),
    [s("End"), s("Ende")], s("Start"), gear_viz, num_viz,
    ui_tm, ui_meta, ui_data, ui_notes);
}

// @object AnimatedTuringMachine: A visualized TuringMachine

var AnimatedTuringMachine = function (program, tape, final_states,
  initial_state, gear, numbers, ui_tm, ui_meta, ui_data, ui_notes)
{
  // @member AnimatedTuringMachine.gear: Animation of gear
  // @member AnimatedTuringMachine.numbers: Animation of numbers

  // TODO: must support any arbitrary number of values to visualize

  ui_tm = $(ui_tm);
  ui_meta = $(ui_meta);
  ui_data = $(ui_data);
  ui_notes = $(ui_notes);

  require(ui_tm.length !== 0, "unknown " + ui_tm.selector);
  require(ui_meta.length !== 0, "unknown " + ui_meta.selector);
  require(ui_data.length !== 0, "unknown " + ui_data.selector);
  require(ui_notes.length !== 0, "unknown " + ui_notes.selector);

  // @member AnimatedTuringMachine.tm: Machine instance
  var tm = inherit(RunningTuringMachine, this, arguments);

  // @member AnimatedTuringMachine.events: Event register
  var events = new EventRegister([
    'loadState', 'valueWritten', 'movementFinished', 'stateUpdated',
    'transitionFinished', 'outOfHistory', 'undefinedInstruction',
    'finalStateReached', 'startRun', 'stopRun'
  ]);

  // @member AnimatedTuringMachine.speed: Animation speed
  var speed = 2000;

  // @member AnimatedTuringMachine.speed_limit: if speed<=speed_limit,
  //   animation behaves like no animation
  var speed_limit = 200;

  // @member AnimatedTuringMachine.animation_enabled: Disable/enable animation
  var animation_enabled = true;

  // @member AnimatedTuringMachine.ui_settings: UI settings
  var ui_settings = {
    'steps_back' : 1,
    'steps_continue' : 1
  };

  // @member AnimatedTuringMachine.self: current instance
  var self = this;

  // @callback loadState(machine name, tape, current state, final states)
  //   [triggered when finished initialization or dump import]
  // @callback valueWritten(old value, new value, position relative to cursor)
  //   [triggered whenever some value on the tape changed]
  // @callback movementFinished(move) [triggered whenever cursor moved]
  // @callback stateUpdated(old state, new state, new state is a final state)
  //   [triggered whenever the current state changed]
  // @callback transitionFinished(old value, old state, new value, movement,
  //   new state, step id, undefined instruction is given for next transition,
  //   a final state has been reached)
  //   [triggered whenever the execution state after some transition has been
  //   reached]
  // @callback outOfHistory(step id) [triggered when running out of history]
  // @callback test_undefinedInstruction(read symbol, state) [triggered whenever some
  //   instruction was not found]
  // @callback test_finalStateReached(state) [triggered whenever some final state
  //   has been reached]
  // @callback startRun() [triggered whenever first transition of a Run]
  // @callback stopRun() [stop running]

  // @member AnimatedTuringMachine.valid_events
  // @member AnimatedTuringMachine.events
  var valid_events = ['loadState', 'valueWritten', 'movementFinished',
    'stateUpdated', 'transitionFinished', 'outOfHistory',
    'test_undefinedInstruction', 'test_finalStateReached', 'startRun', 'stopRun'];
  var events = new EventRegister(valid_events);

  // @method AnimatedTuringMachine.addEventListener: event listener definition
  this.addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method AnimatedTuringMachine.triggerEvent: trigger event
  this.triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method AnimatedTuringMachine._triggerTapeInstruction:
  //   trigger events corresponding to a tape instruction
  this._triggerTapeInstruction = function (ins) {
    if (ins[0] === "w") {
      this.triggerEvent('valueWritten', ins[1], ins[2],
        this.getCursor().diff(position(0)));
    } else if (typeof ins === 'number' && ins[0] < 0) {
      for (var i = 0; i < Math.abs(ins[0]); i++)
        this.triggerEvent('movementFinished', mot.LEFT);
    } else if (typeof ins === 'number' && ins[0] > 0) {
      for (var i = 0; i < ins[0]; i++)
        this.triggerEvent('movementFinished', mot.RIGHT);
    } else if (typeof ins === 'number' && ins[0] === 0)
      {}
    else
      throw AssertionException("Unknown instruction");
  };

  // @method AnimatedTuringMachine._triggerStateUpdated
  this._triggerStateUpdated = function (old_state) {
    this.triggerEvent('stateUpdated', old_state, this.getState(),
      this.isAFinalState(this.getState()));
  };

  // @method AnimatedTuringMachine._triggerTransitionFinished
  this._triggerTransitionFinished = function (old_value, old_state, new_value,
    mov, new_state, step)
  {
    new_value = def(new_value, tape.read());
    mov = def(mov, mot.STOP);
    new_state = def(new_state, this.getState());
    step = def(step, this.getStep());

    this.triggerEvent('transitionFinished', old_value, old_state, new_value,
      mov, new_state, step, undefinedInstruction());
  };

  // @method AnimatedTuringMachine._triggerOutOfHistory
  this._triggerOutOfHistory = function (step) {
    step = def(step, this.getStep());
    this.triggerEvent('outOfHistory', step);
  };

  // @method AnimatedTuringMachine._triggerLoadState
  this._triggerLoadState = function (tap, stat) {
    tap = def(tap, tape.toJSON());
    stat = def(stat, deepCopy(this.getState()));
    step_id = 0;
    this.triggerEvent('loadState', deepCopy(this.getMachineName()),
      deepCopy(tap), stat, deepCopy(this.getFinalStates()));
  };

  // HELPERS

  // @method AnimatedTuringMachine._initialize:
  //   Initialize this turingmachine
  this._initialize = function () {
    self.addEventListener('loadState', function () { self.syncToUI() }.bind(self));
    self.addEventListener('transitionFinished', function () {
      // potentially trigger finalStateReached / undefinedInstruction
      if (self.isAFinalState(self.getState()))
        self.triggerEvent('test_finalStateReached', self.getState().toJSON());
      else if (self.undefinedInstruction())
        self.triggerEvent('test_undefinedInstruction', self.getTape().read().toJSON(),
          self.getState().toJSON());

      // update tape tooltip
      ui_tm.find(".drawings .numbers .value").attr("title", self.getTape().toHumanString());
    });
  };

  // @method AnimatedTuringMachine._triggerLoadState:
  //   trigger loadState event
  this._triggerLoadState = function () {
    this.triggerEvent('loadState',
        this.getMachineName(), this.getTape().toJSON(),
        this.getState(), this.getFinalStates());
  };

  // @method AnimatedTuringMachine._triggerLoadState:
  //   if locked, throw error that TM is locked
  this._lockingCheck = function (action) {
    if (this.locked()) {
      action = def(action, "proceed");
      console.warn("Trying to " + action + " but turing machine is locked");
      console.trace();
      throw new Error("Trying to " + action + " but turing machine is locked");
    }
    return true;
  };

  // @method AnimatedTuringMachine._updateStateInUI: update the state on the UI
  this._updateStateInUI = function (state, is_final, is_undefined, undefined_symbol) {
    require(isState(state));
    require(is_final === true || is_final === false, "is_final must be boolean");
    require(is_undefined === true || is_undefined === false, "is_undefined must be boolean");
    require(!is_undefined || isSymbol(undefined_symbol), "Undefined symbol " + repr(undefined_symbol));

    var element = ui_tm.find(".state");
    var text = state.toJSON();
    var new_size = parseInt((-4.0 / 11) * text.length + 22);
    if (new_size < 12)
      new_size = 12;
    else if (new_size > 20)
      new_size = 20;

    // set text
    element.text(text);

    // set font-size
    element.css("font-size", new_size + "px");

    // reset
    element.removeClass("undefined");
    element.removeClass("final");
    element.attr("title", "");

    if (is_final) {
      element.addClass("final");
      element.attr("title", "Final state " + toStr(state) + " reached");

    } else if (is_undefined) {
      element.addClass("undefined");
      element.attr("title", "No instruction defined for symbol "
        + toStr(undefined_symbol) + " and state " + toStr(state));
    }
  };

  // SETTINGS

  // @method AnimatedTuringMachine.addEventListener: event listener definition
  this.addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method AnimatedTuringMachine.triggerEvent: trigger event
  this.triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method AnimatedTuringMachine.enableAnimation
  this.enableAnimation = function () {
    animation_enabled = true;
  };

  // @method AnimatedTuringMachine.disableAnimation
  this.disableAnimation = function () {
    animation_enabled = false;
  };

  // @method AnimationTuringMachine.isAnimationEnabled
  this.isAnimationEnabled = function () {
    return animation_enabled;
  };

  // @method AnimatedTuringMachine.speedUp: Increase speed
  this.speedUp = function () {
    if (speed <= 200)
      return false;
    speed = parseInt(speed / 1.2);
    gear.setSpeed(speed);
    numbers.setSpeed(speed);
    this.triggerEvent('speedUpdated', speed);
    return true;
  };

  // @method AnimatedTuringMachine.speedDown: Decrease speed
  this.speedDown = function () {
    speed = parseInt(speed * 1.2);
    gear.setSpeed(speed);
    numbers.setSpeed(speed);
    this.triggerEvent('speedUpdated', speed);
    return true;
  };

  // GUI helpers

  // @method AnimatedTuingMachine.alertNote: write note to the UI as user notification
  this.alertNote = function (note_text) {
    var ui_notes = $("#notes");

    note_text = "" + note_text;

    var note = $('<p></p>').addClass("note").text(note_text);
    ui_notes.show();
    ui_notes.append(note);

    setTimeout(function () {
      if (ui_notes.find(".note").length === 1)
        ui_notes.fadeOut(1000);
      note.fadeOut(1000);
      note.remove();
    }, 5000);
  };

  // @method AnimatedTuingMachine.addExampleProgram: add an example program. The program is
  //   defined by program_id and the program is represented in data
  this.addExampleProgram = function (program_id, data) {
    require(program_id && data);

    try {
      var option = $("<option></option>").attr("value", program_id).text(data['title']);
      ui_meta.find(".example option[data-none]").remove();

      var added = false;
      ui_meta.find(".example option").each(function () {
        var old = $(this).text().match(/^(\d+)/);
        var ref = data.title.match(/^(\d+)/);

        if (added)
          return;

        if ((old && ref && parseInt(old[1]) > parseInt(ref[1])) ||
            ($(this).text() > data.title))
        {
          $(this).before(option);
          added = true;
          return;
        }
      });
      if (!added)
        ui_meta.find(".example").append(option);
    } catch (e) {
      console.error(e);
      this.alertNote(e.message);
    }
  };

  // @method AnimatedTuingMachine.updateTestcaseList:
  //   update the list of testcase for this new program
  this.updateTestcaseList = function (_, data) {
    try {
      ui_meta.find(".testcase option").remove();
      if (!data['testcases'] || data['testcases'].length === 0) {
        var option = $("<option></option>").text("no testcase available");
        ui_meta.find(".testcase").append(option);
      }
      else {
        for (var tc = 0; tc < data['testcases'].length; tc++) {
          var o = $("<option></option>").text(data['testcases'][tc]['name']);
          ui_meta.find(".testcase").append(o);
        }
      }

      ui_meta.find(".example option[selected]").prop("selected", false);
      ui_meta.find(".example option").each(function () {
        if ($(this).text() === data['name'])
          $(this).prop("selected", true);
      });
    } catch (e) {
      console.error(e);
      this.alertNote(e.message);
    }
  };

  // @method AnimatedTuingMachine.showRunningControls: show additional (like 'interrupt')
  //   controls when tm is "running"
  this.showRunningControls = function () {
    try {
      ui_tm.find('.controls .interrupt').show();
    } catch (e) {
      console.error(e);
      this.alertNote(e.message);
    }
  };

  // @method AnimatedTuingMachine.hideRunningControls:
  //   hide additional controls when tm has stopped
  this.hideRunningControls = function () {
    try {
      ui_tm.find('.controls .interrupt').hide();
    } catch (e) {
      console.error(e);
      this.alertNote(e.message);
    }
  };

  // @method AnimatedTuingMachine.setDescriptionText: set the marked-up description text
  this.setDescriptionText = function (description) {
    ui_meta.find(".description_text").empty();
    markup(ui_meta.find(".description_text"), description);
  };

  // @method AnimatedTuingMachine.setDescriptionTitle: set the title of the description
  this.setDescriptionTitle = function (title) {
    var m = title.match(/^(\d+) - (.*)$/);
    if (m) {
      ui_meta.find(".description_title").text(m[2]);
      ui_meta.find(".description_title").attr("title", "with difficulty " + m[1]);
    } else {
      ui_meta.find(".description_title").text(title);
      ui_meta.find(".description_title").attr("title", '');
    }
  };

  // @method AnimatedTuingMachine.setVersion: set the version identifier for the program
  this.setVersion = function (version) {
    ui_meta.find(".description_version span").text(version);
  };

  // @method AnimatedTuingMachine.verifyUIsync: Verify that UI and TM are synchronized
  this.verifyUIsync = function () {
    // verify animation state
    var anen = !ui_tm.find("input[name='wo_animation']").is(":checked");
    require(app.tm().isAnimationEnabled() === anen);

    // verify numbers
    var ui_vals = app.tm().getNumbersFromUI();
    var tm_vals = app.tm().getTape().read(undefined, 7).map(toJson).map(toStr); // TODO non-static 7

    require(ui_vals.length === tm_vals.length);
    for (var i = 0; i < ui_vals.length; i++)
      require(ui_vals[i] === tm_vals[i]);

    // verify state
    require(toStr(toJson(app.tm().getState())) === ui_tm.find(".state").text());

    // ignore steps count

    // verify machine name
    require(app.tm().getMachineName() === ui_meta.find(".machine_name").val());

    // verify 'Load tape'
    var ui_tape = ui_data.find(".tape").val();
    var tm_tape = app.tm().getTape().toHumanString();
    // REMARK this is not a well-defined equality. Damn it.
    require(ui_tape === tm_tape);

    // verify 'Final states'
    var fs_string = ui_data.find(".final_states").val();
    var ui_final_states = fs_string.split(/\s*,\s*/)
        .map(function (s) { return state(s); });  // TODO: normalization function missing
    var tm_final_states = app.tm().getFinalStates();

    require(ui_final_states.length === tm_final_states.length);
    for (var i = 0; i < ui_final_states.length; i++)
      require(ui_final_states[i].equals(tm_final_states[i]));

    // verify 'transition table'
    //throw new Error("TODO");
  };

  // @function AnimatedTuringMachine.readTransitionTable:
  //   read the whole content of the UI transition table
  this.readTransitionTable = function () {
    var data = [];
    ui_data.find(".transition_table tbody tr").each(function () {
      var row = [];
      row.push($(this).find(".tt_read").val());
      row.push($(this).find(".tt_from").val());
      var to = [];
      to.push($(this).find(".tt_write").val());
      to.push($(this).find(".tt_move").val());
      to.push($(this).find(".tt_to").val());
      row.push(to);

      if (row[0] === '' && row[1] === '' && row[2][0] === '' &&
        row[2][1] === 'Stop' && row[2][2] === '')
        return;

      data.push(row);
    });
    return data;
  };

  // @function AnimatedTuringMachine.addNewTransitionTableRow:
  //   append a new empty row to the transition table
  this.addNewTransitionTableRow = function () {
    var last = ui_data.find(".transition_table tbody tr").last().clone();
    last.removeClass("nondeterministic deterministic");
    last.appendTo(".transition_table tbody");
    this.writeTransitionTableRow();
  };

  // @function AnimatedTuringMachine.writeTransitionTableRow:
  //   write given vals (default: empty) to a transition table row (default: last)
  this.writeTransitionTableRow = function (vals, row) {
    vals = def(vals, ['', '', ['', 'Stop', '']]);
    row = def(row, ui_data.find(".transition_table tbody tr").last());
    require(vals.length === 3);

    row.find(".tt_read").val(vals[0]);
    row.find(".tt_from").val(vals[1]);
    row.find(".tt_write").val(vals[2][0]);
    row.find(".tt_move").val(vals[2][1]);
    row.find(".tt_to").val(vals[2][2]);
  };

  // @function AnimatedTuringMachine.isLastTransitionTableRowEmpty:
  //   is the last transition table row empty?
  this.isLastTransitionTableRowEmpty = function () {
    var last = ui_data.find(".transition_table tbody tr").last();
    return last.find(".tt_read").val() === '' &&
           last.find(".tt_from").val() === '' &&
           last.find(".tt_write").val() === '' &&
           last.find(".tt_move").val() === 'Stop' &&
           last.find(".tt_to").val() === '';
  };

  // @function AnimatedTuringMachine.clearTransitionTableRows:
  //   remove all rows from the transition table and keep one empty one
  this.clearTransitionTableRows = function () {
    ui_data.find(".transition_table tbody tr").slice(1).remove();
    ui_data.find(".transition_table tbody td").each(function () {
      $(this).find(".tt_read, .tt_from, .tt_write, .tt_to").val("");
      $(this).find(".tt_move").val("Stop");
    });
  };

  // API

  // @method AnimatedTuringMachine.initializeGUI:
  //   attach events to methods of this instance
  this.initializeGUI = function () {
    this.addEventListener('startRun', function () { self.showRunningControls(); });
    this.addEventListener('stopRun', function () { self.hideRunningControls(); });

    // UI events
    /// UI events - controls
    ui_tm.find(".control_next").click(function () {
      try {
        var how_many_steps = parseInt(ui_tm.find(".steps_next").val());
        if (isNaN(how_many_steps)) {
          self.alertNote("Invalid steps count given. Assuming 1.");
          how_many_steps = 1;
        }
        self.next(how_many_steps);
      } catch (e) {
        self.alertNote(e.message);
      }
    });
    ui_tm.find(".control_prev").click(function () {
      try {
        var how_many_steps = parseInt(ui_tm.find(".steps_prev").val());
        if (isNaN(how_many_steps)) {
          self.alertNote("Invalid steps count given. Assuming 1.");
          how_many_steps = 1;
        }
        self.prev(how_many_steps);
      } catch (e) {
        self.alertNote(e.message);
      }
    });
    ui_tm.find(".control_slower").click(function () {
      try {
        if (self.speedDown())
          self.alertNote("Animation speed updated");
        else
          self.alertNote("I think this is slow enough. Sorry!");
      } catch (e) {
        self.alertNote(e.message);
      }
    });
    ui_tm.find(".control_faster").click(function () {
      try {
        if (self.speedUp())
          self.alertNote("Animation speed updated");
        else
          self.alertNote("I think this is fast enough. Sorry!");
      } catch (e) {
        self.alertNote(e.message);
      }
    });
    ui_tm.find(".control_reset").click(function () {
      try {
        self.reset();
      } catch (e) {
        self.alertNote(e.message);
      }
    });
    ui_tm.find(".control_run").click(function () {
      try {
        if (!self.run(ui_tm, tm))
          self.alertNote("Could not start run of turingmachine. Is it running already?");
      } catch (e) {
        self.alertNote(e.message);
      }
    });
    ui_tm.find(".control_interrupt").click(function () {
      try {
        if (!self.interrupt(ui_tm, tm))
          self.alertNote("Could not interrupt. It is not running.");
      } catch (e) {
        self.alertNote(e.message);
      }
    });

    ui_tm.find("input[name=wo_animation]").change(function () {
      try {
        if ($(this).is(":checked")) {
          self.disableAnimation();
          self.alertNote("Turning off animations");
        } else {
          self.enableAnimation();
          self.alertNote("Turning on animations");
        }
      } catch (e) {
        self.alertNote(e.message);
      }
    });

    /// UI events - overlay, import, export
    var toggle_overlay = function () {
      try {
        if (!$("#overlay").is(':visible')) {
          $("#overlay").show(100);
          $("#overlay_text").delay(150).show(400);
        } else {
          $("#overlay").delay(200).hide(100);
          $("#overlay_text").hide(200);
        }
      } catch (e) {
        self.alertNote(e.message);
      }
    };
    var export_tm = function (format) {
      var text;
      if (format === "json")
        text = JSON.stringify(self.toJSON());
      else
        text = foswiki.write(self);
      $("#overlay_text .data").val("" + text);
    };
    var import_tm = function (text, format) {
      require(!!text, "text must not be empty");

      // read data
      var data;
      try {
        if (format === "json")
          data = JSON.parse(text);
        else
          // TODO: normalization functions as parameter: symbol_norm_fn, state_norm_fn
          data = foswiki.read(self, text);
        self.alertNote("Input data parsed. Continue with import.");
      } catch (e) {
        self.alertNote("Failed to parse given input: " + e.message
          + ". Import aborted.");
        if (format === "json" && text.substr(0, 7) === "   $ __")
          self.alertNote("Seems to be Foswiki syntax. Please select Foswiki.");
        if (format === "foswiki" && text.substr(0, 2) === '{"')
          self.alertNote("Seems to be JSON syntax. Please select JSON.");
        console.debug(e);
        return;
      }

      // try to import it
      try {
        if (data)
          app.tm().fromJSON(data);
        app.tm().syncToUI();
        self.alertNote("Import of " + format + " succeeded.");
      } catch (e) {
        self.alertNote("Import failed. Seems like invalid data was provided.");
        console.debug(e);
        return;
      }
    };


    $("#overlay").click(toggle_overlay);

    ui_tm.find(".import_button").click(function () {
      try {
        toggle_overlay();

        $("#overlay_text .action").text("Import");
        $("#overlay_text .data").attr("readonly", false).val("");
        $("#overlay_text .import").show();
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });
    $("#overlay_text .import").click(function () {
      try {
        var data = $("#overlay_text .data").val();
        var format = $("#overlay_text .export_format").val();
        import_tm(data, format);
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });

    ui_tm.find(".export_button").click(function () {
      try {
        toggle_overlay();

        $("#overlay_text .action").text("Export");
        $("#overlay_text .data").attr("readonly", true);
        $("#overlay_text .import").hide();

        export_tm($("#overlay_text").find(".export_format").val());
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });
    $("#overlay_text .export_format").change(function () {
      try {
        var is_export = $("#overlay_text .action").text().indexOf("Export") !== -1;
        if (is_export)
          export_tm($("#overlay_text").find(".export_format").val());
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });

    /// UI events - meta
    ui_meta.find(".machine_name").change(function () {
      try {
        var new_name = ui_meta.find(".machine_name").val().trim();
        self.setMachineName(new_name);

        self.alertNote("Machine name updated to '" + new_name + "'!");
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });

    /// UI events - data
    ui_data.find(".tape_load").click(function () {
      try {
        self.getTape().fromHumanString(ui_data.find(".tape").val());
        self.setInitialTape(self.getTape().toJSON());
        self.syncToUI();

        self.alertNote("Tape updated!");
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });

    ui_data.find(".final_states_load").click(function () {
      try {
        var fs_string = ui_data.find(".final_states").val();
        var ui_fs = fs_string.split(/\s*,\s*/).filter(function (v) { return !!v });
        // TODO: normalization function missing:
        var fs = ui_fs.map(function (s) { return state(s); });

        self.setFinalStates(fs);
        self._updateStateInUI(self.getState(), self.finalStateReached(),
          self.undefinedInstruction(), self.getTape().read());

        if (fs.length === 0)
          self.alertNote("No final states? This won't play nicely");
        else if (fs.length === 1)
          self.alertNote("Final state '" + ui_fs[0] + "' set");
        else if (fs.length > 1)
          self.alertNote("Final states '" + ui_fs.slice(0, -1).join("', '")
            + "' and '" + ui_fs[ui_fs.length - 1] + "' set");
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });

    ui_data.find(".copy_last_line").click(function () {
      try {
        var rows = self.readTransitionTable();
        var row = rows[rows.length - 1];

        self.addNewTransitionTableRow();
        var prelast = ui_data.find(".transition_table tbody tr").eq(-2);
        self.writeTransitionTableRow(row, prelast);
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });

    $(document).on("change", ".transition_table", function () {
      try {
        // if (!last row empty) add new row
        if (!self.isLastTransitionTableRowEmpty())
          self.addNewTransitionTableRow();

        // if (final state used) warn user that it won't execute
        var row = 0;
        $(this).find("tbody tr").each(function () {
          var state_name = $(this).find(".tt_from").val();
          if (self.isAFinalState(state(state_name))) {
            self.alertNote("Line " + row + " would not executed, "
              + "because a final state '" + state_name + "' will be reached, "
              + "but not executed");
              $(this).addClass("wontexecute");
          } else {
            $(this).removeClass("wontexecute");
          }

          row += 1;
        });

        // if (another row with same input exists), declare as nondeterministic
        var known = [];
        ui_data.find(".transition_table tbody tr").each(function (row_id) {
          var from = [$(this).find(".tt_read").val(), $(this).find(".tt_from").val()];

          var search = [];
          for (var i = 0; i < known.length; i++)
            if (from[0] === known[i][0] && from[1] === known[i][1] && from[0] && from[1])
              search.push(i);

          if (search.length > 0) {
            self.alertNote("Nondeterministic behavior in rows " + search.join(", ")
              + " and " + row_id + ".");
            $(this).addClass("nondeterministic").removeClass("deterministic");
          } else {
            $(this).addClass("deterministic").removeClass("nondeterministic");
            known.push(from);
          }
        });

        // update actual table in ATM
        self.getProgram().fromJSON(self.readTransitionTable());

        // is it still an undefined instruction?
        self._updateStateInUI(self.getState(), self.finalStateReached(),
          self.undefinedInstruction(), self.getTape().read());

        self.alertNote("Transition table updated!");
      } catch (e) {
        console.error(e);
        self.alertNote(e.message);
      }
    });

    // JS events
    this.addEventListener('startRun', function () {
      self.showRunningControls();
    });
    this.addEventListener('stopRun', function () {
      self.hideRunningControls();
    });
  };

  // @method AnimatedTuringMachine.getNumbersFromViz:
  //   get numbers from NumberVisualization
  this.getNumbersFromUI = function () {
    return numbers.getNumbers();
  };

  // @method AnimatedTuringMachine.getCurrentTapeSymbols:
  //   get `count` current tape symbols
  this.getCurrentTapeSymbols = function (count) {
    count = parseInt(count);
    require(!isNaN(count));
    var selection = this.getTape().read(undefined, count);

    require(selection.length === count,
      "Bug: Size of selected elements invalid");

    return selection;
  };

  this._stopRun = function () { this.triggerEvent('stopRun'); };
  this._startRun = function () { this.triggerEvent('startRun'); };

  // @method AnimatedTuringMachine.prev: Undo one step
  this.iteratePrevious = function (done) {
    if (!self._lockingCheck('undo one step'))
      return;

    self.lock();
    try {
      var r = tm.back(1)[0];
    } catch (e) {
      if (e.name === 'OutOfHistoryException') {
        this.alertNote("Cannot go back any further in history");
        self.release();
        return false;
      } else {
        console.error(e);
        this.alertNote(e.message);
        return false;
      }
    }

    var old_value = r[0];
    var old_state = r[1];
    var new_value = r[2];
    var move = r[3];
    var new_state = r[4];
    var step_id = r[5];
    var undefined_instruction = r[6];
    var final_state_reached = r[7];

    var finalize = function () {
      self.release();
      done.call(self);
    };

    var initiateNumberWrite = function () {
      numbers.addEventListener('writeFinished', function () {
        var rel_pos = move.equals(mot.LEFT) ? -1 : 0;
        rel_pos = move.equals(mot.RIGHT) ? 1 : rel_pos;
        self.triggerEvent('valueWritten', old_value, new_value, rel_pos);
        setTimeout(finalize, 30);
      }, 1);

      var new_str_value = toStr(toJson(new_value));
      if (!animation_enabled || speed < speed_limit)
        numbers.writeNumberFast(new_str_value);
      else
        numbers.writeNumber(new_str_value);
    };

    var initiateNumberMotionAndGearMove = function () {
      numbers.addEventListener('moveFinished', function () {
        self.triggerEvent('movementFinished', move);
        setTimeout(initiateNumberWrite, 30);
      }, 1);

      // TODO: non-static 7/9
      if (!animation_enabled || speed < speed_limit) {
        if (move.equals(mot.LEFT))
          numbers.moveLeftFast(toStr(toJson(self.getTape().read(undefined, 9)[1])));
        else if (move.equals(mot.RIGHT))
          numbers.moveRightFast(toStr(toJson(self.getTape().read(undefined, 9)[7])));
        else if (move.equals(mot.HALT) || move.equals(mot.STOP))
          numbers.moveNot();
      } else {
        if (move.equals(mot.LEFT))
          numbers.moveLeft(toStr(toJson(self.getTape().read(undefined, 9)[1])));
        else if (move.equals(mot.RIGHT))
          numbers.moveRight(toStr(toJson(self.getTape().read(undefined, 9)[7])));
        else if (move.equals(mot.HALT) || move.equals(mot.STOP))
          numbers.moveNot();
      }

      // TODO: move gear
    };

    var initiateStateUpdate = function () {
      self._updateStateInUI(new_state, final_state_reached, undefined_instruction, new_value);
      self.triggerEvent('stateUpdated', old_state, new_state, final_state_reached);
      self.triggerEvent('transitionFinished', old_value, old_state, new_value,
          move, new_state, step_id, undefined_instruction, final_state_reached);

      initiateNumberMotionAndGearMove();
    };

    setTimeout(initiateStateUpdate, 30);
  };

  // @method AnimatedTuringMachine.iterateNext: Go on one step
  this.iterateNext = function (done) {
    if (!self._lockingCheck('iterate to next step'))
      return;
    if (self.finalStateReached()) {
      console.warn("final state already reached");
      return;
    }
    if (self.undefinedInstruction()) {
      console.warn("undefined instruction given");
      return;
    }

    self.lock();
    var r = tm.forth(1)[0];

    var old_value = r[0];
    var old_state = r[1];
    var new_value = r[2];
    var move = r[3];
    var new_state = r[4];
    var step_id = r[5];
    var undefined_instruction = r[6];
    var final_state_reached = r[7];

    var initiateNumberWriteAndGearMove = function () {
      numbers.addEventListener('writeFinished', function () {
        var rel_pos = move.equals(mot.LEFT) ? -1 : 0;
        rel_pos = move.equals(mot.RIGHT) ? 1 : rel_pos;
        // TODO: move gear
        /*if (speed >= 2000)
          if (rel_pos > 0)
            gear.addStepsLeft(1)
          else
            gear.addStepsRight(1)*/
        self.triggerEvent('valueWritten', old_value, new_value, rel_pos);
        setTimeout(initiateNumberMotion, 30);
      }, 1);

      var new_str_value = toStr(toJson(new_value));
      if (!animation_enabled || speed < speed_limit)
        numbers.writeNumberFast(new_str_value);
      else
        numbers.writeNumber(new_str_value);
    };

    var initiateNumberMotion = function () {
      numbers.addEventListener('moveFinished', function () {
        self.triggerEvent('movementFinished', move);
        setTimeout(initiateStateUpdate, 30);
      }, 1);

      // TODO: non-static 7/9
      // REMARK be aware that the tape already moved
      if (!animation_enabled || speed < speed_limit) {
        if (move.equals(mot.LEFT))
          numbers.moveRightFast(toStr(toJson(self.getTape().read(undefined, 9)[1])));
        else if (move.equals(mot.RIGHT))
          numbers.moveLeftFast(toStr(toJson(self.getTape().read(undefined, 9)[7])));
        else if (move.equals(mot.HALT) || move.equals(mot.STOP))
          numbers.moveNot();
      } else {
        if (move.equals(mot.LEFT))
          numbers.moveRight(toStr(toJson(self.getTape().read(undefined, 9)[1])));
        else if (move.equals(mot.RIGHT))
          numbers.moveLeft(toStr(toJson(self.getTape().read(undefined, 9)[7])));
        else if (move.equals(mot.HALT) || move.equals(mot.STOP))
          numbers.moveNot();
      }
    };

    var initiateStateUpdate = function () {
      self._updateStateInUI(new_state, final_state_reached, undefined_instruction, new_value);
      self.triggerEvent('stateUpdated', old_state, new_state, final_state_reached);

      self.triggerEvent('transitionFinished', old_value, old_state, new_value,
          move, new_state, step_id, undefined_instruction, final_state_reached);

      self.release();
      done.call(self);
    };

    setTimeout(initiateNumberWriteAndGearMove, 30);
  };

  // @method AnimatedTuringMachine.interrupt: Interrupt running TM
  this.interrupt = function () {
    this.lock();
    // TODO: .call(this) because interrupt uses stupid callback by method via this._stopRun
    tm.interrupt.call(this);
    this.release();
    return true;
  };

  // @method AnimatedTuringMachine.reset: Reset machine to initial state
  this.reset = function () {
    if (!this._lockingCheck('reset'))
      return;
    this.lock();
    tm.reset();
    this.release();
    this.syncToUI();
    return true;
  };

  this.toString = function () {
    return "[AnimatedTuringMachine '" + this.getMachineName() + "']";
  };

  // API - Import & Export

  // @method AnimatedTuringMachine.syncFromUI:
  //   Take all values from the UI and insert them into the TM state
  this.syncFromUI = function () {
    if (!this._lockingCheck('synchronize state from GUI'))
      return;

    var steps_prev = parseInt(ui_tm.find(".steps_prev").val());
    require(!isNaN(steps_prev), "Steps back counter must be number");
    require(steps_prev > 0, "Steps back counter must be non-negative number");

    var steps_next = parseInt(ui_tm.find(".steps_next").val());
    require(!isNaN(steps_next), "Steps continue counter must be number");
    require(steps_next > 0, "Steps continue counter must be non-negative number");

    // animation enabled?
    animation_enabled = !ui_tm.find("input[name='wo_animation']").is(":checked");

    // get numbers
    var vals = numbers.getNumbers();
    require(vals.length % 2 === 1, "Number of shown values must be odd");
    var steps = Math.floor(vals.length / 2);
    this.getTape().left(steps);
    for (var i = 0; i < vals.length; i++) {
      this.getTape().write(symbol(vals[i]));
      if (i !== vals.length - 1)
        this.getTape().right();
    }
    this.getTape().left(steps);

    // get state
    this.setState(state(ui_tm.find(".state").text()));

    // get steps count
    ui_settings['steps_back'] = steps_prev;
    ui_settings['steps_continue'] = steps_next;

    // get machine name
    this.setMachineName(ui_meta.find(".machine_name").val());

    // ignore 'Load tape'

    // get 'Final states'
    var fs_string = ui_data.find(".final_states").val();
    final_states = fs_string.split(/\s*,\s*/)
        .map(function (s) { return state(s); });
    this.setFinalStates(final_states);

    // read 'transition table'
    this.getProgram().clear();
    var self = this;
    ui_data.find(".transition_table tbody tr").each(function () {
      var from_symbol = $(this).find("td:eq(0) input").val();
      var from_state = $(this).find("td:eq(1) input").val();
      var write_symbol = $(this).find("td:eq(2) input").val();
      var move = $(this).find("td:eq(3) select").val();
      var to_state = $(this).find("td:eq(4) input").val();

      self.getProgram().set(
        symbol(from_symbol), state(from_state),
        symbol(write_symbol), mot[move.toUpperCase()], state(to_state)
      );
    });
  };

  // @method AnimatedTuringMachine.syncToUI:
  //   Write the current TM state to the UI
  this.syncToUI = function () {
    if (!this._lockingCheck('synchronize state to GUI'))
      return;

    // animation enabled?
    ui_tm.find("input[name='wo_animation']").prop("checked", !animation_enabled);

    // set numbers
    var vals = this.getTape().read(undefined, 7); // TODO non-static 7
    numbers.setNumbers(vals.map(toJson).map(toStr));

    // set state
    this._updateStateInUI(this.getState(),
      tm.finalStateReached(), tm.undefinedInstruction(),
      this.getTape().read());

    // set steps count
    ui_tm.find(".steps_prev").val(ui_settings['steps_back']);
    ui_tm.find(".steps_next").val(ui_settings['steps_continue']);

    // set machine name
    ui_meta.find(".machine_name").val(this.getMachineName());

    // set 'Load tape'
    ui_data.find(".tape").val(tape.toHumanString());

    // set 'Final states'
    var fs = this.getFinalStates().map(toStr).join(", ");
    ui_data.find(".final_states").val(fs);

    // write 'transition table'
    this.clearTransitionTableRows();
    var prg = this.toJSON()['program'];
    for (var row = 0; row < prg.length; row++) {
      this.writeTransitionTableRow(prg[row]);
      this.addNewTransitionTableRow();
    }
  };

  // @method AnimatedTuringMachine.fromJSON: Import object state from JSON dump
  this.fromJSON = function (data) {
    this.interrupt();
    this.lock();

    if (data['speed'] !== undefined) {
      speed = parseInt(data['speed']);
      require(!isNaN(speed));
      delete data['speed'];
    }
    if (data['animations'] !== undefined) {
      animation_enabled = !!data['animations'];
      delete data['animations'];
    }

    tm.fromJSON(data);
    this.release();
  };

  // @method AnimatedTuringMachine.toJSON: Export object state to JSON dump
  this.toJSON = function () {
    this.interrupt();

    var data = tm.toJSON();
    data['speed'] = speed;
    data['animations'] = animation_enabled;

    return data;
  };

  this._initialize();

  // inherited:
  //   lock, release, locked
  //   finished
  //   isAFinalState
  //   setTape, getTape
  //   setState, getState
  //   setProgram, getProgram
  //   setMachineName, getMachineName
  //   setInitialTape, getInitialTape
  //   setFinalStates, addFinalState, getFinalStates
  //   setCursor, getCursor
  //   setInitialState, getInitialState
  //   getStep
  //   undefinedInstruction, finalStateReached
};

// ---------------------------- Testcase Runner ---------------------------

var TestcaseRunner = function (manager) {
  var N_SUCCESS = "(ok) Testcase '%1' succeeded.";
  var N_FAILURE = "(fail) Testcase '%1' failed.";

  // @function TestcaseRunner._createTM: create/overwrite a
  //   TuringMachine instance with the given input configuration
  this._createTM = function (input, tm, transition_table,
    default_final_states, default_initial_state)
  {
    var i_tape_cursor = input['tape']['cursor'];
    var i_tape_blank = input['tape']['blank'];
    var i_tape_data = input['tape']['data'];
    var i_state = input['state'];

    var prg, tape;
    if (tm) {
      prg = tm.getProgram();
      tape = tm.getTape();
    } else {
      if (typeof i_tape_blank === 'undefined')
        tape = new UserFriendlyTape(symbol(i_tape_blank), 0);
      else
        tape = new UserFriendlyTape(symbol("_"), 0);
      prg = new Program();
      tm = new TuringMachine(prg, tape,
        default_final_states.map(function (v) { return state(v) }),
        state(default_initial_state));
    }
    prg.fromJSON(transition_table);

    if (typeof i_tape_blank !== 'undefined')
      tape.setBlankSymbol(symbol(i_tape_blank));

    if (typeof i_state !== 'undefined')
      tm.setState(state(i_state));

    tape.clear();
    if (typeof i_tape_data !== 'undefined') {
      tape.moveTo(position(0));
      for (var i = 0; i < i_tape_data.length; i++) {
        tape.write(symbol(i_tape_data[i])); // TODO comparison function
        tape.right();
      }
      if (typeof i_tape_cursor !== 'undefined')
        tape.moveTo(position(i_tape_cursor));
      else
        tape.moveTo(position(0));
    }

    return tm;
  };

  // @function TestcaseRunner._testTM: test whether a TuringMachine instance
  //   satisfies the given output configuration
  this._testTM = function (tm, output) {
    var o_tapecontent = output['tapecontent'];
    var o_cursorposition = output['cursorposition'];
    var o_state = output['state'];

    if (tm.getStep() >= generic_check_inf_loop)
      return [false, 'steps performed', '<' + generic_check_inf_loop, 'greater'];

    if (typeof o_state !== 'undefined')
      if (!tm.getState().equals(state(o_state)))
        return [false, 'final state', o_state, tm.getState().toJSON()];

    if (typeof o_tapecontent !== 'undefined') {
      var actual_data = tm.getTape().toJSON()['data'];
      var expected_data = o_tapecontent.map(toStr);

      while (actual_data[0] === tm.getTape().getBlankSymbol().toJSON())
        actual_data = actual_data.slice(1);
      while (actual_data[actual_data.length - 1] === tm.getTape().getBlankSymbol().toJSON())
        actual_data = actual_data.slice(0, -1);

      var equals = true, i = 0;
      for (; i < Math.max(actual_data.length, expected_data.length); i++)
        if (actual_data[i] !== expected_data[i]) {
          equals = false;
          break;
        }

      var r = function (v) { return (v === undefined) ? 'blank' : ("'" + v + "'") };

      if (!equals)
        return [false, 'tape content', r(actual_data[i]),
          r(expected_data[i]) + " at index " + i];

      if (typeof o_cursorposition !== 'undefined')
        if (o_cursorposition !== tm.getTape().toJSON()['cursor'])
          return [false, 'cursor', o_cursorposition, tm.getTape().toJSON()['cursor']];
    }

    return [true];
  };

  // @function TestcaseRunner._runTM: run a turingmachine
  //   until a terminating condition is reached
  this._runTM = function (tm) {
    var steps = 0;
    while (!tm.finished() && steps++ < generic_check_inf_loop)
      tm.forth();
  };

  // @function TestcaseRunner.runTestcase: run a specific testcase (or all)
  this.runTestcase = function (testsuite, tc_name, transition_table) {
    require(typeof testsuite !== 'undefined', 'Testsuite required');
    require(typeof transition_table.length !== 'undefined', 'transition table required');

    var report = { 'reports': { }, 'reports_length': 0 };
    if (tc_name)
      var testcases = [tc_name];
    else
      var testcases = manager.get(testsuite).testcases;

    report['program'] = manager.get(testsuite)['title'];
    var default_final_states = manager.get(testsuite)['final_states']
        .map(function (s) { return state(s) } );
    var default_initial_state = state(manager.get(testsuite)['state']);

    var ok = true;
    for (var tc = 0; tc < testcases.length; tc++) {
      var testcase = manager.get(testsuite).testcases[tc];

      var testing_tm = this._createTM(testcase['input'], undefined,
        transition_table, default_final_states, default_initial_state);
      this._runTM(testing_tm);
      var response = this._testTM(testing_tm, testcase['output']);

      var tc_report = { 'ok': response[0] };
      if (!tc_report['ok']) {
        ok = false;
        tc_report['error'] = 'Expected ' + response[1] + ' to be ' + response[2]
          + ' but is actually ' + response[3];
      }

      report.reports[testcase.name] = tc_report;
      report.reports_length += 1;
    }

    report['ok'] = ok;
    return report;
  };

  // @function TestcaseRunner.loadTestcaseToATM:
  //   load a testcase to a given AnimatedTuringMachine
  this.loadTestcaseToATM = function (tc_name, atm) {
    require(tc_name !== undefined, "Testcase must be given");

    var default_final_states = manager.getProgram()['final_states'].map(state);
    var default_initial_state = state(manager.getProgram()['state']);
    var testcase = null;

    for (var i = 0; i < manager.get(testsuite).testcases.length; i++)
      if (manager.get(testsuite).testcases[i].title === tc_name)
        testcase = manager.get(testsuite).testcases[i];

    this._createTM(testcase.input, atm, default_final_states, default_initial_state);
    atm.syncToUI();
  };
};

// -------------------------- NumberVisualization -------------------------

var NumberVisualization = function (values, ui_root) {
  // @member NumberVisualization.values: Initial values
  // @member NumberVisualization.ui_root: DOM root element
  ui_root = $(ui_root);

  // @member NumberVisualization.valid_events: Valid events
  var valid_events = ['moveFinished', 'writeFinished'];

  // @member NumberVisualization.events: Event register
  var events = new EventRegister(valid_events);

  // @member NumberVisualization.locked: Lock while modifying DOM
  var locked = false;

  // @member NumberVisualization.width_one_number: Width of one .numbers
  var width_one_number = 60;

  // @member NumberVisualization.width_main_number: Width of focused .numbers
  var width_main_number = 185;

  // @member NumberVisualization.speed: Animation speed
  var speed = 2000;


  // @method NumberVisualization._createNumber: append/prepend new .value in DOM
  this._createNumber = function (value, classes, left) {
    classes = def(classes, []);
    var elem = $("<div></div>").addClass("value")
      .css("opacity", "0").css("left", "0px")
      .text("" + value);

    for (var c = 0; c < classes.length; c++)
      elem.addClass(classes[c]);

    if (left)
      ui_root.find(".tm_value").first().before(elem);
    else
      ui_root.find(".tm_value").last().after(elem);

    return elem;
  };

  // @method NumberVisualization._rebuildValues: copy & destroy .value
  this._rebuildValues = function () {
    ui_root.find(".numbers .value").each(function () {
      var copy = $(this).clone(false);
      copy.removeClass("animated_left");
      copy.removeClass("animated_right");
      copy.css("opacity", 1);
      $(this).before(copy);
      $(this).remove();
    });
  };

  // @method NumberVisualization._assignSemanticalTapeClasses:
  //   assign semantical classes to .numbers instances
  this._assignSemanticalTapeClasses = function () {
    var semanticalClasses = [
      'lleft', 'rleft', 'mid', 'lright',
      'rright', 'left', 'right'
    ];

    var numbers = ui_root.find(".numbers .value");
    var mid = parseInt(numbers.length / 2);
    var i = 0;

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

  // @method NumberVisualization._tapeWidth:
  //   width in pixels of turingmachine display
  this._tapeWidth = function () {
    var padding = ui_root.css('padding-left') || 0;
    if (padding)
      padding = parseInt(padding.substr(0, padding.length - 2));
    return (ui_root[0].clientWidth - 2 * padding || 700);
  };

  // @method NumberVisualization._initialize: Initialize visualization
  this._initialize = function () {
    locked = true;

    // create .numbers .value instances
    this.setNumbers(values);

    // assign CSS classes
    this._assignSemanticalTapeClasses();

    // define left padding
    var computedWidth = width_one_number * (values.length - 1);
    computedWidth += width_main_number;
    var actualWidth = this._tapeWidth();
    var diff = actualWidth - computedWidth;

    // define left padding of visualization
    ui_root.find(".numbers").css("padding-left", parseInt(diff / 2) + "px");

    locked = false;
  };

  // @method NumberVisualization.addEventListener: event listener definition
  this.addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method NumberVisualization.triggerEvent: trigger event
  this.triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method NumberVisualization.getSpeed: Get speed value
  this.getSpeed = function () {
    return speed;
  };

  // @method NumberVisualization.setSpeed: Set speed value
  this.setSpeed = function (val) {
    speed = val;
  };

  // @method NumberVisualization.setNumbers: Set values for .numbers
  //   This method ensures that values.length DOM elements exist
  //   and set all text contents to the values
  this.setNumbers = function (values) {
    require(values, "At least one value must be given");
    require(values.length % 2 === 1, "Number of values must be odd!");

    locked = true;
    var existing = ui_root.find(".numbers .value").length;
    while (existing > values.length) {
      ui_root.find(".numbers .value").last().remove();
      existing = ui_root.find(".numbers .value").length;
    }
    while (existing < values.length) {
      var elem = $("<div></div>").addClass("value").text("0");
      ui_root.find(".numbers").append(elem);
      existing = ui_root.find(".numbers .value").length;
    }

    for (var i = 0; i < values.length; i++)
      ui_root.find(".numbers .value").slice(i, i+1).text(values[i]);

    locked = false;
  };

  // @method NumberVisualization.getNumbers: Return values of .numbers
  this.getNumbers = function () {
    return ui_root.find(".numbers .value").map(function () {
      return $(this).text();
    }).get();
  };

  // @method NumberVisualization.writeNumber: Animate value writing for the cursor
  this.writeNumber = function (new_value) {
    if (locked) {
      console.warn("Cannot write number. NumberVisualization is locked.");
      console.trace();
      return;
    }
    locked = true;

    var mid = parseInt(ui_root.find(".numbers .value").length / 2);
    var old_value = ui_root.find(".numbers .value").slice(mid, mid+1).text();
    var halftime = parseInt(speed / 4);
    var animation_speed = parseInt(speed / 2);

    // make animation
    ui_root.find(".writer").css("animation-duration", "" + animation_speed + "ms");
    ui_root.find(".writer").addClass("animated_writer");
    setTimeout(function () {
      if (new_value)
        ui_root.find(".numbers .value").slice(mid, mid+1).text(new_value);
    }, halftime);
    var te = this.triggerEvent;
    ui_root.find(".writer")[0].addEventListener("animationend", function () {
      $(this).removeClass("animated_writer");

      // clone element and destroy element
      var original = ui_root.find(".writer");
      var copy = original.clone();
      original.after(copy);
      original.first().remove();

      te('writeFinished', old_value, new_value);
      locked = false;
    }, true);
  };

  // @method NumberVisualization.writeNumberFast: Animate value writing in high-speed
  this.writeNumberFast = function (new_value) {
    if (locked) {
      console.warn("Cannot write number. NumberVisualization is locked.");
      console.trace();
      return;
    }
    locked = true;

    var mid = parseInt(ui_root.find(".numbers .value").length / 2);
    var old_value = ui_root.find(".numbers .value").slice(mid, mid+1).text();

    if (new_value)
      ui_root.find(".numbers .value").slice(mid, mid+1).text(new_value);

    this.triggerEvent('writeFinished', old_value, new_value);
    locked = false;
  };

  // @method NumberVisualization.moveLeft: Move numbers to the left
  this.moveLeft = function (new_value) {
    if (locked) {
      console.warn("Cannot move left. NumberVisualization is locked.");
      console.trace();
      return;
    }
    locked = true;

    // insert element from right
    ui_root.find(".numbers .value_rright").removeClass("value_rright");
    var elem = $("<div></div>").addClass("value").addClass("value_rright")
      .css("opacity", "0").css("right", "0px").text("" + new_value);
    ui_root.find(".numbers").append(elem);

    // add animated-CSS-class to trigger animation
    var elem = ui_root.find(".numbers .value");
    elem.addClass("animated_left");
    elem.css("animation-duration", "" + speed + "ms");
    var count_last = elem.length;
    var te = this.triggerEvent;

    var self = this;
    elem.each(function () {
      var is_rright = $(this).hasClass("value_rright");
      var is_lleft = $(this).hasClass("value_lleft");
      $(this)[0].addEventListener("animationend", function () {
        $(this).removeClass("animated_left");

        // disallow most-right element to switch back to invisibility
        if (is_rright)
          $(this).css("opacity", 1);

        // delete most-left element
        if (is_lleft)
          $(this).remove();

        count_last -= 1;
        if (count_last === 0) { // last element triggers finalization
          // recreate DOM element to make next animation possible
          self._rebuildValues();

          // assign semantic CSS classes such as lleft
          self._assignSemanticalTapeClasses();

          // trigger callback
          te('moveFinished', self.getNumbers(), new_value, 'left');

          locked = false;
        }
      }, true);
    });
  };

  // @method NumberVisualization.moveRight: Move numbers to the right
  this.moveRight = function (new_value) {
    if (locked) {
      console.warn("Cannot move right. NumberVisualization is locked.");
      console.trace();
      return;
    }
    locked = true;

    // reduce left-padding to get space for new element
    var numbers = ui_root.find(".numbers");
    var old_padding = parseInt(numbers.css("padding-left"));
    if (!isNaN(old_padding)) {
      var new_padding = (old_padding - width_one_number);
      numbers.css("padding-left", "" + new_padding + "px");
    }

    // insert element from left
    ui_root.find(".numbers .value_lleft").removeClass("value_lleft");
    var elem = $("<div></div>").addClass("value").addClass("value_lleft")
      .css("opacity", "0").css("left", "0px").text("" + new_value);
    ui_root.find(".numbers").prepend(elem);

    // add animated-CSS-class to trigger animation
    var elem = ui_root.find(".numbers .value");
    elem.addClass("animated_right");
    elem.css("animation-duration", "" + speed + "ms");
    var count_last = elem.length;
    var te = this.triggerEvent;

    var self = this;
    elem.each(function () {
      var is_lleft = $(this).hasClass("value_lleft");
      var is_rright = $(this).hasClass("value_rright");

      $(this)[0].addEventListener("animationend", function () {
        $(this).removeClass("animated_right");

        // reset padding-left to old value (only one time)
        if (is_lleft)
          numbers.css("padding-left", old_padding);

        // disallow most-left element to switch back to invisibility
        if (is_lleft)
          $(this).css("opacity", 1);

        // delete most-right element
        if (is_rright)
          $(this).remove();

        count_last -= 1;
        if (count_last === 0) { // last element triggers finalization
          // recreate DOM element to make next animation possible
          self._rebuildValues();

          // assign semantic CSS classes such as lleft
          self._assignSemanticalTapeClasses();

          // trigger callback
          te('moveFinished', self.getNumbers(), new_value, 'right');

          locked = false;
        }
      }, true);
    });
  };

  // @method NumberVisualization.moveNot: Do not really move, but invoke events
  //    useful for HALT and STOP motions
  this.moveNot = function () {
    this.triggerEvent('moveFinished', this.getNumbers(), null, 'stop');
  };

  // @method NumberVisualization.moveLeftFast: Move numbers to the left fast
  this.moveLeftFast = function (new_value) {
    if (locked) {
      console.warn("Cannot jump left. NumberVisualization is locked.");
      console.trace();
      return;
    }
    locked = true;

    // insert element from left
    ui_root.find(".numbers .value_rright").removeClass("value_rright");
    var elem = $("<div></div>").addClass("value")
      .addClass("value_rright").text("" + new_value);
    ui_root.find(".numbers").append(elem);

    // delete most-left element
    ui_root.find(".numbers .value_lleft").remove();

    // recompute semantical classes
    this._assignSemanticalTapeClasses();

    // trigger callback
    this.triggerEvent('moveFinished', this.getNumbers(), new_value, 'right');

    locked = false;
  };

  // @method NumberVisualization.moveRightFast: Move numbers to the right fast
  this.moveRightFast = function (new_value) {
    if (locked) {
      console.warn("Cannot jump right. NumberVisualization is locked.");
      console.trace();
      return;
    }
    locked = true;

    // insert element from left
    ui_root.find(".numbers .value_lleft").removeClass("value_lleft");
    var elem = $("<div></div>").addClass("value")
      .addClass("value_lleft").text("" + new_value);
    ui_root.find(".numbers").prepend(elem);

    // delete most-right element
    ui_root.find(".numbers .value_rright").remove();

    // recompute semantical classes
    this._assignSemanticalTapeClasses();

    // trigger callback
    this.triggerEvent('moveFinished', this.getNumbers(), new_value, 'right');

    locked = false;
  };

  this._initialize();
};

// --------------------------- GearVisualization --------------------------

// @class Visualization of the gear movement
function GearVisualization(ui_gear, queue) {
  // @member GearVisualization.ui_gear: Reference to the base element for viz
  // @member GearVisualization.queue: Operations queue to visualize in future
  // @member GearVisualization.currently_running: Lock for running
  var currently_running = false;

  // @member GearVisualization.valid_events: Events registered at this object
  var valid_events = ['animationFinished', 'animationsFinished'];

  // @member GearVisualization.events: Event register for this object
  var events = new EventRegister(valid_events);

  // @member GearVisualization.speed: Animation speed
  var speed = 2000;

  var self = this;

  // @method GearVisualization.addEventListener: event listener definition
  this.addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method GearVisualization.triggerEvent: trigger event
  this.triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method GearVisualization.setSpeed: define the animation speed in milliseconds
  this.setSpeed = function (sp) {
    require(!isNaN(parseInt(sp)));
    speed = parseInt(sp);
  };

  // @method GearVisualization.getSpeed: Get the animation speed in milliseconds
  this.getSpeed = function () {
    return speed;
  };

  // Turingmachine API

  // @method GearVisualization.done: Stop animation
  this.done = function () {
    currently_running = false;
    self.triggerEvent('animationFinished');
    if (queue.isEmpty()) {
      self.triggerEvent('animationsFinished');
      return;
    }
  };

  // @method GearVisualization.addStepsLeft: Add an operation 'move to left'
  this.addStepsLeft = function (count) {
    if (count === undefined)
      count = 1;

    for (var i = 0; i < count; i++)
      queue.push(-1);

    if (!currently_running)
      this._nextAnimation();
  };

  // @method GearVisualization.addStepsRight: Add an operation 'move to right'
  this.addStepsRight = function (count) {
    if (count === undefined)
      count = 1;

    for (var i = 0; i < count; i++)
      queue.push(+1);

    if (!currently_running)
      this._nextAnimation();
  };

  // animation

  // @method GearVisualization._nextAnimation: Trigger the next animation
  this._nextAnimation = function () {
    if (queue.isEmpty()) {
      this.triggerEvent('animationsFinished');
      return;
    }

    var steps = queue.pop();

    this._startAnimation({
      animationTimingFunction: (Math.abs(steps) > 1) ? "linear" : "ease-in-out",
      animationName: "gear-" + (steps < 0 ? "left" : "right"),
      animationIterationCount: Math.abs(steps),
      animationDuration: speed
    });
  };

  // @method GearVisualization._startAnimation: Start the animations
  this._startAnimation = function (properties) {
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

    var oldGear = ui_gear; // == .gear-animation
    var oldUid = parseInt(oldGear.attr('data-uid'));
    if (isNaN(oldUid))
      oldUid = parseInt(Math.random() * Math.pow(2, 32));
    var newUid = parseInt(Math.random() * Math.pow(2, 32));
    if (newUid === oldUid)
      newUid = oldUid + 1;

    var newGear = oldGear.clone(true).attr("data-uid", newUid);

    oldGear.attr("data-uid", oldUid);
    oldGear.before(newGear);
    for (var prop in defaultProperties) {
      newGear[0].style[prop] = defaultProperties[prop];
    }
    ui_gear.find("*[data-uid=" + oldUid + "]").remove();

    var d = self.done;
    newGear[0].addEventListener("animationend", function () {
      d();
      self._nextAnimation();
    }, false);
  };
};

// ---------------------------- TuringManager -----------------------------

// A turing market holds JSON data of various markets, where the JSON
// represents programs, testcases, etc

var TuringManager = function (default_market, markets, ui_notes, ui_tm, ui_meta, ui_data) {
  // @member TuringManager.default_market: the market used per default

  // UI elements
  var ui_programs = ui_meta.find("select.example");
  var ui_testcases = ui_meta.find("select.testcase");
  var ui_transitiontable = ui_data.find(".transition_table");

  // @callback programLoading(program)
  //   [invoked when the market is about to load]
  // @callback programVerified(program, verification_report)
  //   [invoked whenever the market is verified]
  // @callback programReady(program, data)
  //   [invoked whenever the validated market is available]
  // @callback programActivated(program, data)
  //   [invoked whenever TuringManager.activateProgram(program) was invoked]
  // @callback testcaseActivated(testcase, testcase_data)
  //   [invoked whenever TuringManager.activateTestcase(testcase) was invoked]

  // @member TuringManager.events: EventRegister for events of this object
  var events = new EventRegister([
    'programLoading', 'programVerified', 'programReady',
    'programActivated', 'testcaseActivated'
  ]);

  // @member TuringManager.programs: The actual loaded markets
  var programs = {};

  // @member TuringManager.auto_activate_program:
  //    markets to activate after calling activateWhenReady with a program
  var autoactivate_program = {};

  // @member TuringManager.auto_activate_testcase:
  //    markets to activate after calling activateWhenReady with a testcase
  var autoactivate_testcase = {};

  // @member TuringManager.last_activated: last activated program
  var last_activated = '';

  // @member TuringManager.loading_timeout: maximum loading timeout
  var loading_timeout = 7000;


  // @method TuringManager._normId: Split an identifier
  this._normId = function (id) {
    // TODO: fails if testcase name contains "/"
    require(id, "Market identifier must not be undefined");
    if (id.indexOf(':') === -1 && id.indexOf('/') === -1)
      return [default_market, id, undefined];
    else if (id.indexOf(':') === -1) {
      var parts = id.split('/');
      return [default_market, parts[0], parts[1]];
    } else if (id.indexOf('/') === -1) {
      var parts = id.split(':');
      return [parts[0], parts[1], undefined];
    } else {
      var parts1 = id.split(':');
      var parts2 = parts1[1].split('/');
      return [parts1[0], parts1[0], parts1[1]];
    }
  };

  // @method TuringManager.addEventListener: event listener definition
  this.addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method TuringManager.triggerEvent: trigger event
  this.triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method TuringManager.loaded: Was given program loaded?
  this.loaded = function (program_id) {
    var id = this._normId(program_id).slice(0, 2).join(":");
    return programs[id] !== undefined;
  };

  // @method TuringManager.get: Get the defined program (or undefined)
  this.get = function (program_id) {
    var id = this._normId(program_id).slice(0, 2).join(":");
    return programs[id];
  };

  // @method TuringManager.get: Get the title of the last activated program (or null)
  this.getActivated = function () {
    if (this.last_activated)
      return this.last_activated;
    else
      return null;
  };

  // @method TuringManager.add: Synchronously add a market
  this.add = function (program_id, data) {
    var normalized = this._normId(program_id);
    var id = normalized.slice(0, 2).join(":");
    require(normalized[2] === undefined, "ID must not refer to a testcase");

    this.triggerEvent('programLoading', id);
    var report = verifyProgram(data);
    this.triggerEvent('programVerified', id, report);
    if (report)
      return false;

    programs[id] = data;
    this.triggerEvent('programReady', id, data);

    if (autoactivate_program[id])
      this.activateProgram(id);
    else if (autoactivate_testcase[id] && autoactivate_testcase[id].length > 0)
      for (var i = 0; i < autoactivate_testcase[id].length; i++)
        this.activateTestcase(autoactivate_testcase[id][i]);
  };

  // @method TuringManager.load: Asynchronously add a market
  this.load = function (program_id) {
    var normalized = this._normId(program_id);
    var id = normalized.slice(0, 2).join(":");
    var market = normalized[0];
    var program = normalized[1];
    var self = this;

    if (programs[id] !== undefined) {
      console.warn(id + " already loaded");
      return;
    }

    this.triggerEvent('programLoading', id);

    var loaded = false;
    setTimeout(function () {
      if (!loaded)
        console.error("seems like " + id + " was not loaded in time");
    }, loading_timeout);

    $.get("" + markets[market] + program + ".json", function (data) {
      loaded = true;
      console.info("program " + id + " was loaded");

      // verify data
      var report = verifyProgram(data);
      self.triggerEvent('programVerified', id, report);
      if (report) {
        console.warn("Program " + id + " is not correctly formatted");
        console.debug(report);
        return;
      }

      // set ready
      programs[id] = data;
      self.triggerEvent('programReady', id, data);

      if (autoactivate_program[id])
        self.activateProgram(id);
      else if (autoactivate_testcase[id] && autoactivate_testcase[id].length > 0)
        for (var i = 0; i < autoactivate_testcase[id].length; i++)
          self.activateTestcase(autoactivate_testcase[id][i]);
    }, "json");
  };

  // @method TuringManager.activateWhenReady: The next time the given market
  //   is available, activate it
  this.activateWhenReady = function (program_id) {
    var normalized = this._normId(program_id);
    var program_id = normalized.slice(0, 2).join(":");
    var testcase_id = normalized.slice(0, 3).join(":");

    if (normalized[2] === undefined) {
      // refers to program
      if (programs[program_id] !== undefined)
        this.activateProgram(program_id);
      else
        autoactivate_program[program_id] = true;
    } else {
      // refers to testcase
      if (programs[program_id] !== undefined)
        this.activateTestcase(testcase_id);
      else
        autoactivate_testcase[program_id].push(testcase_id);
    }
  };

  // @method TuringManager.activateProgram: Activate a given program
  //   meaning a programActivated event will be fired and the
  //   program JSON will be passed over
  this.activateProgram = function (program_id) {
    var normalized = this._normId(program_id);
    var id = normalized.slice(0, 2).join(":");
    require(normalized[2] === undefined,
      "Market ID must refer to program, not testcase");

    require(programs[id] !== undefined, "Program " + id
      + " is not yet available");

    this.triggerEvent('programActivated', id, programs[id]);
    autoactivate_program[id] = false;
  };

  // @method TuringManager.activateTestcase: Activate a given testcase
  //   meaning a testcaseActivated event will be fired and the
  //   testcase JSON will be passed over
  this.activateTestcase = function (testcase_id) {
    var normalized = this._normId(testcase_id);
    var program_id = normalized.slice(0, 2).join(":");
    var testcase_id = normalized.slice(0, 3).join(":");
    require(normalized[2] !== undefined,
      "Market ID must refer to testcase, not program");

    require(programs[program_id] !== undefined, "Program " + program_id
      + " is not yet available");

    var data = undefined;
    for (var i = 0; i < programs[program_id]['testcases']; i++)
      if (programs[program_id]['testcases'][i]['title'] === normalized[2])
        data = programs[program_id]['testcases'][i];
    require(data !== undefined, "Testcase " + testcase_id
      + " not found in program " + program_id);

    this.triggerEvent('testcaseActivated', testcase_id, data);
    autoactivate_testcase[program_id] = autoactivate_testcase[program_id].filter(
      function (v) { return v !== testcase_id; }
    );
  };

  var self = this;
  this.addEventListener('programActivated', function (program_id, data) {
    self.last_activated = program_id;
  });
};


// ------------------------------- Foswiki --------------------------------

// - read: read turingmachine from userinput text
// - write: write turingmachine to text string

var foswiki = {};

foswiki.removeMarkup = function (v) {
  v = v.trim();
  v = v.replace(/(\s|^)\*(\S.*?\S|\S)\*(\s|$)/, "$1$2$3");
  v = v.replace(/(\s|^)__(\S.*?\S|\S)__(\s|$)/, "$1$2$3");
  v = v.replace(/(\s|^)_(\S.*?\S|\S)_(\s|$)/, "$1$2$3");
  v = v.replace(/(\s|^)==(\S.*?\S|\S)==(\s|$)/, "$1$2$3");
  v = v.replace(/(\s|^)=(\S.*?\S|\S)=(\s|$)/, "$1$2$3");
  v = v.replace(/<(\w|\/)[^>]*?>/, "");
  return v.trim();
};

foswiki.exc = function (msg, lineno, col) {
  msg = "[foswiki] " + msg;
  if (typeof lineno !== 'undefined' && typeof col !== 'undefined')
    msg += " [lineno " + (lineno + 1) + ", column " + col + "]";
  else if (typeof lineno !== 'undefined')
    msg += " [lineno " + (lineno + 1) + "]";
  else if (typeof col !== 'undefined')
    require(false, "Buggy call of foswiki.exc");
  throw new SyntaxException(msg);
};

foswiki.readDefinitionLine = function (line, lineno) {
  var normalize = foswiki.removeMarkup;

  var m = line.match(/( +)\$ ([^:]+?): (.*)/);
  if (m === null)
    return null;
  if (m[1].length !== 3)
    throw new SyntaxException("Foswiki definition list items "
      + "must start with exactly 3 spaces! Error on line " + lineno);

  var key = normalize(m[2]);
  var value = normalize(m[3]);

  if (key.match(/name/i))
    return { 'machine name': value };
  else if (key.match(/final state/i))
    return {
      'final states': value.split(",").map(normalize)
        .filter(function (v) { return Boolean(v); })
    };
  else if (key.match(/state/i))
    return { 'initial state': value };
  else if (key.match(/tape/i))
    return { 'tape content': m[3].trim() };
  else if (key.match(/blank/i))
    return { 'blank symbol': normalize(value) };
  else if (key.match(/cursor/i)) {
    var cursor = parseInt(value);
    if (isNaN(cursor))
      throw new SyntaxException("Foswiki invalid. Cursor must be integer "
        + "(line " + line + ")");
    return { 'cursor': cursor };
  } else {
    var obj = {};
    obj[key] = value;
    return obj;
  }
};

foswiki.writeDefinitionLine = function (obj) {
  require(obj['machine name'], "machine name must not be empty");
  require(obj['final states'], "final states must be given");
  require(obj['initial state'], "initial state must not be given");
  require(obj['tape content'], "tape content must not be empty");

  return "   $ __Machine name__: " + obj['machine name'] + "\n"
       + "   $ __Final states__: " + obj['final states'] + "\n"
       + "   $ __Initial state__: " + obj['initial state'] + "\n"
       + "   $ __Tape content__: " + obj['tape content'] + "\n";
};

foswiki.readTable = function (tokenstream) {
  // expect one line per tokenstream element
  //   { 'line': N, 'text': line surrounded by "|" }
  var colsep = "|";
  var table = [];
  var columns = -1;
  var columns_origin = 0;

  if (tokenstream.length < 1)
    foswiki.exc("No row found in foswiki table");
  for (var t = 0; t < tokenstream.length; t++) {
    require(!isNaN(parseInt(tokenstream[t]['line'])));
    require(tokenstream[t]['line'] !== undefined);

    var lineno = tokenstream[t]['line'];
    var cols = tokenstream[t]['text'].split(colsep);

    if (cols.length < 2)
      foswiki.exc("No columns found in table row", lineno);

    if (columns === -1) {
      columns = cols.length;
      columns_origin = lineno;
    }
    if (columns !== cols.length)
      foswiki.exc("Inconsistent number of columns in table rows. " +
        columns + " columns found in line " + (columns_origin + 1) + ". " +
        "Got unexpected " + cols.length + " columns in line " +
        (lineno + 1));

    var onerow = { 'line': lineno, 'data': [] };
    for (var col = 0; col < cols.length; col++) {
      if (col === 0 && cols[col].trim() !== "")
        foswiki.exc("Table rows must start with |", lineno);
      if (col === cols.length - 1 && cols[col].trim() !== "")
        foswiki.exc("Table rows must end with |", lineno);

      if (col > 0 && col !== cols.length - 1)
        onerow['data'].push(cols[col]);
    }
    table.push(onerow);
  }

  return table;
};

foswiki.readTransitionTriple = function (text)
{
  if (text.trim() === "" || text.trim() === "..." || text.trim() === "…")
    return null;
  var vals = text.split(" - ").map(foswiki.removeMarkup);
  if (vals[0].trim() === "" && vals[1].trim() === "" &&
    vals[2].trim() === "")
    return null;
  if (vals.length !== 3)
    foswiki.exc("Transition triple must contain "
      + "3 hyphen-separated values but I got: " + text);

  return [vals[0], vals[1], vals[2]];
}

foswiki.readProgram = function (tokenstream)
{
  var table = foswiki.readTable(tokenstream);

  var symbols = [];
  var states = [];
  var program = [];

  for (var r = 0; r < table.length; r++) {
    for (var c = 0; c < table[r]['data'].length; c++) {
      var content = table[r]['data'][c];
      var lineno = table[r]['line'];

      // read symbol
      if (r === 0 && c > 0) {
        var n = foswiki.removeMarkup(content);
        if ($.inArray(n, symbols) === -1)
          symbols.push(n);
        else {
          var first = 0;
          for (var i = 0; i < symbols.length; i++)
            if (symbols[i] === n)
              first = i;
          foswiki.exc("Symbol '" + n + "' used twice as read symbol "
            + "(columns " + first + " and " + c + ")");
        }
      }
      // read state
      if (c === 0 && r > 0) {
        var n = foswiki.removeMarkup(content);
        if ($.inArray(n, states) === -1)
          states.push(n);
        else {
          var first = 0;
          for (var i = 0; i < states.length; i++)
            if (states[i] === n)
              first = i;
          foswiki.exc("State '" + n + "' used twice as current state "
            + "(rows " + first + " and " + r + ")");
        }
      }

      // transition triple
      if (c > 0 && r > 0) {
        var tr_cell = foswiki.readTransitionTriple(content);
        if (tr_cell)
          program.push([symbols[c - 1], states[r - 1],
            [tr_cell[0], tr_cell[1], tr_cell[2]]])
      }
    }
  }

  return program;
};

foswiki.writeProgram = function (prg) {
  var justify = function (text, size, bold) {
    if (typeof size === 'undefined')
      size = 25;
    else if (isNaN(parseInt(size)))
      throw new Error("justify() only accepts integers as size parameter");
    else
      size = parseInt(size);

    if (typeof text === 'undefined')
      return repeat(" ", size);
    var chars = size - (bold ? 2 : 0) - text.toString().length;
    if (chars < 0)
      chars = 0;
    var t = text.toString();
    return (bold ? "*" + t + "*" : t) + repeat(" ", chars);
  };

  // retrieve possible symbols and states to start with
  var from_symbols = prg.getFromSymbols();
  var from_states = prg.getFromStates();
  var from_symbols_json = from_symbols.toJSON();
  var from_states_json = from_states.toJSON();

  var j = function (v) { return justify(v); };
  var text = "| " + j("") + " | " + from_symbols.toJSON().map(j).join(" | ") + " |\n";

  for (var j = 0; j < from_states_json.length; j++) {
    var from_state = from_states_json[j];
    var cols = [];

    for (var i = 0; i < from_symbols_json.length; i++) {
      var from_symb = from_symbols_json[i];
      // TODO: normalization functions
      var instr = prg.get(symbol(from_symb), state(from_state));

      if (!instr)
        cols.push(justify(""));
      else
        cols.push(justify(instr.toJSON().join(" - ")));
    }

    text += "| " + justify(from_state) + " | " + cols.join(" | ") + " |\n";
  }

  return text;
};

foswiki.read = function (tm, text, symbol_norm_fn, state_norm_fn) {
  require(tm !== undefined, "TM must be given for foswiki import");
  require(text !== undefined, "Foswiki text must be given for foswiki import");
  if (typeof text !== 'string' || text.trim().length === 0)
    foswiki.exc("Cannot import from empty text");

  var rowsep = "\n";
  var lines = text.split(rowsep);

  var table_here = null;
  var table = [];
  var definitions = {};

  // read it line-by-line
  for (var l = 0; l < lines.length; l++) {
    var line = lines[l];
    if (line.match(/^\s*$/))
      continue;

    // mode transition
    if (line.trim()[0] === '|' && (table_here === null || table_here === true)) {
      table.push({ 'line': l, 'text': line });
      table_here = true;
    } else if (line.substr(0, 5) === '   $ ') {
      if (table_here === true)
        table_here = false;
      var result = foswiki.readDefinitionLine(line, l);
      for (var i in result)
        definitions[i] = result[i];
    }
  }

  if (table.length === 0)
    foswiki.exc("No transition table found after reading "
      + lines.length + " lines");

  // load program to TM
  var transition_table = foswiki.readProgram(table);
  tm.getProgram().fromJSON(transition_table);

  // load definitions to TM
  if ('machine name' in definitions)
    tm.setMachineName(definitions['machine name']);
  if ('final states' in definitions)
    tm.setFinalStates(definitions['final states'].map(function (v) {
      return state(v, state_norm_fn);
    }));
  if ('initial state' in definitions)
    tm.setState(state(definitions['initial state'], state_norm_fn));
  if ('tape content' in definitions)
    tm.getTape().fromHumanString(definitions['tape content'], symbol_norm_fn);

  // compatibility definitions, TODO: remove as time goes by
  if ('blank symbol' in definitions)
    tm.getTape().setBlankSymbol(symbol(definitions['blank symbol'], symbol_norm_fn));

  // invalid data fixes
  if (tm.getFinalStates().length === 0)
    tm.addFinalState(state("End"));

  // write configuration to TM
  return null;
};

foswiki.write = function (tm) {
  require(tm && tm.getState, "tm must not be empty");

  // metadata header
  var text = foswiki.writeDefinitionLine({
    'machine name': tm.getMachineName(),
    'initial state': tm.getState().toString(),
    'final states': tm.getFinalStates()
      .map(function (v) {
        require(v.toString().indexOf(",") === -1, "final states must not contain commas");
        return v.toString();
      })
      .join(","),
    'tape content': tm.getTape().toHumanString()
  });

  text += "\n";

  // transition table
  text += foswiki.writeProgram(tm.getProgram());

  return text;
};

// ---------------------- TuringMarket verification -----------------------

// verifyProgram: Verify correctness of market's program data
var verifyProgram = function (dat) {
  // map
  //   'title'          required, string
  //   'description'    optional, array of strings/maps, default []
  //   'version'        required, string
  //   'tape'           required, map
  //       'blank'         optional, string, default "0"
  //       'offset'        optional, integer, default 0
  //       'cursor'        optional, integer, default -1
  //       'data'          required, array of strings, len>=0
  //   'program'        optional, array of homogeneous elements, default []
  //       homogeneous elements: array of 5 strings
  //           [3] satisfies       is choice from ["LEFT", "RIGHT", "STOP"]
  //   'state'          required, string
  //   'final_states'   required, array of strings, len>=1
  //   'testcases'      optional, array of homogeneous elements, len>=0
  //       homogeneous elements: map
  //            'name'             required, string, len>=3
  //            'input'            required, map
  //                 'tape'              required, same layout as above
  //                 'state'             required, string
  //            'output'           required, len>=1
  //                 'state'             optional, string
  //                 'tapecontent'       optional, array of strings, len>=0
  //                 'cursorposition'    optional, integer

  // output['state'] will be satisfied if and only if
  //   the final state equals output['state']
  //   hence output['state'] must be declared as final state
  // output['tapecontent'] will be satisfied if and only if
  //   if the output['tapecontent'] equals tape values array (with blank symbols stripped from left and right)
  // output['cursorposition'] will be satisfied if and only if
  //   if the final cursor position matches the index of the cursor in output['tapecontent']
  //   hence output['cursorposition'] requires definition of output['tapecontent']

  var title_schema = { 'type': 'string', 'minLength': 3 };
  var description_schema = {
    'type': 'array',
    'minItems': 0,
    'items': {
      'oneOf': [{ 'type': 'string' }, { 'type': 'object' }]
    }
  };
  var version_schema = { 'type': 'string', 'minLength': 3 };
  var tape_schema = {
    'type': 'object',
    'properties': {
      'blank': { 'type': 'string', 'default': "0" },
      'offset': { 'type': 'integer', 'default': 0 },
      'cursor': { 'type': 'integer', 'default': -1 },
      'data': { 'type': 'array', 'minItems': 0, 'items': { 'type': 'string' } }
    },
    'additionalProperties': false,
    'required': ['data']
  };
  var program_schema = {
    'type': 'array',
    'minItems': 0,
    'items': {
      'type': 'array',
      'minItems': 5,
      'maxItems': 5,
      'items': [
        { 'type': 'string' },
        { 'type': 'string' },
        { 'type': 'string' },
        { 'type': 'string', 'pattern': '^(LEFT|RIGHT|STOP)$' },
        { 'type': 'string' }
      ]
    },
    'uniqueItems': true
  };
  var state_schema = { 'type': 'string', 'minLength': 1 };
  var final_states_schema = { 'type': 'array', 'minItems': 1, 'items': { 'type': 'string' } };
  var testcase_schema = {
    'type': 'array',
    'minItems': 0,
    'items': {
      'type': 'object',
      'properties': {
        'name': { 'type': 'string', 'minLength': 1 },
        'input': {
          'type': 'object',
          'properties': {
            'tape': tape_schema,
            'state': state_schema
          },
          'required': ['tape', 'state'],
          'additionalProperties': false
        },
        'output': {
          'type': 'object',
          'properties': {
            'state': state_schema,
            'tapecontent': { 'type': 'array', 'minItems': 0, 'items': { 'type': 'string' }},
            'cursorposition': { 'type': 'integer' }
          },
          'minProperties': 1,
          'additionalProperties': false
        },
      },
      'required': ['name', 'input', 'output'],
      'additionalProperties': false
    }
  };

  var schema = {
    '$schema': 'http://json-schema.org/draft-04/schema#',
    'title': 'Turingmarket Schema',
    'type': 'object',
    'properties': {
      'title': title_schema,
      'description': description_schema,
      'version': version_schema,
      'tape': tape_schema,
      'program': program_schema,
      'state': state_schema,
      'final_states': final_states_schema,
      'testcases': testcase_schema
    },
    'additionalProperties': false,
    'required': ['title', 'tape', 'state', 'final_states']
  };

  var env = jjv();
  env.addSchema('market', schema);

  return env.validate('market', dat);
};


// ------------------------------- UI-Tools -------------------------------

var markup = function (element, text) {
  var inline = function (t) {
    var v = $("<div></div>").text(t).html();
    v = v.replace(/(\W|^)\*((\w|_|:|\s)+)?\*(\W)/g, "$1<em>$2</em>$4");
    v = v.replace(/\((.*?)\)\[([^\]]+)\]/g, "<a href='$2'>$1</a>");
    return v;
  };

  var ul = null;
  for (var i in text) {
    if (/^\* /.exec(text[i])) {
      if (!ul) {
        ul = $("<ul></ul>");
        element.append(ul);
      }
      ul.append($("<li></li>").html(inline(text[i].substr(2))));
    } else {
      element.append($("<p></p>").html(inline(text[i])));
      ul = null;
    }
  }

  return element;
}

// ------------------------- Application object ---------------------------

var Application = function (manager, ui_tm, ui_meta, ui_data, ui_notes, ui_gear) {
  var normalize_symbol_fn = normalizeSymbol;
  var normalize_state_fn = normalizeState;

  this.loadMarketProgram = function (data) {
    // TODO all state() & symbol() need normalization function

    var user_tape_to_userfriendly_tape = function (data) {
      // input: { "data": ["1"], "cursor": -1, "blank": "0" }
      // output: { "data": ["1"], "cursor": -1, "blank_symbol": "0",
      //           "offset": 0, "history": [], "history_size": 0 }

      // TODO: implement optional-default values correctly
      return {
        'data' : data.data,
        'cursor': def(data.cursor, -1),
        'blank_symbol' : def(data.blank, "0"),
        'offset': def(data.offset, 0),
        'history': [],
        'history_size': 0
      }
    };

    var user_program_to_program = function (data) {
      // input: [['0', 'Start', '1', 'RIGHT', 'End']]
      // output: [['0', 'Start', ['1', 'RIGHT', 'End']]]

      var ret = [];
      for (var i = 0; i < data.length; i++) {
        ret.push([data[i][0], data[i][1],
          [data[i][2], data[i][3], data[i][4]]]);
      }
      return ret;
    };

    try {
      var tape = user_tape_to_userfriendly_tape(data['tape']);

      this.tm().getTape().fromJSON(tape);
      this.tm().setInitialTape(tape);
      this.tm().getProgram().fromJSON(user_program_to_program(data['program']));
      this.tm().setState(state(data['state']));
      this.tm().setInitialState(state(data['state']));
      this.tm().setFinalStates(data['final_states'].map(function (s) { return state(s) }));
      this.tm().setDescriptionText(data['description']);
      this.tm().setDescriptionTitle(data['title']);
      this.tm().setVersion(data['version']);

      this.tm().syncToUI();
      this.tm().verifyUIsync();
    } catch (e) {
      console.error(e);
      this.tm().alertNote(e.message);
    }
  };

  this.manager = function () { return manager; };
  this.tm = function () { return machine; };
  this.run = function () { machine.initializeGUI(); };

  var gear = new GearVisualization(ui_gear, new Queue());
  var numbers = new NumberVisualization([0, 0, 0, 0, 0, 0, 0], ui_tm); // TODO: non-static 7
  var machine = defaultAnimatedTuringMachine(normalize_symbol_fn,
    normalize_state_fn, gear, numbers, ui_tm, ui_meta, ui_data, ui_notes);
}


// ----------------------------- Main routine -----------------------------

var intro_program = {
  "title" : "00 - Introduction",
  "description" : [
    "Hi! This project is all about *turingmachines*. What are turingmachines? They are a computational concept from *Theoretical Computer Science* (TCS) by Alan Turing (*\u20061912 †\u20061954). They illustrate one possible way to define computation and are as powerful as your computer. So how do they work?",
    "Above you can see the animated turing machine with several control elements underneath. The animation consists of a tape (with bright background color) and one cursor (winded green structure). The text at the left bottom of the animation is called *current state*. You can press \"continue\" to compute the next *step*. What are steps?",
    "At the bottom you can see a *transition table*. It defines a current situation, consisting of a read symbol and a state, and the next situation after one step has been performed. So when you press \"continue\" the program will read the symbol focused by the cursor and the current state. It will search for a line in the transition table matching those 2 values and will execute the corresponding result. The result consists of a symbol to write, a movement of the tape and a successor state.",
    "The current program handles the following problem: Between '^' and '$' are there 0, 1 or 2 ones? Depending on the number, the final state is either Count0ones, Count1one or Count2ones.",
    "You can edit the transition table yourself. Try it! 😊"
  ],
  "version" : "1.2 / 23rd of Aug 2015 / meisterluk",
  "tape": {
    "data": ["^", "0", "1", "0", "0", "1", "$"],
    "cursor": 1,
    "blank": "0"
  },
  "program": [
    ["0", "Start", "0", "RIGHT", "Start"],
    ["1", "Start", "1", "RIGHT", "Found1one"],
    ["$", "Start", "$", "STOP", "Count0ones"],
    ["0", "Found1one", "0", "RIGHT", "Found1one"],
    ["1", "Found1one", "1", "RIGHT", "Found2ones"],
    ["$", "Found1one", "$", "STOP", "Count1one"],
    ["0", "Found2ones", "0", "RIGHT", "Found2ones"],
    ["1", "Found2ones", "1", "STOP", "Count2ones"],
    ["$", "Found2ones", "$", "STOP", "Count2ones"],
  ],
  "state" : "Start",
  "final_states" : ["Count0ones", "Count1one", "Count2ones"],
  "testcases" : [
    {
      "name": "find 0 ones in ^00000$",
      "input": {
          "tape": { "cursor": 1, "blank": "0", "data": ["^", "0", "0", "0", "0", "0", "$"] },
          "state": "Start"
      },
      "output": { "state": "Count0ones" }
    }, {
      "name": "find 1 one in ^00010$",
      "input": {
          "tape": { "cursor": 1, "blank": "0", "data": ["^", "0", "0", "0", "1", "0", "$"] },
          "state": "Start"
      },
      "output": { "state": "Count1one" }
    }, {
      "name": "find 2 ones in ^10010$",
      "input": {
          "tape": { "cursor": 1, "blank": "0", "data": ["^", "1", "0", "0", "1", "0", "$"] },
          "state": "Start"
      },
      "output": { "state": "Count2ones" }
    }, {
      "name": "find 1 one in ^00010000000$",
      "input": {
          "tape": { "cursor": 1, "blank": "0", "data": ["^", "0", "0", "0", "1", "0", "0", "0", "0", "0", "0", "0", "$"] },
          "state": "Start"
      },
      "output": { "state": "Count1one" }
    }
  ]
};

function main()
{
  // initialize application
  var ui_tm = $(".turingmachine:eq(0)");
  var ui_meta = $(".turingmachine_meta:eq(0)");
  var ui_data = $(".turingmachine_data:eq(0)");
  var ui_notes = $("#notes");
  var ui_gear = ui_tm.find("#gear");

  require(ui_tm.length > 0 && ui_meta.length > 0);
  require(ui_data.length > 0 && ui_notes.length > 0 && ui_gear.length > 0);

  // read configuration via URL hash
  /// you can load additional programs via URL like:
  ///   #programs{intro;2bit-xor}
  var url_hash = window.location.hash.slice(1);
  var default_market = 'local';
  var market_matches = url_hash.match(/markets\{(([a-zA-Z0-9_-]+:.*?;)*([a-zA-Z0-9_-]+:.*?))\}/);
  var program_matches = url_hash.match(/programs\{(([a-zA-Z0-9:_-]+;)*([a-zA-Z0-9:_-]+))\}/);

  var markets = {'local': 'markets/'};  // local is always contained
  if (market_matches) {
    var p = market_matches[1].split(';');
    for (var i = 0; i < p.length; i++) {
      var q = p[i].split(':');
      if (q[0] && q[1] && q[0] !== 'local') {
        markets[q[0]] = q[1];
      }
    }
  }
  console.info("Markets considered: ", markets);

  var programs = ['2bit-xor', '2bit-addition', '4bit-addition', 'mirroring', 'zero-writer'];
  var count_default_programs = 5;
  if (program_matches) {
    var p = program_matches[1].split(';');
    for (var i = 0; i < p.length; i++) {
      if (p[i] && programs.indexOf(p[i]) === -1)
        programs.push(p[i]);
    }
  }
  console.info("Programs considered: ", programs);

  // market handling
  var manager = new TuringManager(default_market, markets,
                  ui_notes, ui_tm, ui_meta, ui_data);
  var application = new Application(manager, ui_tm, ui_meta, ui_data, ui_notes, ui_gear);

  // REMARK I just hope it takes 100ms to make the application instance available
  manager.addEventListener("programReady", function (_, data) {
    return application.tm().addExampleProgram.apply(null, arguments);
  });
  manager.addEventListener("programActivated", function (program_id, data) {
    application.tm().updateTestcaseList.apply(null, arguments);
    application.loadMarketProgram(data);

    ui_meta.find(".example").val(program_id);
  });
  ui_meta.find(".testcase_load").click(function () {
    try {
      var testdata = manager.get(ui_meta.find(".example").val());
      var testsuite = testdata.title;
      var testcase = ui_meta.find(".testcase").val();
      var testcase_data;

      for (var tc in testdata.testcases)
        if (testdata.testcases[tc].name === testcase)
          testcase_data = testdata.testcases[tc];
      require(testcase_data !== undefined);

      // TODO: add normalization function
      application.tm().getTape().fromJSON(testcase_data.input.tape);
      application.tm().setState(state(testcase_data.input.state));
      application.tm().setFinalStates(testdata.final_states.map(
        function (v) { return state(v) }));

      application.tm().syncToUI();
    } catch (e) {
      console.error(e);
      application.tm().alertNote(e.message);
    }
  });
  ui_meta.find(".testcase_runall").click(function () {
    try {
      // prepare variables
      var trun = new TestcaseRunner(manager);
      var report = trun.runTestcase(manager.getActivated(), undefined,
        application.tm().readTransitionTable());

      var msg = "Testing " + report.program + " (" + (report.ok ? "OK" : "FAILED") + ")\n\n";
      for (var tc in report.reports) {
        msg += "[" + tc + "] " + (report.reports[tc].ok ? "OK" : report.reports[tc].error) + "\n";
      }

      application.tm().alertNote(msg);
    } catch (e) {
      application.tm().alertNote(e.message);
    }
  });
  ui_meta.find(".example").change(function () {
    try {
      var program_id = $(this).val();
    } catch (e) {
      console.error(e);
      application.tm().alertNote(e.message);
    }
  });
  ui_meta.find(".example_load").click(function () {
    try {
      var current_program = ui_meta.find(".example").val();
      application.manager().activateProgram(current_program);
      window.localStorage['activeprogram'] = current_program;
    } catch (e) {
      console.error(e);
      self.alertNote(e.message);
    }
  });

  // Immediately load the default program and later update,
  // if another program shall be activated
  manager.add("intro", intro_program);
  manager.activateProgram("intro");

  for (var i = 0; i < programs.length; i++)
    manager.load(programs[i]);

  if (window.localStorage['activeprogram']) {
    // load the program used in the last session
    manager.activateWhenReady(window.localStorage['activeprogram']);
  } else if (programs[count_default_programs]) {
    // if user-defined program are provided, load first one per default
    manager.activateWhenReady(programs[count_default_programs]);
  }

  application.run();
  return application;
}
