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
// - Martina Tscheckl (zero writer turingmachine)
// - and lots of students and tutors of winter term 2014/15.
// Thank you!
//
// (C) 2013-2015, Public Domain, Lukas Prokop
//

'use strict';

// --------------------------- global variables ---------------------------

var app_name = "turingmachine.js";
var app_version = "0.9.2-unstable";
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

  var findIndex = function (value) {
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
  var push = function (value) {
    var index = findIndex(value);
    var found = (index < values.length) && (cmp_fn(values[index], value) === 0);
    if (!found)
      values.splice(index, 0, value);
    return !found;
  };

  // @method OrderedSet.remove: remove some value from the set
  var remove = function (value) {
    var index = findIndex(value);
    if (index < values.length && cmp_fn(values[index], value) === 0) {
      values.splice(index, 1);
      return true;
    } else
      return false;
  };

  // @method OrderedSet.contains: Does this OrderedSet contain this value?
  var contains = function (value) {
    var idx = findIndex(value);
    return idx < values.length && cmp_fn(values[idx], value) === 0;
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
      if (cmp_fn(values[i], o[i]) !== 0)
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

// a set implementation
function UnorderedSet(initial_values, cmp_fn) {
  cmp_fn = def(cmp_fn, cmp);
  // @member values
  var values = [];

  // @method UnorderedSet.push: append some value to the set
  var push = function (value) {
    if (contains(value))
      return false;
    values.push(value);
    return true;
  };

  // @method UnorderedSet.remove: remove some value from the set
  var remove = function (value) {
    for (var i = 0; i < values.length; i++)
      if (cmp_fn(values[i], value) === 0) {
        values.splice(i, 1);
        return true;
      }
    return false;
  };

  // @method UnorderedSet.contains: Does this UnorderedSet contain this value?
  var contains = function (value) {
    for (var i = 0; i < values.length; i++)
      if (cmp_fn(value, values[i]) === 0)
        return true;
    return false;
  };

  // @method UnorderedSet.size: Returns size of the set
  var size = function () {
    return values.length;
  };

  // @method UnorderedSet.equals: Do this set equal with the given parameter?
  var equals = function (other) {
    if (typeof other.toJSON === 'undefined' && typeof other.length !== 'undefined')
      other = new UnorderedSet(other);
    else if (typeof other !== 'object')
      return false;

    var o = other.toJSON();
    var m = toJSON();
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
  var toString = function () {
    return "uset[" + values.join(",") + "]";
  };

  // @method UnorderedSet.toJSON: export set into JSON data structure
  var toJSON = function () {
    return values.slice(0);
  };

  // @method UnorderedSet.fromJSON: import set from JSON data structure
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

// a queue implementation
var Queue = function (initial_values) {
  var values = [];

  var push = function (val) {
    values.splice(0, 0, val);
  };

  var pop = function () {
    return values.pop();
  };

  var clear = function () {
    values = [];
  };

  var isEmpty = function () { return values.length === 0; }

  if (typeof initial_values !== 'undefined')
    for (var i = 0; i < initial_values.length; i++)
      push(initial_values[i]);

  return { push : push, pop : pop, clear : clear, isEmpty : isEmpty };
}

// EventRegister adds event handlers and triggers event
var EventRegister = function (valid_events) {
  var events = {};

  // @method EventRegister.add: event listener definition
  //   Call `clbk` at most `max_calls` times whenever `evt` is triggered
  var add = function (evt, clbk, max_calls) {
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
  var trigger = function (evt) {
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
  var clear = function () {
    events = {};
  };

  // @method EventRegister.toString: string representation
  var toString = function () {
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

  return { add : add, trigger : trigger, clear : clear, toString : toString };
}

// ------------------------------ exceptions ------------------------------

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
  var equals = function (other) {
    return value === other.toJSON();
  };

  // @method Symbol.cmp: Compare two symbols
  var global_cmp = cmp;
  var _cmp = function (other) {
    if (!isSymbol(other))
      return -1;
    return global_cmp(value, other.toJSON());
  };

  // @method Symbol.copy: Return copy of the Symbol instance
  var copy = function () {
    return new Symbol(value);
  };

  // @method Symbol.toString: String representation of Symbol objects
  var toString = function () {
    return repr(value);
  };

  // @method Symbol.toJSON: JSON representation of Symbol objects
  var toJSON = function() {
    return value;
  };

  // @method Symbol.fromJSON: Get object from JSON
  var fromJSON = function (j) {
    value = j;
  };

  return {
    equals : equals,
    cmp : _cmp,
    copy : copy,
    toString : toString,
    toJSON : toJSON,
    fromJSON : fromJSON,
    isSymbol : true
  };
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
  var equals = function (other) {
    return toJSON() === other.toJSON();
  };

  // @method State.copy: Return a copy from the current state
  var copy = function () {
    return new State(name);
  };

  // @method State.toString: String representation of State objects
  var toString = function () {
    return name.toString();
  };

  // @method State.toJSON: JSON representation of State objects
  var toJSON = function() {
    return name;
  };

  // @method State.fromJSON: Get object from JSON
  var fromJSON = function (j) {
    value = j;
  };

  return {
    equals : equals,
    copy : copy,
    toString : toString,
    toJSON : toJSON,
    fromJSON : fromJSON,
    isState : true
  };
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
  var equals = function (other) {
    if (isMotion(other))
      return value === other.toString();
    else
      return value === other;
  };

  // @method Motion.copy: Copy this motion object
  var copy = function () {
    return new Motion(value);
  };

  // @method Motion.toString: String representation of Motion objects
  var toString = function () {
    return value;
  };

  // @method Motion.toJSON: JSON representation of Motion objects
  var toJSON = function () {
    return value;
  };

  // @method Motion.fromJSON: Get object from JSON
  var fromJSON = function (j) {
    value = j;
  };

  return {
    equals : equals,
    copy : copy,
    toString : toString,
    toJSON : toJSON,
    fromJSON : fromJSON,
    isMotion : true
  };
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
function Position(index)
{
  // @member Position.index
  require((index % 1) < 0.01);

  // @method Position.equals: Equality comparison for Position objects
  var equals = function (other) {
    if (isPosition(other))
      return toJSON() === other.toJSON();
    else
      return index === other;
  };

  // @method Position.copy: Return a clone of this object
  var copy = function () {
    return new Position(index);
  };

  // @method Position.add: Returns Position instance at pos this+summand
  var add = function (summand) {
    return position(index + summand);
  };

  // @method Position.sub: Returns Position instance at pos this+subtrahend
  var sub = function (subtrahend) {
    return position(index - subtrahend);
  };

  // @method Position.diff: Return integer diff between this and given Position
  var diff = function (other) {
    return other.index - this.index;
  };

  // @method Position.toString: String representation of Position objects
  var toString = function () {
    return index.toString();
  };

  // @method Position.toJSON: JSON representation of Position objects
  var toJSON = function () {
    return index;
  };

  // @method Position.fromJSON: Retrieve object from JSON representation
  var fromJSON = function (j) {
    index = j;
  };

  return {
    index : index,
    equals : equals,
    add : add,
    sub : sub,
    diff : diff,
    toString : toString,
    toJSON : toJSON,
    isPosition : true
  };
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

  // @method InstrTuple.equals: Equality comparison for InstrTuple objects
  var equals = function (other) {
    require(isInstrTuple(other), "InstrTuple object required for comparison");
    if (!other)
      return false;
    return write.equals(other.write) && move.equals(other.move) &&
        state.equals(other.state);
  };

  // @method InstrTuple.copy: Create a clone of this object
  var copy = function () {
    return new InstrTuple(write.copy(), move.copy(), state.copy());
  };

  // @method InstrTuple.toString: String representation of InstrTuple objects
  var toString = function () {
    return "{instruction: write " + write + ", move "
      + move + " and goto state "
      + state + "}";
  };

  // @method InstrTuple.toJSON: JSON representation of InstrTuple objects
  var toJSON = function () {
    return [write.toJSON(), move.toJSON(), state.toJSON()];
  };

  // @method InstrTuple.fromJSON: Import JSON representation
  var fromJSON = function (obj, symbol_norm_fn, state_norm_fn) {
    symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
    state_norm_fn = def(state_norm_fn, normalizeState);

    var it_symbol = symbol(obj[0], symbol_norm_fn);
    var it_move = motion(obj[1]);
    var it_state = state(obj[2], state_norm_fn);

    write = it_symbol;
    move = it_move;
    state = it_state;
  };

  return {
    write : write,
    move : move,
    state : state,

    equals : equals,
    toString : toString,
    toJSON : toJSON,
    fromJSON : fromJSON,
    isInstrTuple : true
  };
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

  var _safeGet = function (from_symbol, from_state) {
    requireSymbol(from_symbol);
    requireState(from_state);
    for (var i = 0; i < program.length; i++)
      if (program[i][0].equals(from_symbol) && program[i][1].equals(from_state))
        return program[i][2];

    return undefined;
  };

  var _safeSet = function (from_symbol, from_state, instr, overwrite) {
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
  var clear = function () {
    program = [];
  };

  // @method Program.exists: Does (from_symbol, from_state) exist in table?
  var exists = function (from_symbol, from_state) {
    requireSymbol(from_symbol);
    requireState(from_state);
    return typeof _safeGet(from_symbol, from_state) !== 'undefined';
  };

  // @method Program.set: Set entry in program
  var set = function (from_symbol, from_state, write, move, to_state) {
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

    _safeSet(from_symbol, from_state, value, true);
  };

  // @method Program.get: Return InstrTuple for given (symbol, state) or undefined
  var get = function (from_symbol, from_state) {
    requireSymbol(from_symbol);
    requireState(from_state);
    return _safeGet(from_symbol, from_state);
  };

  // @method Program.getFromSymbols: Get UnorderedSet of all from symbols
  var getFromSymbols = function () {
    var symbol_set = new UnorderedSet();
    for (var i in program)
      symbol_set.push(program[i][0]);
    return symbol_set;
  };

  // @method Program.getFromSymbols: Get array of all from symbols
  var getFromStates = function () {
    var state_set = new UnorderedSet();
    for (var i in program)
      state_set.push(program[i][1]);
    return state_set;
  };

  // @method Program.size: Count number of instructions stored in program
  var size = function () {
    return program.length;
  };

  // @method Program.toString: String representation of Program object
  var toString = function () {
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
  var toJSON = function () {
    var data = [];
    for (var i in program)
      data.push([program[i][0].toJSON(), program[i][1].toJSON(),
                 program[i][2].toJSON()]);

    return data;
  };

  // @method Program.fromJSON: Import a program
  // @example
  //    fromJSON([['0', 'Start', ['1', 'RIGHT', 'End']]])
  var fromJSON = function (data, symbol_norm_fn, state_norm_fn) {
    if (typeof data === "string")
      try {
        data = JSON.parse(data);
      } catch (e) {
        throw new SyntaxException(
          "Cannot import JSON as program. JSON is invalid."
        );
      }

    clear();

    for (var i in data) {
      var from_symbol = symbol(data[i][0], symbol_norm_fn);
      var from_state = state(data[i][1], state_norm_fn);
      var write = symbol(data[i][2][0], symbol_norm_fn);
      var move = motion(data[i][2][1]);
      var to_state = state(data[i][2][2], state_norm_fn);

      set(from_symbol, from_state, write, move, to_state);
    }
  };

  return {
    clear : clear,
    exists : exists,
    set : set,
    get : get,
    size : size,
    getFromSymbols : getFromSymbols,
    getFromStates : getFromStates,
    toString : toString,
    toJSON : toJSON,
    fromJSON : fromJSON,
    isProgram : true
  };
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
  var cursor = position(0);
  // @member Tape.tape
  //   stores undefined instead for blank symbols and
  //   replaces them with blank_symbol when represented as string
  //   cursor always points to element which exists here
  // @domain ordered sequence of Symbol instances or undefined
  var tape = [];

  var min = 0, max = 0;

  // Determine the actual index of the cursor inside `tape`
  var _cursorIndex = function () {
    return cursor.index + offset;
  };

  // Retrieve some value from the stack by Position
  var _get = function (p) {
    requirePosition(p);
    return tape[p.index + offset];
  };

  // invariants check
  var _testInvariants = function () {
    require(typeof offset === 'number');
    require((offset % 1) < 0.01);  // does not have decimal places
    requirePosition(cursor, "cursor is not a position");
    require(typeof tape === 'object');
    require(all(tape, function (v) { return isSymbol(v) || v === undefined; }));
  };

  // take this JSON and trim blank symbols left and right
  var _simplifyJSON = function (j, only_undefined) {
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
  var getBlankSymbol = function () {
    return blank_symbol;
  };

  // @method Tape.setBlankSymbol: get blank symbol
  var setBlankSymbol = function (val) {
    requireSymbol(val);
    require(typeof val.toJSON() !== 'undefined',   // disallowed value
      "undefined must not be used as blank symbol");
    blank_symbol = val;
  };

  // @method Tape.clear: Clear values of this tape
  var clear = function () {
    offset = 0;
    cursor = position(0);
    tape = [];
    min = 0;
    max = 0;
  };

  // @method Tape.begin: Get smallest Position at Tape ever accessed
  var begin = function () {
    return position(min);
  };

  // @method Tape.end: Get largest Position at Tape ever accessed
  var end = function () {
    return position(max);
  };

  // @method Tape.left: Go left at tape
  var left = function (positions) {
    cursor = cursor.sub(def(positions, 1));
    if (cursor.index < min)
      min = cursor.index;
  };

  // @method Tape.right: Go right at tape
  var right = function (positions) {
    cursor = cursor.add(def(positions, 1));
    if (cursor.index > max)
      max = cursor.index;
  };

  // @method Tape.moveTo: Move to the given position
  var moveTo = function (pos) {
    requirePosition(pos);
    cursor = pos;

    if (cursor.index > max)
      max = cursor.index;
    if (cursor.index < min)
      min = cursor.index;
  };

  // @method Tape.write: Write value to tape at current cursor position
  var write = function (value) {
    requireSymbol(value);
    do {
      var idx = _cursorIndex();
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
    _testInvariants();
  };

  // @method Tape.read: Return `count` values at given position `pos`
  //   if `count` = 1 (default), then the value is returned directly
  //   otherwise an array of `count` elements is returned where
  //   `pos` is at math.floor(return_value.length / 2);
  var read = function (pos, count) {
    count = def(count, 1);
    require(count >= 1);
    pos = def(pos, position(cursor));
    requirePosition(pos);
    _testInvariants();

    if (pos.index > max)
      max = pos.index;
    if (pos.index < min)
      min = pos.index;

    var norm = function (v) {
      return (v === undefined) ? blank_symbol : v;
    };

    if (count === 1) {
      return norm(_get(pos));
    } else {
      var values = [];
      for (var i = -Math.floor(count / 2); i <= Math.floor((count - 1) / 2); i++)
        values.push(norm(_get(pos.add(i))));
      require(values.length === count, "Length must match");
      return values;
    }
  };

  // @method Tape.length: count positions between smallest non-blank
  //                      and largest non-blank symbol
  var size = function () {
    return tape.length;
  };

  // @method Tape.equals: Tape equivalence
  //  If ignore_blanks, consider the blank symbol and undefined as the same symbol
  //  If ignore_cursor, cursor position does not matter
  var equals = function (other, ignore_blanks, ignore_cursor) {
    ignore_blanks = def(ignore_blanks, true);
    ignore_cursor = def(ignore_cursor, false);

    if (!other.isTape)
      throw new AssertionException("Can only compare tape with tape");

    if (!other.getBlankSymbol().equals(getBlankSymbol()))
      return false; // because are certainly some indices with different values

    var my_json = toJSON();
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
    var getMyByIndex = function (i) { return getByIndex(my_json, i); };
    var getOtherByIndex = function (i) { return getByIndex(other_json, i); };

    var getByPos = function (json, i) {
      var index = json['cursor'] + json['offset'];
      return getByIndex(json, index);
    };
    var getMyByPos = function (i) { return getByPos(my_json, i); };
    var getOtherByPos = function (i) { return getByPos(other_json, i); };

    var compare = function (my, oth) {
      if (!ignore_cursor && my['cursor'] !== oth['cursor'])
        return false;
      var begin1 = 0 - my['offset'],
          begin2 = 0 - oth['offset'];
      var end1 = my['data'].length - 1 - my['offset'],
          end2 = oth['data'].length - 1 - oth['offset'];
      for (var p = Math.min(begin1, begin2); p < Math.max(end1, end2); p++)
        if (getMyByPos(p) !== getOtherByPos(p))
          return false;
      return true;
    };

    return compare(my_json, other_json);
  };

  // @method Tape.fromHumanString: Human-readable representation of Tape
  var fromHumanString = function (str, symbol_norm_fn) {
    symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
    clear();

    var cursor_index = undefined;
    var parts = str.split(/\s*,\s*/);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i][0] === '*' && parts[i][parts[i].length - 1]) {
        cursor_index = i;
        parts[i] = parts[i].slice(1, parts[i].length - 2);
      }

      write(symbol(parts[i], symbol_norm_fn));
      right();
    }

    if (cursor_index !== undefined)
      cursor = position(cursor_index);
  };

  // @method Tape.toHumanString: Human-readable representation of Tape
  var toHumanString = function () {
    var dump = toJSON();

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

    data = data.map(toStr);
    data[cursor_index] = "*" + data[cursor_index] + "*";
    return data.join(", ");
  };

  // @method Tape.fromJSON: Import Tape data
  // @example
  //   fromJSON({'data': [], 'cursor':0, 'blank_symbol':'0', 'offset': 3})
  var fromJSON = function (data, symbol_norm_fn) {
    if (typeof data['data'] === 'undefined' ||
        typeof data['cursor'] === 'undefined')
      throw new SyntaxException(
        "Cannot import tape from JSON. " +
        "JSON incomplete (data or cursor missing)."
      );

    _simplifyJSON(data, true);

    // default values
    symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
    if (data['blank_symbol']) {
      blank_symbol = def(data['blank_symbol'], generic_blank_symbol);
      blank_symbol = symbol(blank_symbol, symbol_norm_fn);
    }
    requireSymbol(blank_symbol);

    offset = def(data['offset'], 0);
    require(offset >= 0);

    cursor = position(data['cursor']);
    requirePosition(cursor);

    tape = data['data'].map(function (v) {
      return (v === null || v === undefined)
        ? undefined
        : symbol(v, symbol_norm_fn);
    });

    min = -offset;
    max = tape.length - 1 - offset;

    _testInvariants();
  };

  // @method Tape.toJSON: Return JSON representation of Tape
  var toJSON = function () {
    return {
      blank_symbol : blank_symbol.toJSON(),
      offset : offset,
      cursor : cursor.toJSON(),
      data : tape.map(toJson)
    };
  };

  _testInvariants();

  return {
    setBlankSymbol : setBlankSymbol,
    getBlankSymbol : getBlankSymbol,
    cursor : function () { return cursor; },
    clear : clear,
    begin : begin,
    end : end,
    left : left,
    right : right,
    moveTo : moveTo,
    write : write,
    read : read,
    size : size,
    equals : equals,
    fromJSON : fromJSON,
    toJSON : toJSON,
    fromHumanString : fromHumanString,
    toHumanString : toHumanString,
    isTape : true
  };
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
  var simple_tape = new Tape(blank_symbol);

  // @member RecordedTape.logging
  var logging = true;

  // General overview for instruction set:
  //    going $x pos left     -> [-$x]
  //    going $x pos right    -> [$x]
  //    overwrite $x with $y  -> ['w', $x, $y]

  // @method RecordedTape._oppositeInstruction: Get opposite instruction
  var _oppositeInstruction = function (ins) {
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
  var _applyInstruction = function (ins) {
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
  var _applyNativeInstruction = function (ins) {
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
  var _undoOneSnapshot = function (frame) {
    var ops = [];
    for (var i = frame.length - 1; i >= 0; i--) {
      var undo = _oppositeInstruction(frame[i]);
      _applyNativeInstruction(undo);
      ops.push(undo);
    }
    return ops;
  };

  // @method RecordedTape.resizeHistory: Shorten history if necessary
  var _resizeHistory = function (size) {
    if (size === Infinity)
      return;
    if (size <= 0)
      return;
    history = history.slice(-size, history.length);
  };

  // @method RecordedTape.enableLogging: Enable logging of actions
  var enableLogging = function () {
    logging = true;
  };

  // @method RecordedTape.disableLogging: Disable logging of actions
  var disableLogging = function () {
    logging = false;
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
      throw AssertionException("setHistorySize only accept inf or num");

    simple_tape.setHistorySize(val);
    simple_tape.setBlankSymbol(val);
  };

  // @method RecordedTape.getHistory: Return the stored history
  var getHistory = function () {
    return history;
  };

  // @method RecordedTape.clearHistory: Clear the history of this tape
  var clearHistory = function () {
    history = [[]];
  };

  // @method RecordedTape.clear: Clear values of the tape and its history
  var clear = function () {
    clearHistory();
    simple_tape.clear();
  };

  // @method RecordedTape.left: Go left.
  var left = function (positions) {
    positions = def(positions, 1);
    require(!isNaN(parseInt(positions)));
    history[history.length - 1].push([-positions]);
    _resizeHistory(history_size);
    simple_tape.left(positions);
  };

  // @method RecordedTape.right: Go right.
  var right = function (positions) {
    positions = def(positions, 1);
    require(!isNaN(parseInt(positions)));
    history[history.length - 1].push([positions]);
    _resizeHistory(history_size);
    simple_tape.right(positions);
  };

  // @method RecordedTape.write: Write a value to tape.
  var write = function (new_value, old_value) {
    old_value = def(old_value, simple_tape.read());
    history[history.length - 1].push(['w', old_value, new_value]);
    _resizeHistory(history_size);
    simple_tape.write(new_value);
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
    history.push([]);
    _resizeHistory(history_size);
  };

  // @method RecordedTape.toString: Return string representation of RecordedTape
  var toString = function () {
    return simple_tape.toHumanString(false);
  };

  // @method RecordedTape.toJSON: Return JSON representation of RecordedTape
  var toJSON = function (export_history) {
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
  var fromJSON = function (data) {
    clearHistory();
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
    _resizeHistory(history_size);
    delete data['history_size'];
    delete data['history'];

    return simple_tape.fromJSON(data);
  };

  return inherit(simple_tape, {
    enableLogging : enableLogging,
    disableLogging : disableLogging,
    getHistorySize : getHistorySize,
    setHistorySize : setHistorySize,
    clear : clear,
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

function defaultExtendedTape(symbol_norm_fn) {
  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
  return new ExtendedTape(symbol(generic_blank_symbol, symbol_norm_fn));
}

// @object ExtendedTape: An extension of Tape with additional features.
// invariant: ExtendedTape provides a superset API of RecordedTape

function ExtendedTape(blank_symbol, history_size)
{
  // @member ExtendedTape.rec_tape
  var rec_tape = new RecordedTape(blank_symbol, history_size);

  // @method ExtendedTape.move: Move 1 step in some specified direction
  var move = function (move) {
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
  var forEach = function (func) {
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
  var getAlphabet = function () {
    var values = new OrderedSet();

    // remove duplicate entries
    forEach(function(pos, element) {
      values.push(element.toJSON());
    });

    return values;
  };

  return inherit(rec_tape, {
    move : move,
    forEach : forEach,
    getAlphabet : getAlphabet,
    isExtendedTape : true
  });
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
  var ext_tape = new ExtendedTape(blank_symbol, history_size);

  // @method UserFriendlyTape.setByString
  // Clear tape, store values of `array` from left to right starting with
  // position 0. Go back to position 0.
  var fromArray = function (array, symbol_norm_fn) {
    symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);

    ext_tape.clear();
    ext_tape.moveTo(position(0));
    for (var i = 0; i < array.length; i++) {
      ext_tape.write(symbol(array[i]));
      ext_tape.right();
    }
    ext_tape.moveTo(position(0));
  };

  // @method UserFriendlyTape.readBinaryValue
  //   Assume that the tape only contains values 0 and 1.
  //   Consider this value as binary value and return
  //     [binary value as number, bitstring, number of bits]
  //   if anything fails, return null
  var readBinaryValue = function () {
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

  // @method UserFriendlyTape.copy: Return a copy of this tape
  var copy = function () {
    var t = new UserFriendlyTape();
    t.fromJSON(ext_tape.toJSON());
    return t;
  };

  return inherit(ext_tape, {
    fromArray : fromArray,
    readBinaryValue : readBinaryValue,
    copy : copy,
    isUserFriendlyTape : true
  });
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

  // @member TuringMachine.valid_events
  // @member TuringMachine.events

  // @callback loadState(machine name, tape, current state, final states)
  //   [triggered when finished initialization or dump import]
  // @callback valueWritten(old value, new value, position relative to cursor)
  //   [triggered whenever some value on the tape changed]
  // @callback movementFinished(move) [triggered whenever cursor moved]
  // @callback stateUpdated(old state, new state, new state is a final state)
  //   [triggered whenever the current state changed]
  // @callback transitionFinished(old value, old state, new value, movement,
  //   new state, step id, undefined instruction is given for next transition)
  //   [triggered whenever the execution state after some transition has been
  //   reached]
  // @callback outOfHistory(step id) [triggered when running out of history]
  // @callback undefinedInstruction(read symbol, state) [triggered whenever some
  //   instruction was not found]
  // @callback finalStateReached(state) [triggered whenever some final state
  //   has been reached]
  // @callback startRun() [triggered whenever first transition of a Run]
  // @callback stopRun() [stop running]

  // TODO: remove undefinedInstruction,
  //    if next instruction undefined, show a pop up,
  //    but we can simply invoke transitionFinished and there inject
  //    an instruction if necessary.
  //    But need to get rid of triggerEvent callbacks

  var valid_events = ['loadState', 'valueWritten', 'movementFinished',
    'stateUpdated', 'transitionFinished', 'outOfHistory',
    'undefinedInstruction', 'finalStateReached', 'startRun', 'stopRun'];
  var events = new EventRegister(valid_events);

  // @method TuringMachine.addEventListener: event listener definition
  var addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method TuringMachine.triggerEvent: trigger event
  var triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method TuringMachine.getProgram: Getter for Program instance
  // @method TuringMachine.setProgram: Setter for Program instance
  var getProgram = function () { return program; };
  var setProgram = function (p) {
    program = p;
    _triggerLoadState();
  };

  // @method TuringMachine.getTape: Getter for Tape instance
  // @method TuringMachine.setTape: Setter for Tape instance
  var getTape = function () { return tape; };
  var setTape = function(t) {
    tape = t;
    _triggerLoadState();
  };

  // @method TuringMachine.getInitialTape: Getter for initial tape as JSON
  var getInitialTape = function () { return deepCopy(initial_tape); };
  var setInitialTape = function (t) {
    initial_tape = t;
    _triggerLoadState();
  };

  // @method TuringMachine.getFinalStates: Getter for final states
  var getFinalStates = function () {
    return final_states;
  };

  // @method TuringMachine.addFinalState
  var addFinalState = function (state) {
    requireState(state);
    final_states.push(state);
    _triggerLoadState();
  };

  // @method TuringMachine.setFinalStates
  var setFinalStates = function (states) {
    for (var k in states)
      require(isState(states[k]),
        "Cannot add non-State object as final state");
    final_states = states;
    _triggerLoadState();
  };

  // @method TuringMachine.getInitialState: Get initial state
  var getInitialState = function () {
    if (state_history.length === 0)
      throw AssertionException("No state assigned to machine");
    return state_history[0];
  };

  // @method TuringMachine.setInitialState: Set initial state
  var setInitialState = function (st) {
    require(isState(st), "Initial state must be state object");
    // TODO: this might desynchronize the length of tape and state history
    if (state_history.length === 0)
      state_history.push(st);
    else
      state_history[0] = st;
    _triggerLoadState();
  };

  // @method TuringMachine.getState: Get current state
  var getState = function () {
    if (state_history.length === 0)
      throw AssertionException("No state assigned to machine");
    return state_history[state_history.length - 1];
  };

  // @method TuringMachine.setState: Set current state
  var setState = function (st) {
    // TODO: if you do this, the state_history should only contain one value, right?
    if (isState(st))
      state_history.push(st);
    else
      state_history.push(state(st));
    _triggerLoadState();
  };

  // @method TuringMachine.getCursor: Return the current cursor Position
  var getCursor = function () {
    return tape.cursor();
  };

  // @method TuringMachine.setCursor: Jump to a certain position on the tape
  var setCursor = function (pos) {
    tape.moveTo(pos);
    triggerEvent('motionFinished');
    _triggerLoadState();
  };

  // @method TuringMachine.getStep: Get number of operations performed so far
  var getStep = function () {
    return step_id;
  };

  // @method TuringMachine.getMachineName: Return the machine name
  var getMachineName = function () {
    return name;
  };

  // @method TuringMachine.setMachineName: Give the machine a specific name
  var setMachineName = function (machine_name) {
    name = machine_name;
    _triggerLoadState();
  };

  // @method TuringMachine.getCursor: Get tape position
  var getCursor = function () {
    return tape.cursor();
  };

  // @method TuringMachine.isAFinalState: Is the given state a final state?
  var isAFinalState = function (st) {
    requireState(st);
    for (var i = 0; i < final_states.length; i++)
      if (final_states[i].equals(st))
        return true;
    return false;
  };

  // @method TuringMachine.finalStateReached: Is the current state a final state?
  var finalStateReached = function () {
    return isAFinalState(getState());
  };

  // @method TuringMachine.undefinedInstruction
  //   Does the current (symbol, state) not have an corresponding instruction?
  var undefinedInstruction = function () {
    return !program.exists(tape.read(), getState());
  };

  // @method TuringMachine.finished: Was a final state reached or
  //   was some instruction not found?
  var finished = function () {
    return finalStateReached() || undefinedInstruction();
  };

  // @method TuringMachine._triggerTapeInstruction:
  //   trigger events corresponding to a tape instruction
  var _triggerTapeInstruction = function (ins) {
    if (ins[0] === "w") {
      triggerEvent('valueWritten', ins[1], ins[2],
        getCursor().diff(position(0)));
    } else if (typeof ins === 'number' && ins[0] < 0) {
      for (var i = 0; i < Math.abs(ins[0]); i++)
        triggerEvent('movementFinished', mot.LEFT);
    } else if (typeof ins === 'number' && ins[0] > 0) {
      for (var i = 0; i < ins[0]; i++)
        triggerEvent('movementFinished', mot.RIGHT);
    } else if (typeof ins === 'number' && ins[0] === 0)
      {}
    else
      throw AssertionException("Unknown instruction");
  };

  // @method TuringMachine._triggerStateUpdated
  var _triggerStateUpdated = function (old_state) {
    triggerEvent('stateUpdated', old_state, getState(),
      isAFinalState(getState()));
  };

  // @method TuringMachine._triggerTransitionFinished
  var _triggerTransitionFinished = function (old_value, old_state, new_value,
    mov, new_state, step)
  {
    new_value = def(new_value, tape.read());
    mov = def(mov, mot.STOP);
    new_state = def(new_state, getState());
    step = def(step, getStep());

    triggerEvent('transitionFinished', old_value, old_state, new_value,
      mov, new_state, step, undefinedInstruction());
  };

  // @method TuringMachine._triggerOutOfHistory
  var _triggerOutOfHistory = function (step) {
    step = def(step, getStep());
    triggerEvent('outOfHistory', step);
  };

  // @method TuringMachine._triggerLoadState
  var _triggerLoadState = function (tap, stat) {
    tap = def(tap, tape.toJSON());
    stat = def(stat, deepCopy(getState()));
    step_id = 0;
    triggerEvent('loadState', deepCopy(getMachineName()),
      deepCopy(tap), stat, deepCopy(getFinalStates()));
  };

  // @method TuringMachine._triggerFinished
  var _triggerFinished = function (undef, finalstate) {
    undef = def(undef, undefinedInstruction());
    finalstate = def(finalstate, finalStateReached());
    if (finalstate) {
      triggerEvent('finalStateReached', getState());
    } else if (undef) {
      // TODO: see TODO at @member events, then remove this
      /*var res =*/ triggerEvent('undefinedInstruction',
        tape.read(), getState());
      /*
      for (var i = 0; i < res.length; i++)
        if (res[i].length === 3)
          return res[i];
      */
    }
    return null;
  };

  // @method TuringMachine.prev: Undo last `steps` operation(s)
  var _prev = function () {
    var outofhistory = function (e) {
      if (e === undefined || e.name === "OutOfHistoryException")
        throw new OutOfHistoryException(getStep());
    };

    // undo step_id
    if (step_id > 0)
      step_id -= 1;
    else {
      outofhistory();
      return false;
    }

    // undo state
    var old_state = state_history.pop();
    _triggerStateUpdated(old_state);

    // undo tape
    var old_value = tape.read();
    try {
      var tapeevents = tape.undo();
      for (var i = 0; i < tapeevents.length; i++) {
        _triggerTapeInstruction(tapeevents[i]);
      }
    } catch (e) {
      outofhistory(e);
    }

    // expect as tape events
    //   0-1 write operation
    //   0-1 movement operation of length 1
    //   and nothing else

    var written_value = null;
    var move_done = null;
    for (var i = 0; i < tapeevents.length; i++) {
      if (written_value === null && tapeevents[i][0] === "w")
        written_value = tapeevents[i][2];
      else if (move_done === null && tapeevents[i][0] === -1)
        move_done = mot.LEFT;
      else if (move_done === null && tapeevents[i][0] === 1)
        move_done = mot.RIGHT;
      else if (tapeevents[i][0] === 0)
        move_done = mot.STOP;
      else
        throw new AssertionException("Tape events of history do not "
          + "describe one iteration");
    }

    step_id -= 1;
    _triggerTransitionFinished(old_value, old_state, written_value, move_done);
  };
  var prev = function (steps) {
    var steps = def(steps, 1);
    for (var i = 0; i < steps; i++)
      _prev();
    return true;
  };

  // @method TuringMachine.next: run `steps` step(s)
  var _next = function () {
    if (finalStateReached()) {
      _triggerFinished(false, true);
      return;
    }
    if (undefinedInstruction()) {
      if (!_triggerFinished(true, false)) {
        return;
      }
    }

    // save current tape configuration
    if (tape.snapshot)
      tape.snapshot();

    // lookup
    var old_value = tape.read();
    var old_state = getState();
    var instr = program.get(old_value, old_state);
    //console.log(old_value.toString(), old_state.toString());

    if (typeof instr === 'undefined')
    {
      instr = _triggerFinished(true, false);
      if (!instr)
        return;
    }

    var new_value = instr.write;
    var move = instr.move;
    var new_state = instr.state;
    //console.log(new_value.toString(), move.toString(), new_state.toString());

    // process write
    tape.write(instr.write);
    var diff = getCursor().diff(position(0));
    triggerEvent('valueWritten', old_value, new_value, diff);

    // process movement
    tape.move(instr.move);
    triggerEvent('movementFinished', instr.move);

    // process state transition
    var old_state = getState();
    state_history.push(instr.state);
    triggerEvent('stateUpdated', old_state, new_state,
      isAFinalState(new_state));

    step_id += 1;

    triggerEvent('transitionFinished', old_value, old_state,
      new_value, move, new_state, step_id, undefinedInstruction());

    if (isAFinalState(new_state)) {
      triggerEvent('finalStateReached', instr.state.toString());
    }
  };
  var next = function (steps) {
    // next `steps` iterations
    steps = def(steps, 1);
    for (var i = 0; i < steps; i++)
      setTimeout(_next, 50 * i);
  };

  // @method TuringMachine.reset: Reset machine to initial state
  //   Event listeners are not removed
  var reset = function () {
    tape.fromJSON(initial_tape);
    state_history = [getInitialState()];
    step_id = 0;
    _triggerLoadState();
  };

  // @method TuringMachine.clone: Clone this machine
  var clone = function () {
    var cloned = new TuringMachine(new Program(), new UserFriendlyTape(),
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

  // @method TuringMachine.fromJSON: Import a Machine
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
      initial_tape.fromJSON(data['initial_tape']);
    if (typeof data['state_history'] !== 'undefined')
      state_history = data['state_history'].map(convState);
    if (typeof data['name'] !== 'undefined')
      name = data['name'];
    if (typeof data['step'] !== 'undefined')
      step_id = parseInt(data['step']);

    require(!isNaN(step_id));
  };

  // @method TuringMachine.toJSON: Get JSON representation
  var toJSON = function () {
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

  _triggerLoadState();
  return {
    addEventListener : addEventListener,
    triggerEvent : triggerEvent,
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
    getInitialState : getInitialState,
    setInitialState : setInitialState,
    getState : getState,
    setState : setState,
    getCursor : getCursor,
    setCursor : setCursor,
    getStep : getStep,
    getMachineName : getMachineName,
    setMachineName : setMachineName,
    finalStateReached : finalStateReached,
    undefinedInstruction : undefinedInstruction,
    finished : finished,
    prev : prev,
    next : next,
    reset : reset,
    clone : clone,
    fromJSON : fromJSON,
    toJSON : toJSON
  };
};

// ------------------------- LockingTuringMachine -------------------------

var LockingTuringMachine = function (program, tape, final_states, initial_state) {
  var tm = new TuringMachine(program, tape, final_states, initial_state);

  // @member LockingTuringMachine.locked: Locking state of TM
  var locked = false;

  // @method LockingTuringMachine.lock: Lock this TM to disable it to run any steps
  var lock = function () {
    locked = true;
  };

  // @method LockingTuringMachine.release:
  //   Release this TM to enable it to run any steps again
  var release = function () {
    locked = false;
  };

  return inherit(tm, {
    lock : lock,
    release : release,
    locked : function () { return locked }
  });
}

// ------------------------ RunningTuringMachine --------------------------

var RunningTuringMachine = function (program, tape, final_states, initial_state) {
  var tm = new LockingTuringMachine(program, tape, final_states, initial_state);

  // @member RunningTuringMachine.running:
  //   positive while turingmachine should still next x steps
  var running = 0;
  // @member RunningTuringMachine.running_last_state:
  //   Logs the last state which was recognized as event
  var running_last_state = false;

  // @method RunningTuringMachine.prepareIteration:
  //   Perform all check before actually running one iteration
  var prepareIteration = function () {
    if (tm.finalStateReached() || tm.undefinedInstruction())
      running = 0;

    if (running === 0 && !running_last_state) {
      return;
    } else if (running > 0 && !running_last_state) {
      tm.triggerEvent('startRun');
      running_last_state = true;
    } else if (running === 0 && running_last_state) {
      tm.triggerEvent('stopRun');
      running_last_state = false;
      return;
    }

    var successor = function () {
      setTimeout(prepareIteration, 400);
    };

    running -= 1;
    console.log(this);
    this.reiterate(successor);
  };

  // @method RunningTuringMachine.iterate:
  //   Wrapper to compute next step
  var iterate = function (done) {
    tm.next();
    tm.addEventListener('transitionFinished', done, 1);
  };

  // @method RunningTuringMachine.reiterate:
  //   Iterate next step of turingmachine by doing some asynchronous
  //   operation and eventually calling the callback `done`
  var reiterate = function (done) {
    // REMARK you need to overload me
    iterate(done);
  };

  // @method RunningTuringMachine.next: Run operations until a final state is reached
  var next = function (steps) {
    steps = def(steps, 1);
    if (running === Infinity) {
      running = steps;
      console.warn("Interrupt running turingmachine for some steps?"
        + " Awkward happening");
      tm.triggerEvent('stopRun');
      running_last_state = false;
      prepareIteration();
      return true;
    } else if (running === 0) {
      running = steps;
      prepareIteration();
      return true;
    } else {
      console.warn("Overwriting request to compute "
        + running + " steps with " + steps + " steps");
      running = steps;
      prepareIteration();
      return false;
    }
  };

  // @method RunningTuringMachine.run: Run operations until a final state is reached
  var run = function () {
    if (running === Infinity) {
      console.warn("Cannot run running turingmachine");
      return false;
    } else {
      running = Infinity;
      tm.triggerEvent('startRun');
      running_last_state = true;
      prepareIteration();
      return true;
    }
  };

  // @method RunningTuringMachine.run: Run operations until a final state is reached
  var interrupt = function () {
    if (running === Infinity) {
      running = 0;
      tm.triggerEvent('stopRun');
      running_last_state = false;
      return true;
    } else if (running === 0) {
      return false;
    } else {
      running = 0;
      return true;
    }
  };

  return inherit(tm, {
    reiterate : reiterate,
    iterate : iterate,
    next : next,
    run : run,
    interrupt : interrupt
  });
}

// ------------------------- AnimatedTuringmachine ------------------------

function defaultAnimatedTuringMachine(symbol_norm_fn, state_norm_fn,
  gear_viz, num_viz, ui_tm, ui_meta, ui_data)
{
  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);
  state_norm_fn = def(state_norm_fn, normalizeState);

  var s = function (v) { return state(v, state_norm_fn) };

  return new AnimatedTuringMachine(defaultProgram(),
    defaultUserFriendlyTape(symbol_norm_fn),
    [s("End"), s("Ende")], s("Start"), gear_viz, num_viz,
    ui_tm, ui_meta, ui_data);
}

// @object AnimatedTuringMachine: A visualized TuringMachine

var AnimatedTuringMachine = function (program, tape, final_states,
  initial_state, gear, numbers, ui_tm, ui_meta, ui_data)
{
  // @member AnimatedTuringMachine.gear: Animation of gear
  // @member AnimatedTuringMachine.numbers: Animation of numbers

  // TODO: must support any arbitrary number of values to visualize

  ui_tm = $(ui_tm);
  ui_meta = $(ui_meta);
  ui_data = $(ui_data);

  require(ui_tm.length !== 0, "unknown " + ui_tm.selector);
  require(ui_meta.length !== 0, "unknown " + ui_meta.selector);
  require(ui_data.length !== 0, "unknown " + ui_data.selector);

  // @member AnimatedTuringMachine.tm: Machine instance
  var tm = new RunningTuringMachine(program, tape, final_states, initial_state);

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


  // HELPERS

  // @method AnimatedTuringMachine._initialize:
  //   Initialize this turingmachine
  var _initialize = function () {
    tm.addEventListener('loadState', function (machine_name, _tape, state, final_states) {
      // update machine_name
      ui_meta.find(".machine_name").val(machine_name);

      // update tape
      numbers.setNumbers(tape.read(undefined, 7).map(toJson)); // TODO: non-static 7

      // update state
      _updateStateInUI(state, tm.finalStateReached(), tm.undefinedInstruction(), tm.getTape().read());

      // update final_states
      ui_meta.find(".final_states").val(final_states.map(toStr));
    });
  };


  // @method AnimatedTuringMachine._triggerLoadState:
  //   trigger loadState event
  var _triggerLoadState = function () {
    triggerEvent('loadState', tm.getMachineName(),
      tm.getTape().toJSON(), tm.getState(),
      tm.getFinalStates());
  };

  // @method AnimatedTuringMachine._triggerLoadState:
  //   if locked, throw error that TM is locked
  var _lockingCheck = function (action) {
    if (tm.locked()) {
      action = def(action, "proceed");
      console.warn("Trying to " + action + " but turing machine is locked in UI");
      console.trace();
      throw new Error("Trying to " + action + " but turing machine is locked in UI");
    }
    return true;
  };

  // @method AnimatedTuringMachine.beforeMoveAnimation:
  //   Do whatever needs to be done before running a move animation
  var _beforeMoveAnimation = function () {
    // TODO: not sure whether this is a good idea
    /*
    ui_tm.find(".control_prev").attr("disabled", true);
    ui_tm.find(".control_next").attr("disabled", true);
    ui_tm.find(".control_reset").attr("disabled", true);
    ui_tm.find(".control_run").attr("disabled", true);
    */
  };

  // @method AnimatedTuringMachine.afterMoveAnimation:
  //   Do whatever needs to be done after running a move animation
  var _afterMoveAnimation = function () {
    // TODO: not sure whether this is a good idea
    /*
    ui_tm.find(".control_prev").attr("disabled", false);
    ui_tm.find(".control_next").attr("disabled", false);
    ui_tm.find(".control_reset").attr("disabled", false);
    ui_tm.find(".control_run").attr("disabled", false);
    */
  };

  // @method AnimatedTuringMachine._updateStateInUI: update the state on the UI
  var _updateStateInUI = function (state, is_final, is_undefined, undefined_symbol) {
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

  // @method TuringMachine.addEventListener: event listener definition
  var addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method TuringMachine.triggerEvent: trigger event
  var triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method AnimatedTuringMachine.enableAnimation
  var enableAnimation = function () {
    animation_enabled = true;
  };

  // @method AnimatedTuringMachine.disableAnimation
  var disableAnimation = function () {
    animation_enabled = false;
  };

  // @method AnimationTuringMachine.isAnimationEnabled
  var isAnimationEnabled = function () {
    return animation_enabled;
  };

  // @method AnimatedTuringMachine.speedUp: Increase speed
  var speedUp = function () {
    if (speed <= 200)
      return false;
    speed = parseInt(speed / 1.05);
    gear.setSpeed(speed);
    numbers.setSpeed(speed);
    triggerEvent('speedUpdated', speed);
    return true;
  };

  // @method AnimatedTuringMachine.speedDown: Decrease speed
  var speedDown = function () {
    speed = parseInt(speed * 1.05);
    gear.setSpeed(speed);
    numbers.setSpeed(speed);
    triggerEvent('speedUpdated', speed);
    return true;
  };




  // API

  // @method AnimatedTuringMachine.getNumbersFromViz:
  //   get numbers from NumberVisualization
  var getNumbersFromUI = function () {
    return numbers.getNumbers();
  };

  // @method AnimatedTuringMachine.getCurrentTapeSymbols:
  //   get `count` current tape symbols
  var getCurrentTapeSymbols = function (count) {
    count = parseInt(count);
    require(!isNaN(count));
    var selection = tm.getTape().read(undefined, count);

    require(selection.length === count,
      "Bug: Size of selected elements invalid");

    return selection;
  };

  // @method AnimatedTuringMachine.prev: Undo one step
  var prev = function () {
    if (!_lockingCheck('undo one step'))
      return;
    tm.lock();
    // TODO: if (history is empty) triggerEvent('outOfHistory'); return;

    // TODO: undo state
    // TODO: triggerEvent('stateUpdated', old state, new state, false)

    // TODO: if (!animation_enabled || speed < speed_limit)
    //         jump one motion back
    //       else move one motion back
    // TODO: triggerEvent('movementFinished', motion)

    // TODO: if (!animation_enabled || speed < speed_limit)
    //         write previous symbol directly
    //       else write previous symbol
    // TODO: triggerEvent('valueWritten', old value, new value, position relative to cursor)

    // TODO: triggerEvent('transitionFinished', old value, old state, new value, movement,
    //          new state, step id, undefined instruction is given for next transition)

    // TODO: reduce history

    throw new Error("Feature not yet available");
    tm.release();
    return true;
  };

  // @method AnimatedTuringMachine.reiterate: Go on one step
  var reiterate = function (done) {
    if (!_lockingCheck('iterate to next step'))
      return;
    if (tm.finalStateReached()) {
      console.warn("final state already reached");
      return;
    }
    if (tm.undefinedInstruction()) {
      console.warn("undefined instruction given");
      return;
    }
    tm.lock();

    var counter = 0;
    var params = {};

    var waitForAll3Events = function () {
      tm.addEventListener('valueWritten', function (old_value, new_value, pos_rel) {
        counter += 1;
        params['valueWritten'] = [old_value, new_value, pos_rel];
        if (counter === 3)
          setTimeout(initiateNumberWriteAndGearMove, 30);
      }, 1);

      tm.addEventListener('movementFinished', function (move) {
        counter += 1;
        params['movementFinished'] = [move];
        if (counter === 3)
          setTimeout(initiateNumberWriteAndGearMove, 30);
      }, 1);

      tm.addEventListener('stateUpdated', function (old_state, new_state, final_state_reached) {
        counter += 1;
        params['stateUpdated'] = [old_state, new_state, final_state_reached];
        if (counter === 3)
          setTimeout(initiateNumberWriteAndGearMove, 30);
      }, 1);
    };

    var initiateNumberWriteAndGearMove = function () {
      numbers.addEventListener('writeFinished', function () {
        triggerEvent('valueWritten', params['valueWritten'][0],
          params['valueWritten'][1], params['valueWritten'][2]);
        setTimeout(initiateNumberMotion, 30);
      }, 1);

      var new_str_value = toStr(toJson(params['valueWritten'][1]));
      if (!animation_enabled || speed < speed_limit)
        numbers.writeNumberFast(new_str_value);
      else
        numbers.writeNumber(new_str_value);

      // TODO: move gear
    };

    var initiateNumberMotion = function () {
      numbers.addEventListener('moveFinished', function () {
        triggerEvent('movementFinished', params['movementFinished'][0]);
        setTimeout(initiateStateUpdate, 30);
      }, 1);

      var move = params['movementFinished'][0];
      // TODO: non-static 7/9
      // REMARK be aware that the tape already moved
      if (!animation_enabled || speed < speed_limit) {
        if (move.equals(mot.LEFT))
          numbers.moveRightFast(toStr(toJson(tm.getTape().read(undefined, 9)[1])));
        else if (move.equals(mot.RIGHT))
          numbers.moveLeftFast(toStr(toJson(tm.getTape().read(undefined, 9)[7])));
        else if (move.equals(mot.HALT) || move.equals(mot.STOP))
          numbers.moveNot();
      } else {
        if (move.equals(mot.LEFT))
          numbers.moveRight(toStr(toJson(tm.getTape().read(undefined, 9)[1])));
        else if (move.equals(mot.RIGHT))
          numbers.moveLeft(toStr(toJson(tm.getTape().read(undefined, 9)[7])));
        else if (move.equals(mot.HALT) || move.equals(mot.STOP))
          numbers.moveNot();
      }
      _afterMoveAnimation();
    };

    var initiateStateUpdate = function () {
      var old_state = params['stateUpdated'][0];
      var new_state = params['stateUpdated'][1];
      var final_state_reached = params['stateUpdated'][2];

      _updateStateInUI(new_state, final_state_reached, tm.undefinedInstruction(), tm.getTape().read());
      triggerEvent('stateUpdated', old_state, new_state, final_state_reached);

      triggerEvent('transitionFinished', params['valueWritten'][0],
          params['stateUpdated'][0], params['valueWritten'][1],
          params['movementFinished'][0], params['stateUpdated'][1],
          tm.getStep(), tm.undefinedInstruction()
      );

      if (tm.finalStateReached())
        setTimeout(function () {
          triggerEvent('finalStateReached', new_state);
        }, 30);
      else if (tm.undefinedInstruction())
        setTimeout(function () {
          triggerEvent('undefinedInstruction', new_value, new_state);
        }, 30);

      tm.release();
      done();
    };

    waitForAll3Events();
    _beforeMoveAnimation();
    tm.iterate();

    return true;
  };

  // @method AnimatedTuringMachine.interrupt: Interrupt running TM
  var interrupt = function () {
    if (!_lockingCheck('interrupting the machine'))
      return;
    tm.lock();
    tm.interrupt();
    tm.release();
    return true;
  };

  // @method AnimatedTuringMachine.reset: Reset machine to initial state
  var reset = function () {
    if (!_lockingCheck('resetting a run'))
      return;
    tm.lock();
    tm.reset();
    syncToUI();
    tm.release();
    return true;
  };

  var toString = function () {
    return "[AnimatedTuringMachine '" + tm.getMachineName() + "']";
  };

  // API - Import & Export

  // @method AnimatedTuringMachine.syncFromUI:
  //   Take all values from the UI and insert them into the TM state
  var syncFromUI = function () {
    if (!_lockingCheck('synchronize state from GUI'))
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
    tm.getTape().left(steps);
    for (var i = 0; i < vals.length; i++) {
      tm.getTape().write(symbol(vals[i]));
      if (i !== vals.length - 1)
        tm.getTape().right();
    }
    tm.getTape().left(steps);

    // get state
    tm.setState(state(ui_tm.find(".state").text()));

    // get steps count
    ui_settings['steps_back'] = steps_prev;
    ui_settings['steps_continue'] = steps_next;

    // get machine name
    tm.setMachineName(ui_meta.find(".machine_name").val());

    // ignore 'Load tape'

    // get 'Final states'
    var fs_string = ui_data.find(".final_states").val();
    final_states = fs_string.split(/\s*,\s*/)
        .map(function (s) { return state(s); });
    tm.setFinalStates(final_states);

    // read 'transition table'
    tm.getProgram().clear();
    ui_data.find(".transition_table tbody tr").each(function () {
      var from_symbol = $(this).find("td:eq(0) input").val();
      var from_state = $(this).find("td:eq(1) input").val();
      var write_symbol = $(this).find("td:eq(2) input").val();
      var move = $(this).find("td:eq(3) select").val();
      var to_state = $(this).find("td:eq(4) input").val();

      tm.getProgram().set(
        symbol(from_symbol), state(from_state),
        symbol(write_symbol), mot[move.toUpperCase()], state(to_state)
      );
    });
  };

  // @method AnimatedTuringMachine.syncToUI:
  //   Write the current TM state to the UI
  var syncToUI = function () {
    if (!_lockingCheck('synchronize state to GUI'))
      return;

    // animation enabled?
    ui_tm.find("input[name='wo_animation']").prop("checked", !animation_enabled);

    // set numbers
    var vals = tm.getTape().read(undefined, 7); // TODO non-static 7
    numbers.setNumbers(vals.map(toJson).map(toStr));

    // set state
    _updateStateInUI(state(ui_tm.find(".state").text()),
      tm.finalStateReached(), tm.undefinedInstruction(),
      tm.getTape().read());

    // set steps count
    ui_tm.find(".steps_prev").val(ui_settings['steps_back']);
    ui_tm.find(".steps_next").val(ui_settings['steps_continue']);

    // set machine name
    ui_meta.find(".machine_name").val(tm.getMachineName());

    // set 'Load tape'
    ui_data.find(".tape").val(tape.toHumanString());

    // set 'Final states'
    var fs = tm.getFinalStates().map(toStr).join(", ");
    ui_data.find(".final_states").val(fs);

    // write 'transition table'
    ui_data.find(".transition_table tbody tr").slice(1).remove();
    ui_data.find(".transition_table tbody td").each(function () {
      if ($(this).find("input").length > 0)
        $(this).find("input").val("");
    });

    var prg = tm.toJSON()['program'];
    for (var row = 0; row < prg.length; row++) {
      var prelast = ui_data.find(".transition_table tbody tr").last();

      // copy last row
      var clone = prelast.clone();
      clone.removeClass("nondeterministic deterministic");
      ui_data.find(".transition_table tbody").append(clone);

      // fill prelast with data
      prelast.find("td:eq(0) input").val(prg[row][0] || "");
      prelast.find("td:eq(1) input").val(prg[row][1] || "");
      prelast.find("td:eq(2) input").val(prg[row][2][0] || "");
      prelast.find("td:eq(3) select").val(prg[row][2][1] || "Stop");
      prelast.find("td:eq(4) input").val(prg[row][2][2] || "");
    }
  };

  // @method AnimatedTuringMachine.fromJSON: Import object state from JSON dump
  var fromJSON = function (data) {
    interrupt();

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
    ops.clear();
    _triggerLoadState();
    tm.release();
  };

  // @method AnimatedTuringMachine.toJSON: Export object state to JSON dump
  var toJSON = function () {
    interrupt();

    var data = tm.toJSON();
    data['speed'] = speed;
    data['animations'] = animation_enabled;

    return data;
  };

  _initialize();

  // take over:
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

  return inherit(tm, {
    addEventListener : addEventListener,
    triggerEvent : triggerEvent,
    toString : toString,
    toJSON : toJSON,
    fromJSON : fromJSON,
    getNumbersFromUI : getNumbersFromUI,
    getCurrentTapeSymbols : getCurrentTapeSymbols,
    reset : reset,
    prev : prev,
    interrupt : interrupt,
    enableAnimation : enableAnimation,
    disableAnimation : disableAnimation,
    isAnimationEnabled : isAnimationEnabled,
    speedUp : speedUp,
    speedDown : speedDown,
    syncToUI : syncToUI,
    syncFromUI : syncFromUI
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

  var N_SUCCESS = "(ok) Testcase '%1' succeeded.";
  var N_FAILURE = "(fail) Testcase '%1' failed.";

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
  var triggerEvent = function (evt) {
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
    if (typeof tap['blank_symbol'] === 'undefined')
      tap['blank_symbol'] = "0";
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

    if (typeof out['motion_done'] !== 'undefined')
      if (!move_done)
        return { success : false, msg :
          'Expected motion "' + out['motion_done'] + '" to happen ' +
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
      var err = 'Expected blank_symbol "%1" at tape, but was "%2"';

      if (typeof expected['blank_symbol'] !== 'undefined')
        if (expected['blank_symbol'] !== actual['blank_symbol'])
          return { success : false, msg : err.replace('%1', expected['blank_symbol'])
                   .replace('%2', actual['blank_symbol']) };

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
    if (typeof testcase['output']['motion_done'] !== 'undefined')
      tm.addEventListener('motionFinished', function (move) {
        if (move.equals(motion(testcase['output']['motion_done'])))
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
  var _createNumber = function (value, classes, left) {
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
  var _rebuildValues = function () {
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
  var _assignSemanticalTapeClasses = function () {
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
  var _tapeWidth = function () {
    var padding = ui_root.css('padding-left') || 0;
    if (padding)
      padding = parseInt(padding.substr(0, padding.length - 2));
    return (ui_root[0].clientWidth - 2 * padding || 700);
  };

  // @method NumberVisualization._initialize: Initialize visualization
  var _initialize = function () {
    locked = true;

    // create .numbers .value instances
    setNumbers(values);

    // assign CSS classes
    _assignSemanticalTapeClasses();

    // define left padding
    var computedWidth = width_one_number * (values.length - 1);
    computedWidth += width_main_number;
    var actualWidth = _tapeWidth();
    var diff = actualWidth - computedWidth;

    // define left padding of visualization
    ui_root.find(".numbers").css("padding-left", parseInt(diff / 2) + "px");

    locked = false;
  };

  // @method NumberVisualization.addEventListener: event listener definition
  var addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method NumberVisualization.triggerEvent: trigger event
  var triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method NumberVisualization.getSpeed: Get speed value
  var getSpeed = function () {
    return speed;
  };

  // @method NumberVisualization.setSpeed: Set speed value
  var setSpeed = function (val) {
    speed = val;
  };

  // @method NumberVisualization.setNumbers: Set values for .numbers
  //   This method ensures that values.length DOM elements exist
  //   and set all text contents to the values
  var setNumbers = function (values) {
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
  var getNumbers = function () {
    return ui_root.find(".numbers .value").map(function () {
      return $(this).text();
    }).get();
  };

  // @method NumberVisualization.writeNumber: Animate value writing for the cursor
  var writeNumber = function (new_value) {
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
    ui_root.find(".writer")[0].addEventListener("animationend", function () {
      $(this).removeClass("animated_writer");

      // clone element and destroy element
      var original = ui_root.find(".writer");
      var copy = original.clone();
      original.after(copy);
      original.first().remove();

      triggerEvent('writeFinished', old_value, new_value);
      locked = false;
    }, true);
  };

  // @method NumberVisualization.writeNumberFast: Animate value writing in high-speed
  var writeNumberFast = function (new_value) {
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

    triggerEvent('writeFinished', old_value, new_value);
    locked = false;
  };

  // @method NumberVisualization.moveLeft: Move numbers to the left
  var moveLeft = function (new_value) {
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
          _rebuildValues();

          // assign semantic CSS classes such as lleft
          _assignSemanticalTapeClasses();

          // trigger callback
          triggerEvent('moveFinished', getNumbers(), new_value, 'left');

          locked = false;
        }
      }, true);
    });
  };

  // @method NumberVisualization.moveRight: Move numbers to the right
  var moveRight = function (new_value) {
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
          _rebuildValues();

          // assign semantic CSS classes such as lleft
          _assignSemanticalTapeClasses();

          // trigger callback
          triggerEvent('moveFinished', getNumbers(), new_value, 'right');

          locked = false;
        }
      }, true);
    });
  };

  // @method NumberVisualization.moveNot: Do not really move, but invoke events
  //    useful for HALT and STOP motions
  var moveNot = function () {
    triggerEvent('moveFinished', getNumbers(), null, 'stop');
  };

  // @method NumberVisualization.moveLeftFast: Move numbers to the left fast
  var moveLeftFast = function (new_value) {
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
    _assignSemanticalTapeClasses();

    // trigger callback
    triggerEvent('moveFinished', getNumbers(), new_value, 'right');

    locked = false;
  };

  // @method NumberVisualization.moveRightFast: Move numbers to the right fast
  var moveRightFast = function (new_value) {
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
    _assignSemanticalTapeClasses();

    // trigger callback
    triggerEvent('moveFinished', getNumbers(), new_value, 'right');

    locked = false;
  };

  _initialize();

  return {
    addEventListener : addEventListener,
    triggerEvent : triggerEvent,
    setNumbers: setNumbers,
    getNumbers: getNumbers,
    setSpeed: setSpeed,
    getSpeed: getSpeed,
    moveLeft: moveLeft,
    moveRight: moveRight,
    moveNot: moveNot,
    moveLeftFast: moveLeftFast,
    moveRightFast: moveRightFast,
    writeNumber: writeNumber,
    writeNumberFast: writeNumberFast
  }
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

  // @method GearVisualization.addEventListener: event listener definition
  var addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method GearVisualization.triggerEvent: trigger event
  var triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method GearVisualization.setSpeed: define the animation speed in milliseconds
  var setSpeed = function (sp) {
    require(!isNaN(parseInt(sp)));
    speed = parseInt(sp);
  };

  // @method GearVisualization.getSpeed: Get the animation speed in milliseconds
  var getSpeed = function () {
    return speed;
  };

  // Turingmachine API

  // @method GearVisualization.addStepsLeft: Add an operation 'move to left'
  var addStepsLeft = function (count) {
    if (count === undefined)
      count = 1;

    for (var i = 0; i < count; i++)
      queue.push(-1);

    if (!currently_running)
      nextAnimation();
  };

  // @method GearVisualization.addStepsRight: Add an operation 'move to right'
  var addStepsRight = function (count) {
    if (count === undefined)
      count = 1;

    for (var i = 0; i < count; i++)
      queue.push(+1);

    if (!currently_running)
      nextAnimation();
  };

  // @method GearVisualization.done: Stop animation
  var done = function () {
    currently_running = false;
    triggerEvent('animationFinished');
    if (queue.isEmpty()) {
      triggerEvent('animationsFinished');
      return;
    }
  };

  // animation

  // @method GearVisualization.nextAnimation: Trigger the next animation
  var nextAnimation = function () {
    if (queue.isEmpty()) {
      triggerEvent('animationsFinished');
      return;
    }

    var steps = queue.pop();

    startAnimation({
      animationTimingFunction: (Math.abs(steps) > 1) ? "linear" : "ease-in-out",
      animationName: "gear-" + (steps < 0 ? "left" : "right"),
      animationIterationCount: Math.abs(steps),
      animationDuration: speed
    });
  };

  // @method GearVisualization.startAnimation: Start the animations
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

    var oldGear = ui_gear.find('.gear-animation');
    var oldUid = parseInt(oldGear.getAttribute('data-uid'));
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

    newGear[0].addEventListener("animationend", function () {
      done();
      nextAnimation();
    }, false);
  };

  return {
    addEventListener : addEventListener, triggerEvent : triggerEvent,
    setSpeed : setSpeed, getSpeed : getSpeed, done : done,
    addStepsLeft: addStepsLeft, addStepsRight: addStepsRight
  };
};

// ------------------------------ TuringMarket ----------------------------

// A turing market holds JSON data of various markets, where the JSON
// represents programs, testcases, etc

var TuringMarket = function (default_market, markets, ui_notes, ui_tm, ui_meta, ui_data) {
  // @member TuringMarket.default_market: the market used per default

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
  //   [invoked whenever TuringMarket.activateProgram(program) was invoked]
  // @callback testcaseActivated(testcase, testcase_data)
  //   [invoked whenever TuringMarket.activateTestcase(testcase) was invoked]

  // @member TuringMarket.events: EventRegister for events of this object
  var events = new EventRegister([
    'programLoading', 'programVerified', 'programReady',
    'programActivated', 'testcaseActivated'
  ]);

  // @member TuringMarket.programs: The actual loaded markets
  var programs = {};

  // @member TuringMarket.auto_activate_program:
  //    markets to activate after calling activateWhenReady with a program
  var autoactivate_program = {};

  // @member TuringMarket.auto_activate_testcase:
  //    markets to activate after calling activateWhenReady with a testcase
  var autoactivate_testcase = {};

  // @member TuringMarket.loading_timeout: maximum loading timeout
  var loading_timeout = 7000;


  // @method TuringMarket._normId: Split an identifier
  var _normId = function (id) {
    // TODO: fails if testcase name contains "/"
    require(id, "Market idenitifier must not be undefined");
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

  // @method TuringMarket.addEventListener: event listener definition
  var addEventListener = function (evt, callback, how_often) {
    return events.add(evt, callback, how_often);
  };

  // @method TuringMarket.triggerEvent: trigger event
  var triggerEvent = function (evt) {
    return events.trigger.apply(this, arguments);
  };

  // @method TuringMarket.loaded: Was given program loaded?
  var loaded = function (program_id) {
    var id = _normId(program_id).slice(0, 2).join(":");
    return programs[id] !== undefined;
  };

  // @method TuringMarket.get: Get the defined program (or undefined)
  var get = function (program_id) {
    var id = _normId(program_id).slice(0, 2).join(":");
    return programs[id];
  };

  // @method TuringMarket.add: Synchronously add a market
  var add = function (program_id, data) {
    var normalized = _normId(program_id);
    var id = normalized.slice(0, 2).join(":");
    require(normalized[2] === undefined, "ID must not refer to a testcase");

    triggerEvent('programLoading', id);
    var report = verifyProgram(data);
    triggerEvent('programVerified', id, report);
    if (report)
      return false;

    programs[id] = data;
    triggerEvent('programReady', id, data);

    if (autoactivate_program[id])
      activateProgram(id);
    else if (autoactivate_testcase[id] && autoactivate_testcase[id].length > 0)
      for (var i = 0; i < autoactivate_testcase[id].length; i++)
        activateTestcase(autoactivate_testcase[id][i]);
  };

  // @method TuringMarket.load: Asynchronously add a market
  var load = function (program_id) {
    var normalized = _normId(program_id);
    var id = normalized.slice(0, 2).join(":");
    var market = normalized[0];
    var program = normalized[1];

    if (programs[id] !== undefined) {
      console.warn(id + " already loaded");
      return;
    }

    triggerEvent('programLoading', id);

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
      triggerEvent('programVerified', id, report);
      if (report) {
        console.warn("Program " + id + " is not correctly formatted");
        console.debug(report);
        return;
      }

      // set ready
      programs[id] = data;
      triggerEvent('programReady', id, data);

      if (autoactivate_program[id])
        activateProgram(id);
      else if (autoactivate_testcase[id] && autoactivate_testcase[id].length > 0)
        for (var i = 0; i < autoactivate_testcase[id].length; i++)
          activateTestcase(autoactivate_testcase[id][i]);
    }, "json");
  };

  // @method TuringMarket.activateWhenReady: The next time the given market
  //   is available, activate it
  var activateWhenReady = function (program_id) {
    var normalized = _normId(program_id);
    var program_id = normalized.slice(0, 2).join(":");
    var testcase_id = normalized.slice(0, 3).join(":");

    if (normalized[2] === undefined) {
      // refers to program
      if (programs[program_id] !== undefined)
        activateProgram(program_id);
      else
        autoactivate_program[program_id] = true;
    } else {
      // refers to testcase
      if (programs[program_id] !== undefined)
        activateTestcase(testcase_id);
      else
        autoactivate_testcase[program_id].push(testcase_id);
    }
  };

  // @method TuringMarket.activateProgram: Activate a given program
  //   meaning a programActivated event will be fired and the
  //   program JSON will be passed over
  var activateProgram = function (program_id) {
    var normalized = _normId(program_id);
    var id = normalized.slice(0, 2).join(":");
    require(normalized[2] === undefined,
      "Market ID must refer to program, not testcase");

    require(programs[id] !== undefined, "Program " + id
      + " is not yet available");

    triggerEvent('programActivated', id, programs[id]);
    autoactivate_program[id] = false;
  };

  // @method TuringMarket.activateTestcase: Activate a given testcase
  //   meaning a testcaseActivated event will be fired and the
  //   testcase JSON will be passed over
  var activateTestcase = function (testcase_id) {
    var normalized = _normId(testcase_id);
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

    triggerEvent('testcaseActivated', testcase_id, data);
    autoactivate_testcase[program_id] = autoactivate_testcase[program_id].filter(
      function (v) { return v !== testcase_id; }
    );
  };

  return {
    addEventListener : addEventListener,
    triggerEvent : triggerEvent,
    loaded : loaded,
    get : get,
    add : add,
    load : load,
    activateProgram : activateProgram,
    activateTestcase : activateTestcase,
    activateWhenReady : activateWhenReady,
  };
};

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

var GUI = function (app, ui_tm, ui_meta, ui_data, ui_notes, ui_gear) {
  // @method GUI.initialize: Initialize the GUI with the TM
  var initialize = function () {
    // UI events
    /// UI events - controls
    ui_tm.find(".control_next").click(function () {
      try {
        var how_many_steps = parseInt(ui_tm.find(".steps_next").val());
        if (isNaN(how_many_steps)) {
          alertNote("Invalid steps count given. Assuming 1.");
          how_many_steps = 1;
        }
        app.tm().next(how_many_steps);
        showRunningControls();
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_tm.find(".control_prev").click(function () {
      try {
        var how_many_steps = parseInt(ui_tm.find(".steps_prev").val());
        if (isNaN(how_many_steps)) {
          alertNote("Invalid steps count given. Assuming 1.");
          how_many_steps = 1;
        }
        app.tm().prev(how_many_steps);
        showRunningControls();
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_tm.find(".control_slower").click(function () {
      try {
        if (app.tm().speedDown())
          alertNote("Animation speed updated");
        else
          alertNote("I think this is slow enough. Sorry!");
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_tm.find(".control_faster").click(function () {
      try {
        if (app.tm().speedUp())
          alertNote("Animation speed updated");
        else
          alertNote("I think this is fast enough. Sorry!");
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_tm.find(".control_reset").click(function () {
      try {
        app.tm().reset();
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_tm.find(".control_run").click(function () {
      try {
        if (!UI['run'](ui_tm, tm))
          UI['alertNote'](ui_notes, "Could not start run of turingmachine. Is it running already?");
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_tm.find(".control_interrupt").click(function () {
      try {
        if (!UI['interrupt'](ui_tm, tm))
          UI['alertNote'](ui_notes, "Could not interrupt. It is not running.");
      } catch (e) {
        alertNote(e.message);
      }
    });

    ui_tm.find("input[name=wo_animation]").change(function () {
      try {
        var is_disabled = ui_tm.find("input[name='wo_animation']").is(":checked");
        if (is_disabled)
          app.tm().disableAnimation();
        else
          app.tm().enableAnimation();
      } catch (e) {
        alertNote(e.message);
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
        alertNote(e.message);
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
        alertNote(e.message);
      }
    });
    $("#overlay_text .import").click(function () {
      try {
        var data = $("#overlay_text .data").val();
        var format = $("#overlay_text .export_format").val();
        UI['import'](ui_notes, ui_meta, ui_tm, ui_data, tm, data, format);
      } catch (e) {
        alertNote(e.message);
      }
    });

    ui_tm.find(".export_button").click(function () {
      try {
        toggle_overlay();

        $("#overlay_text .action").text("Export");
        $("#overlay_text .data").attr("readonly", true);
        $("#overlay_text .import").hide();

        UI['export'](tm, $("#overlay_text").find(".export_format").val());
      } catch (e) {
        alertNote(e.message);
      }
    });
    $("#overlay_text .export_format").change(function () {
      try {
        var is_export = $("#overlay_text .action").text().indexOf("Export") !== -1;
        if (is_export)
          UI['export'](tm, $("#overlay_text").find(".export_format").val());
      } catch (e) {
        alertNote(e.message);
      }
    });

    /// UI events - meta
    ui_meta.find(".testcase_run").click(function () {
      try {
        UI['alertNote'](ui_notes, "That feature is not yet available");
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_meta.find(".testcase_runall").click(function () {
      try {
        UI['alertNote'](ui_notes, "That feature is not yet available");
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_meta.find(".example").change(function () {
      try {
        var current_program = ui_meta.find(".example option:selected").attr("data-program-id");
        changeExampleProgram(null, app.market().get(current_program));
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_meta.find(".example_run").click(function () {
      try {
        var current_program = ui_meta.find(".example option:selected").attr("data-program-id");
        app.market().activateProgram(current_program);
      } catch (e) {
        alertNote(e.message);
      }
    });
    ui_meta.find(".machine_name").change(function () {
      try {
        var new_name = UI['getMachineName'](ui_meta);
        tm.setMachineName(new_name);

        UI['alertNote'](ui_notes, "Machine name updated!");
      } catch (e) {
        alertNote(e.message);
      }
    });

    /// UI events - data
    ui_data.find(".final_states").change(function () {
      try {
        var final_states = UI['getFinalStates'](ui_data);
        tm.setFinalStates(final_states);
        var out = final_states.map(function (v) { return v.toString(); });
        if (out.length > 1)
          UI['alertNote'](ui_notes, "Final states set:\n" + out.slice(0, -1)
            + " and " + out[out.length - 1] + "");
        else
          UI['alertNote'](ui_notes, "Final state " + out[0] + " set.");
      } catch (e) {
        alertNote(e.message);
      }
    });

    ui_data.find(".tape").change(function () {
      try {
        var string = $(this).parent().find(".tape").val();
        tm.getTape().fromHumanString(string);
        var vals = tm.getCurrentTapeSymbols();

        var i = 0;
        $(".turingmachine .value").each(function () {
          $(this).text(vals[i++]);
        });

        UI['alertNote'](ui_notes, "Tape updated!");
      } catch (e) {
        alertNote(e.message);
      }
    });

    ui_data.find(".transition_table").change(function () {
      try {
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
      } catch (e) {
        alertNote(e.message);
      }
    });

    ui_data.find(".copy_last_line").click(function () {
      try {
        var last_row = UI['readLastTransitionTableRow'](ui_data, true);
        UI['writeLastTransitionTableRow'](ui_data, last_row);
        $(".transition_table").change();
      } catch (e) {
        alertNote(e.message);
      }
    });

    $(document).on("change", ".transition_table .tt_from", function () {
      try {
        var from_state = $(this).val();
        if (tm.isAFinalState(state(from_state)))
          UI['alertNote'](ui_notes, "Transition from final state "
            + "will never be executed.");
      } catch (e) {
        alertNote(e.message);
      }
    });

    // JS events
    app.tm().addEventListener('transitionFinished', function () {
      hideRunningControls();
    });
    app.tm().addEventListener('finalStateReached', function () {
      alertNote("Final state reached!");
    });

    // load TM state to GUI
    try {
      app.tm().syncToUI();
    } catch (e) {
      alertNote("Initialization failed: " + e.message);
    }
  };

  // @method GUI.addExampleProgram: add an example program. The program is
  //   defined by program_id and the program is represented in data
  var addExampleProgram = function (program_id, data) {
    require(program_id && data);

    try {
      var option = $("<option></option>")
        .attr("data-program-id", program_id)
        .text(data['title']);
      ui_meta.find(".example option[data-none]").remove();

      var added = false;
      ui_meta.find(".example option").each(function () {
        if ($(this).text() > data['title']) {
          $(this).after(option);
          added = true;
          return;
        }
      });
      if (!added)
        ui_meta.find(".example").append(option)
    } catch (e) {
      alertNote(e.message);
    }
  };

  // @method GUI.changeExampleProgram:
  //   update the list of testcase for this new program
  var changeExampleProgram = function (_, data) {
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
      alertNote(e.message);
    }
  };

  // @method GUI.showRunningControls: show additional (like 'interrupt')
  //   controls when tm is "running"
  var showRunningControls = function () {
    try {
      if (!app.tm().locked())
        ui_tm.find('.controls .interrupt').show();
    } catch (e) {
      alertNote(e.message);
    }
  };

  // @method GUI.showRunningControls: hide additional controls when tm has stopped
  var hideRunningControls = function () {
    try {
      if (app.tm().locked())
        ui_tm.find('.controls .interrupt').hide();
    } catch (e) {
      alertNote(e.message);
    }
  };

  // @method GUI.alertNote: write note to the UI as user notification
  var alertNote = function (note_text) {
    var ui_notes = $("#notes");

    note_text = "" + note_text;
    // TODO: remove if stable enough
    /*
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
    */

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

  // @method GUI.verifyUIsync: Verify that UI and TM are synchronized
  var verifyUIsync = function () {
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



  // @function readLastTransitionTableRow: read elements of last row
  var readLastTransitionTableRow = function (ui_data, last_with_content) {
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
  };



  return {
    initialize : initialize,
    alertNote : alertNote,
    addExampleProgram : addExampleProgram,
    changeExampleProgram : changeExampleProgram,
    showRunningControls : showRunningControls,
    hideRunningControls : hideRunningControls,
    verifyUIsync : verifyUIsync
  }
};

/*

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
      UI['alertNote'](ui_notes, "Failed to parse given input: " + e.message
        + ". Import aborted.");
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
    var vals = tm.getCurrentTapeSymbols();
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
};*/

// ------------------------- Application object ---------------------------

var Application = function (market, ui_tm, ui_meta, ui_data, ui_notes, ui_gear) {
  var self = {};

  var normalize_symbol_fn = normalizeSymbol;
  var normalize_state_fn = normalizeState;

  var ui = new GUI(self, ui_tm, ui_meta, ui_data, ui_notes, ui_gear);
  var gear = new GearVisualization(ui_gear, new Queue());
  var numbers = new NumberVisualization([0, 0, 0, 0, 0, 0, 0], ui_tm); // TODO: non-static 7
  var tm = defaultAnimatedTuringMachine(normalize_symbol_fn,
    normalize_state_fn, gear, numbers, ui_tm, ui_meta, ui_data);

  var loadMarketProgram = function (data) {
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
      tm.getTape().fromJSON(user_tape_to_userfriendly_tape(data['tape']))
      tm.getProgram().fromJSON(user_program_to_program(data['program']));
      tm.setState(state(data['state']));
      tm.setFinalStates(data['final_states'].map(function (s) { return state(s) }));

      tm.syncToUI();
      ui.verifyUIsync();
    } catch (e) {
      alertNote(e.message);
    }
  };

  self['market'] = function () { return market; };
  self['loadMarketProgram'] = loadMarketProgram;
  self['tm'] = function () { return tm; };
  self['gui'] = function () { return ui; };
  self['run'] = function () { ui.initialize(); };
  return self;
}


// ----------------------------- Main routine -----------------------------

var intro_program = {
  "title" : "Introduction",
  "description" : [
    "Hi! This project is all about *turingmachines*. What are turingmachines? They are a computational concept from *Theoretical Computer Science* (TCS) by Alan Turing (*\u20061912 †\u20061954). They illustrate one possible way to define computation and are as powerful as your computer. So how do they work?",
    "Above you can see the animated turing machine with several control elements underneath. The animation consists of a tape (with bright background color) and one cursor (winded green structure). The text at the left bottom of the animation is called *current state*. You can press \"continue\" to compute the next *step*. What are steps?",
    "At the bottom you can see a *transition table*. It defines a current situation, consisting of a read symbol and a state, and the next situation after one step has been performed. So when you press \"continue\" the program will read the focused symbol in the cursor and the current state. It will search for a line in the transition table matching those 2 values and will execute the corresponding result. The result consists of a symbol to write, a movement of the tape and a successor state.",
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

  var markets = {'local': 'markets/'};  // local is also contained
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

  var programs = ['2bit-xor', '4bit-addition', 'mirroring', 'zero-writer'];
  var count_default_programs = 4;
  if (program_matches) {
    var p = program_matches[1].split(';');
    for (var i = 0; i < p.length; i++) {
      if (p[i] && programs.indexOf(p[i]) === -1)
        programs.push(p[i]);
    }
  }
  console.info("Programs considered: ", programs);

  // market handling
  var manager = new TuringMarket(default_market, markets,
                  ui_notes, ui_tm, ui_meta, ui_data);

  setTimeout(function () {
    // always load this one immediately
    manager.add("intro", intro_program);
    manager.activateProgram("intro");

    for (var i = 0; i < programs.length; i++)
      manager.load(programs[i]);

    if (programs[count_default_programs])
      // if user-defined program are provided, load first one per default
      manager.activateWhenReady(programs[count_default_programs]);
  }, 100);
  // REMARK I just hope it takes 100ms to make the application instance available

  var application = new Application(manager, ui_tm, ui_meta, ui_data, ui_notes, ui_gear);

  manager.addEventListener("programReady", function (_, data) {
    return application.gui().addExampleProgram.apply(null, arguments);
  });
  manager.addEventListener("programActivated", function (_, data) {
    application.gui().changeExampleProgram.apply(null, arguments);
    application.loadMarketProgram(data);

  });

    /*
      TODO

      manager.addEventListener('marketActivated', function (market_id) {
        console.info("Market " + market_id + " activated. " +
                     "I initialized the machine :)");

        ui_meta.find(".machine_name").val(tm.getMachineName());
        ui_data.find(".final_states").val(tm.getFinalStates()
          .map(function (v) { return v.toString(); }).join(", "));

        var values = tm.getCurrentTapeSymbols().slice();
        var mid = parseInt(values.length / 2);
        UI['setTapeContent'](ui_data, values, mid);

        UI['writeTransitionTable'](ui_data, tm.getProgram().toJSON());
      });


      var updateMarketsAtUI /= function (intro, deprecate) {
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
    */


  application.run();
  return application;
}
