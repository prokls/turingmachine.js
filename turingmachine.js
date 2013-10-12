//
// turingmachine.js
//
// A turing machine web application for educational purposes.
// The main routine is at the end of the document.
//
// Dependencies:
//   - jQuery (tested with 1.10.2)
//
// Remarks:
//   - TODO, IMPROVE and FEATURE flags are used in the source code.
//   - method name `input` = should be 'import', but import is reserved identifier
//
// Contributions:
// - FelixH0er (design discussion)
//   Thanks!
//
// Release 0.5.0-tutors
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
states = [];

// global variable containing all written letters
alphabet = [];

// global variable storing the latest testcase error message
var last_testcase_error = '';

// global variable storing whether or not current program is example program
var is_example_program = true;

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

// Normalizes values written to the tape
var normalizeSymbol = function (symb) {
  symb = symb.toString();
  if (symb.match(/^\s*$/))
    return symb = ' ';
  symb = symb.trim();
  if (symb.length > 1)
    alertNote("Any symbol should not have more than 1 character. "
      + "Not satisfied for '" + symb + "'.");
  return symb;
};

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
  };
  alert("Internal Error! Assertion failed:\n" + msg);
}

// --------------------------------- State --------------------------------

// @object State: State of the Turing machine.
function State(name)
{
  // @member State.name

  if (isState(name))
    name = name.name;
  if ($.inArray(name, states) === -1)
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

  // @method Program.clear: Clear program table
  var clear = function () {
    program = {};
  }

  // @method Program.update: Add/update entry to program
  var update = function (read_symbol, from_state, write, move, to_state) {
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
  var isDefined = function (read_symbol, from_state) {
    return get(read_symbol, from_state) !== undefined;
  };

  // @method Program.get: Return InstrTuple for specified situation or undefined
  var get = function (read_symbol, from_state) {
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
  var input = function (data) {
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
  var toString = function () {
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
  var toJSON = function () {
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

  // @method Program.toTWiki: TWiki representation of the Program
  var toTWiki = function () {
    var representSymbol = function (symb) {
      // TODO: representation of space as x
      /*if (symb === ' ')
        return 'x';
      else*/
        return symb.toString();
    };

    var representState = function (state) {
      return state.toString();
    };

    if (Object.getOwnPropertyNames(program).length === 0)
      return "";

    // evaluate alphabet & states
    var alphabet = []
    var states = [];
    for (var key1 in program)
    {
      if ($.inArray(key1, alphabet) === -1)
        alphabet.push(key1);
      for (var key2 in program[key1])
      {
        if ($.inArray(key2, states) === -1)
          states.push(key2);

        var symbol = program[key1][key2].write;
        if ($.inArray(symbol, alphabet) === -1)
          alphabet.push(symbol);

        var state = program[key1][key2].state.toString();
        if ($.inArray(state, states) === -1)
          states.push(state);
      }
    }

    // create table
    var table = new Array(states.length + 1);
    for (var i = 0; i < states.length + 1; i++)
      table[i] = new Array(alphabet.length + 1);

    // set header
    for (var i = 0; i < alphabet.length; i++)
      table[0][i + 1] = alphabet[i];
    // set row description
    for (var i = 0; i < states.length; i++)
      table[i + 1][0] = states[i];

    // set actual cell contents
    for (var x = 1; x < alphabet.length + 1; x++)
      for (var y = 1; y < states.length + 1; y++)
      {
        var read_symbol = table[0][x];
        var from_state = new State(table[y][0]);

        var instr = get(read_symbol, from_state);
        if (instr !== undefined) {
          table[y][x] = '_' + representSymbol(instr.write)
            + '_ - ' + instr.move.toString()[0] + ' - ' + representState(instr.state);
        }
      }

    // evaluate max length
    var state_max_length = 0;
    for (var i in states)
      if (typeof states[i] === 'string')
        state_max_length = (state_max_length > states[i].length)
          ? state_max_length : states[i].length;
    state_max_length += 2;
    var triple_max_length = 12;

    var enlarge = function (text, size) {
      size = def(size, triple_max_length);
      if (text === undefined)
        return " ".repeat(size);
      var chars = size - text.toString().length;
      if (chars < 0)
        chars = 0;
      return text.toString() + " ".repeat(chars);
    };
    var b = function (text) {
      return "*" + text.toString() + "*";
    };

    // Normalize headers
    for (var i = 0; i < alphabet.length; i++)
      table[0][i + 1] = enlarge(b(representSymbol(table[0][i + 1])));
    // set row description
    for (var i = 0; i < states.length; i++)
      table[i + 1][0] = enlarge(b(representState(states[i])), state_max_length);
    table[0][0] = enlarge(table[0][0], state_max_length);

    table_string = '';
    for (var row = 0; row < states.length + 1; row++)
    {
      table_string += '|  ';
      for (var col = 0; col < table[row].length; col++)
        if (col !== 0)
          table[row][col] = enlarge(table[row][col]);
      table_string += table[row].join("  |  ");
      table_string += ' |\n';
    }

    return table_string;
  };

  // @method Program.fromTWiki: Import TWiki representation
  var fromTWiki = function (text) {
    var normalizeTWiki = function (str) {
      // removing italic, bold and whitespace
      str = str.trim();
      while (str.length > 0 && str[0] === '_' && str[str.length - 1] === '_')
        str = str.slice(1, -1);
      while (str.length > 0 && str[0] === '*' && str[str.length - 1] === '*')
        str = str.slice(1, -1);
      return str;
    };
    var splitTuple = function (str) {
      var tuple = str.split("-");
      return [normalizeTWiki(tuple[0]), normalizeTWiki(tuple[1]),
              normalizeTWiki(tuple[2])];
    };
    var instrs = [];

    var lines = text.trim().split("\n");
    for (var lineno in lines) {
      var cells = lines[lineno].split('|');
      var instr = [];
      for (var cell_id in cells) {
        cell_id = parseInt(cell_id);
        if (cell_id === 0 || cell_id === cells.length - 1)
          continue;
        if (lineno > 0 && cell_id > 1 && cells[cell_id].indexOf("-") !== -1)
          instr.push(splitTuple(cells[cell_id]));
        else {
          // TODO: representation of space as "x"
          /*if (cells[cell_id].trim().length === 0)
            cells[cell_id] = '_x_ (leer)';*/
          instr.push(normalizeTWiki(cells[cell_id]));
        }
      }
      instrs.push(instr);
    }

    // Reset program
    program = {};

    // instrs contains all values
    for (var instr_id in instrs) {
      instr_id = parseInt(instr_id);
      if (instr_id === 0)
        continue;
      for (cell_id in instrs[instr_id]) {
        cell_id = parseInt(cell_id);
        if (cell_id === 0)
          continue;  // empty
        if (instrs[instr_id][cell_id].length === 0)
          continue;  // no instruction given

        var read_symbol = instrs[0][cell_id];
        var from_state = new State(instrs[instr_id][0]);

        var write_symbol = instrs[instr_id][cell_id][0];
        var movement = new Movement(instrs[instr_id][cell_id][1]);
        var to_state = new State(instrs[instr_id][cell_id][2]);

        if (program[read_symbol] === undefined)
          program[read_symbol] = {};
        update(read_symbol, from_state, write_symbol, movement, to_state);
      }
    }
  };

  // @method Program.query: extract information from Program for debugging 
  // A query function to extract information from Program when debugging
  // Provide {read|from_state|write|move|to_state: value} and I will return
  // all program entries where *all* (conjunction) these values are set.
  var query = function (options) {
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
    clear : clear,
    update : update,
    isDefined : isDefined,
    get : get,
    input : input,
    toString : toString,
    toJSON : toJSON,
    toTWiki : toTWiki,
    fromTWiki : fromTWiki,
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
    alphabet.push(value);

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
  };

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
  if (history_size !== Infinity)
    console.warn("History size is currently not implemented (i.e. ignored).");

  // @member RecordedTape.stack
  // Array of arrays. One array per snapshot. Store all actions.
  var stack = [[]];

  // @member RecordedTape.history
  // Array of arrays. One array per snapshot. Stores undone actions.
  var history = [[]];

  // @member RecordedTape.simple_tape
  var simple_tape = new Tape(default_value);

  // General overview for instruction set:
  //    "LEFT", [$positions]
  //    "RIGHT", [$positions]
  //    "WRITE", $old_value, $new_value
  //    "SNAPSHOT"

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
    else if (instr[0] === "SNAPSHOT")
      throw new AssertionException(
        "SNAPSHOT instruction occured. Must not be in history."
      );
    else
      throw new AssertionException("Unknown VM instruction");
  };

  // @method RecordedTape._applyInstruction: Run an instruction
  //         This method runs the instructions triggered by the user
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
    else if (instr[0] === "SNAPSHOT")
      snapshot();
    else
      throw new AssertionException("Unknown instruction");
  };

  // @method RecordedTape.getStack: Return the stored action
  var getStack = function () {
    return stack;
  }

  // @method RecordedTape.getHistory: Return array of undone actions
  var getHistory = function () {
    return history;
  }

  // @method RecordedTape.clearHistory: Clear the history of this tape
  var clearHistory = function () {
    history = [[]];
    stack = [[]];
  };

  // @method RecordedTape.left: Go left.
  var left = function (positions) {
    positions = def(positions, 1);
    stack[stack.length - 1].push(["LEFT", positions]);
    for (var i = 0; i < positions; i++)
      simple_tape.left();
  };

  // @method RecordedTape.right: Go right.
  var right = function (positions) {
    positions = def(positions, 1);
    stack[stack.length - 1].push(["RIGHT", positions]);
    for (var i = 0; i < positions; i++)
      simple_tape.right();
  };

  // @method RecordedTape.write: Write a value to tape.
  var write = function (new_value, old_value) {
    old_value = def(old_value, simple_tape.read());
    stack[stack.length - 1].push(["WRITE", old_value, new_value]);
    simple_tape.write(new_value);
  };

  var _undo_stack = function (stack) {
    for (var i = stack.length - 1; i >= 0; i--) {
      var instr = stack[i];
      var undo = _oppositeInstruction(instr);
      _applyNativeInstruction(undo);
    }
  };

  // @method RecordedTape.undo: Go back to last snapshot. Returns success.
  var undo = function () {
    if (stack[stack.length - 1].length === 0) {
      stack.pop();
      _undo_stack(stack[stack.length - 1]);
      history.push(stack.pop());
      stack.push([]);
    }

    else if (stack.length === 1 && stack[0].length === 0) {
      throw OutOfHistoryException();
    }

    else {
      _undo_stack(stack.pop());
      stack.push([]);
    }
  };

  // @method RecordedTape.redo: Go forward one snapshot. Returns success.
  var redo = function () {
    if (stack[stack.length - 1].length > 0)
      undo();

    if (history.length > 0) {
      if (stack[stack.length - 1].length === 0)
        stack.pop();

      var to_redo = history.pop();
      for (var i = 0; i < to_redo.length; i++)
        _applyInstruction(to_redo[i]);
      stack.push(to_redo);
      stack.push([]);
    }

    else {
      throw OutOfHistoryException();
    }
  };

  // @method RecordedTape.snapshot: Take a snapshot.
  var snapshot = function () {
    if (history.length !== 0)
      while (history.length !== 0)
        history.pop();

    if (stack[stack.length - 1].length !== 0)
      stack.push([]);
  };

  // @method RecordedTape.toJSON: Return JSON representation of RecordedTape
  var toJSON = function (export_history) {
    export_history = def(export_history, true);
    if (!export_history)
      return simple_tape.toJSON();

    var data = simple_tape.toJSON();
    data['history_undone'] = history;
    data['history_stack'] = stack;

    return data;
  }

  // @method RecordedTape.input: Import RecordedTape data
  var input = function (data) {
    clearHistory();
    if (data['history_stack'] !== undefined)
      stack = data['history_stack'];
    if (data['history_undone'] !== undefined)
      history = data['history_undone'];
    if (data['history_size'] !== undefined)
      if (data['history_size'] === null)
        history_size = Infinity;
      else
        history_size = parseInt(data['history_size']);

    return simple_tape.input(data);
  }

  return inherit(simple_tape, {
    left : left,
    right : right,
    write : write,
    undo : undo,
    redo : redo,
    snapshot : snapshot,
    getStack : getStack,
    getHistory : getHistory,
    clearHistory : clearHistory,
    toJSON : toJSON,
    input : input,

    /* TODO: only for debugging */
    history : history,
    stack : stack,
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
  // @member ExtendedTape.halted: If true, tape cannot be written.
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
    if (pos === undefined)
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
  var left = function () {
    var old_value = rec_tape.read();
    rec_tape.left();
    return old_value;
  };

  // @method ExtendedTape.right: Go one right, return value of old position
  var right = function () {
    var old_value = rec_tape.read();
    rec_tape.right();
    return old_value;
  };

  // @method ExtendedTape.move: Move in some specified direction
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
      require(false, "Unknown movement '" + move + "'");
  };

  // @method ExtendedTape.leftShift: Move several steps left
  var leftShift = function (count) {
    for (var i = 0; i < Math.abs(count); i++)
      count < 0 ? rec_tape.right() : rec_tape.left();
  };

  // @method ExtendedTape.rightShift: Move several steps right
  var rightShift = function (count) {
    for (var i = 0; i < Math.abs(count); i++)
      count < 0 ? rec_tape.left() : rec_tape.right();
  };

  // @method ExtendedTape.strip: Give me an array and I will trim default values
  //                             only left and right
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
      if (value === undefined || value === null)
        value = ' ';

      // Make cursor visible
      if (rec_tape.position().equals(base))
        values.push("cursor(" + value + ")");
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
  //         alphabet = set of used characters in tape
  var getAlphabet = function () {
    var _values = rec_tape.toJSON()['data'];
    var values = [];

    // remove duplicate entries
    $.each(values, function(pos, element) {
      if ($.inArray(element, values) === -1)
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
  var toJSON = function () {
    var out = rec_tape.toJSON();
    out['halted'] = halted;
    return out;
  };

  // @method ExtendedTape.input: import data from given array
  var input = function (data) {
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
    undo : rec_tape.undo,
    redo : rec_tape.redo,
    snapshot : rec_tape.snapshot,
    move : move,
    leftShift : leftShift,
    rightShift : rightShift,
    toString : toString,
    getAlphabet : getAlphabet,
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
    ext_tape.clear();
    ext_tape.moveTo(new Position(0));
    for (var i = 0; i < string.length; i++) {
      ext_tape.write(string[i]);
      if (i !== string.length - 1)
        ext_tape.right();
    }
    ext_tape.moveTo(new Position(0));
  };

  // @method UserFriendlyTape.setByArray
  var setByArray = function (array) {
    return setByString(array);
  };

  // @method UserFriendlyTape.toBitString
  var toBitString = function () {
    var data = ext_tape.toJSON()['data'];
    var bitstring = "";
    for (var i in data) {
      var value = normalizeSymbol(data[i]);
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

  return inherit(ext_tape, {
    setByString : setByString,
    setByArray : setByArray,
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
  require(program !== undefined);
  // @member Machine.tape
  require(tape !== undefined);

  // @member Machine.final_states
  for (var key in final_states)
    requireState(final_states[key]);

  // @member Machine.current_state
  requireState(initial_state);
  var current_state = initial_state;

  // @member Machine.default_check_inf_loop, const immutable
  var default_check_inf_loop = 500;

  // @member Machine.inf_loop_check
  inf_loop_check = def(inf_loop_check, default_check_inf_loop);

  // @member Machine.final_state_reached
  var final_state_reached = false;
  // @member Machine.no_command_defined
  var no_command_defined = false;

  // @member Machine.step_id
  var step_id = 0;

  // @method Machine.cursor: Return the current cursor Position
  var cursor = function () {
    return tape.position();
  }

  // @method Machine.finalStateReached: Has a final state been reached?
  var finalStateReached = function () {
    return final_states.indexOf(current_state) >= 0 || final_state_reached;
  };

  // @method Machine.isUnknownCommand: Did a failed lookup in program occur?
  var isUnknownCommand = function () {
    return no_command_defined;
  };

  // @method Machine.getState: Get current state
  var getState = function () {
    return current_state;
  };

  // @method Machine.getStep: Get number of operations performed so far
  var getStep = function () {
    return step_id;
  };

  // @method Machine.addFinalState
  var addFinalState = function (state) {
    requireState(state);
    final_states.push(state);
  };

  // @method Machine.setFinalStates
  var setFinalStates = function (states) {
    for (var k in states)
      require(isState(states[k]), "Cannot add invalid state as final state");
    final_states = states;
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
    tape.snapshot();

    final_state_reached = false;
    no_command_defined = false;

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

  // @method Machine.next: Redo last (or `steps`) operation(s)
  var next = function (steps) {
    if (finalStateReached() || isUnknownCommand())
      return false;

    steps = def(steps, 1);
    tape.snapshot();

    // Try to redo :: Do not do this. Always take the current program to
    // evaluate the next state.
    /*var step = 0;
    try {
      for (; step < steps; step++)
        tape.redo();
    } catch (e) {
      if (e.name !== "Out of History Exception")
        throw e;
      else
        steps -= step;
    }*/

    // run `steps` operations
    var done = [];
    for (var i = 0; i < steps; i++)
    {
      var read_symbol = tape.read();
      var instr = program.get(read_symbol, current_state);

      // do it
      if (instr !== undefined)
      {
        tape.write(instr.write);
        tape.move(instr.move);
        current_state = instr.state;

        done.push([read_symbol, current_state, instr.write,
                   instr.move, instr.state]);

        for (var fs_id in final_states) {
          if (final_states[fs_id].equals(current_state)) {
            final_state_reached = true;
            return false;
          }
        }
      } else {
        no_command_defined = true;
        return false;
      }
    }

    step_id += 1;
    return done;
  };

  // @method Machine.run: Run operations until a final state is reached
  var run = function () {
    var base = 0;

    while (true) {
      for (var iter = 0; iter < inf_loop_check; iter++) {
        next(1);
        if (finalStateReached())
          return true;
        if (isUnknownCommand())
          return false;
      }
      base += inf_loop_check;

      var ret = confirm("I have run " + base +
        " iterations without reaching a final state. " +
        "Do you still want to continue?");
      if (!ret)
        return undefined;
    }
  };

  // @method Machine.runTestcase
  // give me a testcase spec and I will return whether or not the
  // current machine fails (false) or succeeds (true) the testcase
  var runTestcase = function (testcase) {
    // save current state
    var saved_state = toJSON();

    tape.clear();
    current_state = new State(testcase['input']['current_state']);
    final_states = testcase['input']['final_states'];
    no_command_defined = false;
    final_state_reached = false;

    // load tape content
    tape.setByArray(testcase['input']['tape']['data']);
    if (testcase['input']['tape']['cursor'] !== undefined)
      tape.moveTo(new Position(testcase['input']['tape']['cursor']));

    fs = [];
    for (var i in def(testcase['final_states'], []))
      fs.push(new State(testcase['final_states'][i]));
    final_states = fs;

    // Actually run it.
    run();

    // compare
    var cmp_tape = new UserFriendlyTape(Infinity, ' ');
    cmp_tape.setByArray(testcase['output']['tape']['data']);
    cmp_tape.moveTo(new Position(testcase['output']['tape']['cursor']));

    if (isUnknownCommand())
    {
      var read_symbol = tape.read();
      var instr = program.get(read_symbol, current_state);

      last_testcase_error = "No command found for symbol '"
          + read_symbol + "' in state '" + current_state + "'.";
      return false;
    }

    if (testcase['test_state'])
      if (machine.current_state.equals(testcase['output']['current_state']))
      {
        last_testcase_error = "End state should be '" +
            testcase['output']['current_state'].toString() +
            "'. Is '" + machine.current_state.toString() + "'.";
        return false;
      }
    if (testcase['test_cursor_position'])
      if (!tape.position().equals(cmp_tape.position()))
      {
        last_testcase_error = "End position of cursor should be " +
            cmp_tape.position().toString() + ". Is " +
            cmp_tape.position().toString() + ".";
        return false;
      }
    if (!tape.equals(cmp_tape))
    {
      last_testcase_error = "Final tape does look different.";
      return false;
    }

    // restore old state
    input(saved_state);
    return true;
  };

  // @method Machine.input: Import a Machine
  var input = function (data) {
    if (typeof data['current_state'] === 'undefined' ||
        typeof data['tape'] === 'undefined' ||
        typeof data['program'] === 'undefined')
      throw AssertionException("data parameter is incomplete");

    tape.input(data['tape']);
    program.input(data['program']);

    step_id = def(data['step'], 0);
    current_state = new State(data['current_state']);
    requireState(current_state);
    inf_loop_check = def(data['inf_loop_check'], default_check_inf_loop);
    no_command_defined = def(data['no_command_defined'], false);
    final_state_reached = def(data['final_state_reached'], false);

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

    var out = {
      'step' : step_id,
      'current_state' : current_state.toJSON(),
      'program' : program.toJSON(),
      'tape' : tape.toJSON(),
      'inf_loop_check' : inf_loop_check,
      'final_states' : fs,
      'no_command_defined' : no_command_defined,
      'final_state_reached' : final_state_reached
    };

    return out;
  };

  return {
    cursor : cursor,
    finalStateReached : finalStateReached,
    isUnknownCommand : isUnknownCommand,
    getState : getState,
    getStep : getStep,
    addFinalState : addFinalState,
    setFinalStates : setFinalStates,
    runTestcase : runTestcase,
    read : read,
    prev : prev,
    next : next,
    run : run,
    input : input,
    toJSON : toJSON,

    program : program,
    tape : tape
  };
};

// ---------------------------- DrawingMachine ----------------------------

function getPixelRatio() {
  // http://stackoverflow.com/a/15666143/1624929
  var ctx = document.getElementById("tm_canvas_fg").getContext("2d"),
      dpr = window.devicePixelRatio || 1,
      bsr = ctx.webkitBackingStorePixelRatio ||
            ctx.mozBackingStorePixelRatio ||
            ctx.msBackingStorePixelRatio ||
            ctx.oBackingStorePixelRatio ||
            ctx.backingStorePixelRatio || 1;

  return dpr / bsr;
}

function DrawingMachine(program, tape, final_states,
  initial_state, inf_loop_check)
{
  var machine = Machine(program, tape, final_states,
    initial_state, inf_loop_check);

  // should be referenced through machine.tape and machine.program
  program = undefined;
  delete program;
  tape = undefined;
  delete tape;

  // initialize canvas
  var canvas_fg = document.getElementById("tm_canvas_fg");
  var ctx_fg = canvas_fg.getContext("2d");
  var canvas_bg = document.getElementById("tm_canvas_bg");
  var ctx_bg = canvas_bg.getContext("2d");
  var width = 400;
  var height = 150;

  var ratio = getPixelRatio();
  ctx_fg.width = width * ratio;
  ctx_fg.height = height * ratio;
  ctx_bg.width = width * ratio;
  ctx_bg.height = height * ratio;
  canvas_fg.style.width = width + "px";
  canvas_fg.style.height = height + "px";
  canvas_bg.style.width = width + "px";
  canvas_bg.style.height = height + "px";
  ctx_fg.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx_bg.setTransform(ratio, 0, 0, ratio, 0, 0);

  // Return an object which can be forwarded to a drawing routing
  var getCurrentDrawingState = function () {
    var values = machine.read();
    return {
      cursor: Math.floor(values.length / 2),
      values: values,
      movement: undefined,
      prev_state: machine.getState().toString(),
      next_state: undefined
    };
  }

  var writeStateText = function (state) {
    var posx = 130;
    var posy = 105;
    var width = 150;
    var height = 25;

    if (state.length <= 13) {
      ctx_fg.font = "28px Sans bold";
    } else if (state.length <= 20) {
      ctx_fg.font = "20px Sans bold";
    } else {
      ctx_fg.font = "15px Sans bold";
    }

    ctx_fg.fillStyle = "#CDE";
    ctx_fg.textBaseline = 'middle';
    var x = posx + width / 2 - ctx_fg.measureText(state).width / 2;
    var y = posy + height / 2 + 3;
    ctx_fg.fillText(state, x, y);
  };

  var markCursor = function (x_coords, cursor) {
    if (cursor === undefined || cursor === -1)
      return;
    ctx_fg.fillStyle = "rgba(150, 200, 150, 0.3)";
    if (cursor === Math.floor(x_coords.length / 2)) {
      ctx_fg.fillRect(175, 26, 48, 40);
    } else {
      ctx_fg.fillRect(x_coords[cursor] - 3, 32, 20, 28);
    }
  };

  var drawValues = function (x_coords, values) {
    var font_size = function (x) {
      if (x < 130 || x > 250)
        return 25;
      if (x >= 177 && x <= 197)
        return 45;

      if (x > 197) {
        var p = (x - 197) / (250 - 197);
        return parseInt(45 - (p * (45 - 25)));

      } else if (x < 177) {
        var p = (x - 130) / (250 - 197);
        return parseInt(25 + (p * (45 - 25)));
      }
    };
    ctx_fg.font = "25px Serif";
    ctx_fg.fillStyle = "black";
    ctx_fg.textBaseline = 'middle';
    for (var i = 0; i < values.length; i++)
    {
      if (values[i] === undefined)
        continue;
      var fs = font_size(x_coords[i]);
      var spacing = ((fs - 25) / (45 - 25)) * 3;
      ctx_fg.font = fs + "px Serif";
      ctx_fg.fillText(values[i], x_coords[i], 47 + spacing);
    }
  };

  var clear = function () {
    // empty fg canvas
    ctx_fg.clearRect(0, 0, width, height);

    // empty canvas
    ctx_bg.fillStyle = "#AEB29F";
    ctx_bg.fillRect(0, 0, width, height);

    // load background image
    var imageObj = new Image();
    imageObj.src = "static/machine.png";
    imageObj.onload = function() {
      var x = (width / 2) - (this.width / 2);
      var y = (height / 2) - (this.height / 2);
      ctx_bg.drawImage(this, x, y);
    };

    // draw tape
    ctx_bg.fillStyle = "#CCC";
    ctx_bg.fillRect(0, 23, width, 23 + 20);
  };

  var clearTape = function () {
    // clear tape
    ctx_fg.clearRect(0, 0, 400, 100);
  };

  var drawState = function (values, cursor, prev_state) {
    clear();
    var values_x = [10, 35, 60, 85, 110, 187, 280, 305, 330, 355, 380];

    drawValues(values_x, values);
    markCursor(values_x, cursor);

    /* // snippet
    var box_width = 40;
    var line_width = 5;
    for (var x = 5; x < 400; x += 50)
    {
      ctx.beginPath();
      ctx.rect(x, 23, box_width, box_width);
      ctx.lineWidth = line_width;
      ctx.strokeStyle = 'black';
      ctx.stroke();
    }*/

    // write state
    writeStateText(prev_state.substr(0, 8));
  };

  var drawStep = function (step, values, cursor, movement) {
    var values_x = [10, 35, 60, 85, 110, 187, 280, 305, 330, 355, 380];
    movement = movement.toUpperCase();

    clearTape();

    if (movement === 'R')
      movement = 'R';
    else if (movement === 'L')
      movement = 'L';
    else
      console.warn('Cannot draw movement ' + movement);

    var interval_move = function (old_pos, interval) {
      if (movement === 'R')
        return old_pos + (step * interval);
      else
        return old_pos - (step * interval);
    };

    var new_values_x = [];
    if (movement === 'R')
      for (var i in values_x) {
        i = parseInt(i);
        if (values_x[i + 1] === undefined) {
          new_values_x.push(undefined);
        } else {
          var diff = (values_x[i + 1] - values_x[i]);
          var new_pos = parseInt(interval_move(values_x[i], diff));
          new_values_x.push(new_pos);
        }
      }
    else if (movement === 'L')
      for (var i in values_x) {
        i = parseInt(i);
        if (values_x[i + 1] === undefined) {
          new_values_x.push(new_pos);
        } else {
          var diff = values_x[i] - values_x[i - 1];
          var new_pos = parseInt(interval_move(values_x[i], diff));
          new_values_x.push(new_pos);
        }
      }

    drawValues(new_values_x, values);
  };


  var drawMovement = function (speed, values, cursor, movement, prev_state, next_state) {
    require(!isNaN(speed));
    require(values !== undefined);
    require(isPosition(cursor));
    require($.inArray(movement, ["R", "L", "S", "H"]) >= 0);

    clear();

    // do not draw, if stop is executed.
    if (movement.toUpperCase() === 'S')
      return;

    // frame 1
    markCursor(cursor);
    writeStateText(prev_state.substr(0, 8) + " → " + next_state.substr(0, 8));

    for (var i = 1; i <= 10; i++) {
      setTimeout(drawStep, i * (speed / 10), 0.1 * i, values, cursor, movement);
    }
  };


  // @method DrawingMachine.draw: draw the current state of the machine
  var draw = function (data) {
    if (data === undefined)
      data = getCurrentDrawingState();

    require(data['cursor'] !== undefined);
    require(data['values'] !== undefined);
    require(data['prev_state'] !== undefined);

    var dataset = '';
    if (data['movement'] === undefined || data['next_state'] === undefined)
      dataset = 'state';
    else
      dataset = 'movement';

    var values = def(data['values'], machine.read());
    var cursor = def(data['cursor'], 5);
    var prev_state = def(data['prev_state'], machine.getState().toString());

    if (dataset === 'movement') {
      require(data['movement'] !== undefined);
      require(data['next_state'] !== undefined);

      var movement = data['movement'];
      var next_state = data['next_state'];
    }

    // now, draw
    if (dataset === 'movement')
      drawMovement(1000, values, cursor, movement, prev_state, next_state);
    else
      drawState(values, cursor, prev_state);
  };

  // @method DrawingMachine.prev: go one step back
  var prev = function (steps, speed) {
    var op = machine.prev(steps);
    draw(getCurrentDrawingState());
    return op;
  };

  // @method DrawingMachine.next: go one step forward with the turingmachine
  var next = function (steps, speed) {
    // I expect the following data:
    // {
    //   'cursor' : old index in values or -1 for (not visible),
    //   'values' : [ten values of the tape],
    //   'movement' : one-letter description,
    //   'prev_state' : previous state,
    //   'next_state' : next state
    // }
    //(step, values, cursor, movement)
    var op = machine.next(steps);
    draw(getCurrentDrawingState());
    return op;
  };

  var run = function (speed) {
    var result = machine.run();
    draw(getCurrentDrawingState());
    return result;
  };

  var input = function (data) {
    machine.input(data);
    draw(getCurrentDrawingState());
  };

  return inherit(machine, {
    prev : prev,
    next : next,
    run : run,
    draw : draw,
    input : input
  });
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
  // @member Application.description
  var description = "";

  var program = new Program();
  var tape = new UserFriendlyTape(Infinity, ' ');
  // @member Application.machine
  var machine = new DrawingMachine(program, tape, [EndState], StartState);

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
        $("#notes").fadeOut(1200);
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
    require(testcase['name'] !== undefined,
      'Testcase name is not given.'
    );
    require(testcase['final_states'] !== undefined,
      'Testcase final states are not given.'
    );
    require(testcase['input'] !== undefined,
      'Testcase input data are not given.'
    );
    require(testcase['input']['tape'] !== undefined,
      'Testcase input tape is not given.'
    );
    require(testcase['input']['current_state'] !== undefined,
      'Testcase input state is not given'
    );
    require(testcase['output'] !== undefined,
      'Testcase output data are not given'
    );
    require(testcase['output']['tape'] !== undefined,
      'Testcase output tape is not given'
    );
    require(testcase['output']['current_state'] !== undefined,
      'Testcase output state is not given'
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
        if (instr === undefined)
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
    machine.prev(steps);
  };

  // @method Application.event$forward: Go forward event
  var event$forward = function (steps) {
    steps = def(steps, parseInt($("#tm_steps_next").val()));
    var result = machine.next(steps);
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
  };

  // @method Application.event$loadExampleProgram: Load program event
  var event$loadExampleProgram = function () {
    var program_name = $("#tm_example").val();
    switch (program_name) {
      case "2-Bit XOR":
        input(twobit_xor());
        write();
        is_example_program = true;
        break;
      case "4-Bit Addition":
        input(fourbit_addition());
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

    if (testcase === undefined)
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
      var result = true; //machine.runTestcase(testcase);
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
        machine.program.fromTWiki(data);
        write();
        break;
      case 'json':
        machine.program.input(data);
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

  // @method Application.input: Import Application from JSON
  var input = function (data) {
    if (data['machine'] === undefined)
      throw new AssertionException("data parameter incomplete (requires machine).");

    if (data['name'] !== undefined)
      name = data['name'];
    if (data['version'] !== undefined)
      version = data['version'];
    if (data['author'] !== undefined)
      author = data['author'];
    if (data['description'] !== undefined)
      description = data['description'];
    else
      description = "";

    machine.input(data['machine']);

    if (data['speed'] !== undefined && !isNaN(parseInt(data['speed'])))
      speed = parseInt(data['speed']);
    if (data['prev_steps'] !== undefined && !isNaN(parseInt(data['prev_steps'])))
      prev_steps = data['prev_steps'];
    if (data['next_steps'] !== undefined && !isNaN(parseInt(data['next_steps'])))
      next_steps = data['next_steps'];
    if (data['testcases'] !== undefined)
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
    input : input,
    toString : toString,
    toJSON : toJSON
  };
};

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

      // should at least not trigger any errors
      var p = new Program();
      p.update("0", new State("Start"), "1", new Movement("R"), new State("Z1"));
      p.update("0", new State("End"), "1", new Movement("L"), new State("Z1"));
      p.update("1", new State("Start"), "2", new Movement("R"), new State("Z1"));
      p.update("0", new State("Z2"), "3", new Movement("R"), new State("Z3"));
      //console.debug(p.toTWiki());
      p.fromTWiki(p.toTWiki());
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
      require($.inArray(5, t.toJSON().data) === -1);
    },

    testRecordedTapeTwoFrames : function () {
      var t = new RecordedTape(30, '0');
      t.left();
      t.left();
      t.snapshot();
      require(t.position().equals(new Position(-2)));
      t.right();
      require(t.position().equals(new Position(-1)));

      t.undo();
      require(t.position().equals(new Position(-2)));
      t.undo();
      require(t.position().equals(new Position(0)));
    },

    testRecordedTape20UndosAndRedos : function () {
      var t = new RecordedTape(30, '0');
      for (var i = 0; i < 20; i++) {
        t.left();
        t.snapshot();
      }
      require(t.position().equals(new Position(-20)));
      t.right();
      require(t.position().equals(new Position(-19)));
      t.undo();
      require(t.position().equals(new Position(-20)));
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

      t.undo(); // undo the left
      t.undo(); // undo 4 right-s
      t.redo(); // redo 4 right-s
      require(t.position().equals(new Position(2)));
      t.undo(); // undo 4 right-s
      require(t.position().equals(new Position(-2)));

      t.left();
      t.left();
      t.left();
      t.snapshot();
      require(t.position().equals(new Position(-5)));

      t.undo();
      require(t.position().equals(new Position(-2)));
    },

    testRecordedTapeImportExport : function () {
      var t = new RecordedTape(30, '0');
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
      t.redo();
      t.undo();

      t.left();
      t.left();
      t.left();

      var t2 = new RecordedTape(30, '0');
      t2.input(t.toJSON());

      require(t2.position().equals(new Position(-5)));
      t2.undo();
      require(t2.position().equals(new Position(-2)));
      require(t.position().equals(new Position(-5)));
    },

    testRecordedTapeRedoImportExport : function () {
      var t = new RecordedTape(30, '0');
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
      t.redo();
      t.undo();

      var t2 = new RecordedTape(30, '0');
      t2.input(t.toJSON());

      require(t2.position().equals(new Position(-2)));
      t2.redo();
      require(t2.position().equals(new Position(2)));
      require(t.position().equals(new Position(-2)));
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
    },

    testUFTapeSetByString : function () {
      var t = UserFriendlyTape(Infinity, true);
      var str = "0123987259876234";
      t.setByString(str);
      require(t.position().equals(new Position(0)));
      t.moveTo(new Position(0));
      for (var i = 0; i < str.length; i++) {
        require(t.read() === str[i]);
        t.right();
      }
    },

    testUFTapeSetByArray : function () {
      var t = UserFriendlyTape(Infinity, true);
      var array = [4, 9, "Hello", "World", Infinity, null];
      t.setByString(array);
      for (var i = 0; i < array.length; i++) {
        require(t.read() === array[i]);
        t.right();
      }
    },

    testUFTapeMathWalkWithImportExport : function () {
      var t = UserFriendlyTape(0, true);
      this.testSimpleTapeMathWalkWithImportExport(t);
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
    throw e;
  }
  console.info("Testsuite successfully passed");
}

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
          'E' : [' ', 'H', 'End'],
          'O' : [' ', 'H', 'End']
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
  app.input(twobit_xor());
  app.write();

  return app;
}
