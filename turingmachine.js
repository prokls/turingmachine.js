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
// (C) 2013, Public Domain, Lukas Prokop
//

app_name = "turingmachine.js";
app_version = "0.2.0-nodart";
app_author = "Lukas Prokop <admin@lukas-prokop.at>";

// -------------------------------- Helpers -------------------------------

// Default parameters abstraction
function def(arg, val) { return (typeof arg !== 'undefined') ? arg : val; }

// assert statement
function require(cond, msg)
{
  if (!cond)
    throw new AssertionException(msg);
}

// Movement values
// const, immutable
mov = {
  LEFT  : "Left",
  RIGHT : "Right",
  HALT  : "Halt",
  STOP  : "Stop"
};

// ------------------------------ Exceptions ------------------------------

// thrown if value out of tape bounds is accessed
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

// thrown if a HALT instruction is executed
function HaltException()
{
  throw {
    name : "Out of Tape Bounds Exception", 
    message : "Position " + position.getIndex() + " is outside of tape", 
    toString : function () { return this.name + ": " + this.message }
  };
}

// thrown, if an assertion goes wrong
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

// global variable containing all occuring states
registered_states = [];

// State object
function State(name)
{
  if (name instanceof State)
    name = name.name;

  this.name = name;
  registered_states.push(name);
}

State.prototype = {
  equals : function (other)
  {
    return this.name == other.name;
  },
  toString : function ()
  {
    return this.name;
  },
  toJSON : function()
  {
    return this.name.toString();
  }
}

// Test whether or not the given parameter `obj` is a State object
function is_state(obj)
{
  return obj instanceof State;
}

// Throw exception if `obj` is not a State object
function require_state(obj)
{
  if (!is_state(obj))
    require(false, "Is not a valid state: " + obj);
}

// two common states
// const, immutable
var EndState = new State("End");
var StartState = new State("Start");

// ------------------------------- Movement -------------------------------

// Movement object
function Movement(move)
{
  if (move instanceof Movement)
    move = move.move;
  if (move === 'L' || move === 'Left' || move === mov.LEFT)
    move = mov.LEFT;
  else if (move === 'R' || move === 'Right' || move === mov.RIGHT)
    move = mov.RIGHT;
  else if (move === 'H' || move === 'Halt' || move === mov.HALT)
    move = mov.HALT;
  else if (move === 'S' || move === 'Stop' || move === mov.STOP)
    move = mov.STOP;

  require_movement(move);
  this.move = move;
}

Movement.prototype = {
  equals : function (other) {
    if (other instanceof Movement)
      return this.move === other.move;
    else
      return this.move === other;
  },
  toString : function () {
    return this.move;
  },
  toJSON : function () {
    return mov[this.move];
  }
};

// Test whether or not the given parameter `obj` describes a movement
function is_movement(obj)
{
  if (obj === 'L' || obj === 'Left' || obj === mov.LEFT)
    return true;
  else if (obj === 'R' || obj === 'Right' || obj === mov.RIGHT)
    return true;
  else if (obj === 'H' || obj === 'Halt' || obj === mov.HALT)
    return true;
  else if (obj === 'S' || obj === 'Stop' || obj === mov.STOP)
    return true;

  if (obj instanceof Movement)
    return true;

  return false;
}

// Throw exception if `obj` is not a Movement object
function require_movement(obj)
{
  if (!(is_movement(obj)))
    require(false, "Is not a valid movement: " + obj);
}


// ------------------------------ InstrTuple ------------------------------

function InstrTuple(write, move, state)
{
  require_movement(move);
  require_state(state);

  this.write = write;
  this.move = move;
  this.state = state;
}

InstrTuple.prototype = {
  equals : function (other) {
    require(other instanceof InstrTuple, "InstrTuple object required for comparison");
    return this.write === other.write && this.move === other.move &&
        this.state === other.state;
  },
  toString : function () {
    return "{instruction: write " + this.write.toString() + ", move "
      + this.move.toString() + " and goto state "
      + this.state.toString() + "}";
  },
  toJSON : function () {
    return [this.write.toString(), this.move.toJSON(), this.state.toJSON()];
  }
}

// --------------------------------- Table --------------------------------

// TODO(meisterluk): register alphabet

function Table()
{
  // maps [read_symbol, from_state] to [write_symbol, movement, to_state]
  // but the value is stored as InstrTuple
  this.program = {};
}

Table.prototype = {
  update : function (read_symbol, from_state, write, move, to_state)
  {
    require_state(from_state);
    var value = [];

    if (write instanceof InstrTuple)
      // InstrTuple was provided instead of [write, move, to_state]
      value = write;
    else {
      require_movement(move);
      require_state(to_state);

      value = new InstrTuple(write, move, to_state);
    }

    var added = false;
    for (var key in this.program)
    {
      if (key[0] === read_symbol && key[1].equals(from_state))
      {
        this.program[key] = value;
        added = true;
        break;
      }
    }
    if (!added)
      this.program[[read_symbol, from_state]] = value;
  },
  isDefined : function (read_symbol, from_state)
  {
    require_state(from_state);

    for (var key in this.program)
    {
      if (key[0] === read_symbol && key[1].equals(from_state))
        return true;
    }

    return false;
  },
  // Return InstrTuple for [read_symbol, from_state] or undefined
  get : function (read_symbol, from_state)
  {
    require_state(from_state);

    for (var key in this.program)
    {
      if (key[0] === read_symbol && key[1].equals(from_state))
        return this.program[key];
    }

    return undefined;
  },
  toString : function ()
  {
    var program = {};
    for (var key in this.program)
      program[[key[0].toString(), key[1].toJSON()]]
          = this.program[key].toJSON();

    return program.toString();
  },
  import : function (program)
  {
    this.program = {};
    for (key in program)
    {
      var read_symbol = key[0];
      var from_state = new State(key[1]);
      var write_symbol = program[key][0];
      var movement = new Movement(program[key][1]);
      var to_state = new State(program[key][2]);

      this.program[[read_symbol, from_state]] = new InstrTuple(
        write_symbol, movement, to_state
      );
    }
  },
  toJSON : function ()
  {
    var program = {};
    for (key in this.program)
    {
      var read_symbol = key[0].toString();
      var from_state = key[1].toJSON();
      var write_symbol = program[key][0].toString();
      var movement = program[key][1].toJSON();
      var to_state = program[key][2].toJSON();

      program[[read_symbol, from_state]] = [write_symbol, movement, to_state];
    }
    return program;
  },
  // A query function to extract information from Table when debugging
  // Provide {read|from_state|write|move|to_state: value} and I will return
  // all program entries where *all* (conjunction) these values are set.
  query : function (options)
  {
    // iterate over program and copy all entries satisfying all options
    var program = {};
    for (var key in this.program)
    {
      var add = true;
      if (typeof options['read'] !== 'undefined')
        if (options['read'] !== key[0])
          add = false;
      if (typeof options['from_state'] !== 'undefined')
        if (options['from_state'] !== key[1])
          add = false;
      if (typeof options['write'] !== 'undefined')
        if (options['write'] !== this.program[key][0])
          add = false;
      if (typeof options['move'] !== 'undefined')
        if (options['move'] !== this.program[key][1])
          add = false;
      if (typeof options['to_state'] !== 'undefined')
        if (options['to_state'] !== this.program[key][2])
          add = false;

      if (add)
        program[key] = this.program[key];
    }
    return program;
  }
};

// ------------------------------- Position -------------------------------

function Position(index)
{
  require(!isNaN(parseInt(index)), "Invalid value for Position");
  this.index = parseInt(index);
}

Position.prototype = {
  equals : function (other)
  {
    if (other instanceof Position)
      return this.index === other.index;
    else
      return this.index === other;
  },
  isNegative : function ()
  {
    return this.index < 0;
  },
  add : function (summand)
  {
    return new Position(this.index + summand);
  },
  sub : function (subtrahend)
  {
    return new Position(this.index - subtrahend);
  },
  toString : function ()
  {
    return this.index.toString();
  },
  toJSON : function ()
  {
    return parseInt(this.index);
  }
}

function is_position(obj)
{
  return obj instanceof Position;
}

function require_position(obj)
{
  if (!is_position(obj))
    require(false, "Is not a position");
}

// --------------------------------- Tape ---------------------------------

// TODO(meisterluk): provide clone method

//
// Tape constructor.
//
// If `initial_length` == 0, get me an empty tape.
// If `initial_length` > 1,
//     create a tape with `initial_length` values
// Cursor is set to the position in the middle
// Set all newly created values to `default_value`.
//
function Tape(initial_length, default_value)
{
  // const, immutable
  this.default_default_value = 0;
  // const, immutable
  this.default_cursor = 0;

  // initial length of the tape
  var initial_length = def(initial_length, 1);
  // value to be written if new memory cell is created
  this.default_value = def(default_value, this.default_default_value);

  this.clear(initial_length);

  require(initial_length >= 0, "Initial Tape length must be " +
    "greater/equal zero");
  require(this.tape.length === initial_length,
    "Tape was initialized wrongfully!");
}

Tape.prototype = {
  length : function (pos)
  {
    return this.tape.length;
  },

  // return current position of tape
  position : function ()
  {
    return this.cursor;
  },

  _testInvariants : function ()
  {
    require(this.end() - this.begin() + 1 === this.length(),
      "begin, end and length do not correspond"
    );
    require(typeof this.offset === 'number');
    require(this.offset >= 0, "offset invariant invalidated");
    require_position(this.cursor, "cursor is not a position");
    require(typeof this.tape === 'object');
    require(typeof this.halted === 'boolean');
  },

  // throw an OutOfTapeException if given position is invalid
  _indexCheck : function (pos)
  {
    require_position(pos);
    var index = this._getIndex(pos);
    if (index < 0 || index >= this.length())
      throw new OutOfTapeException(index);
  },

  // returns the actual index in this.tape for the given position
  _getIndex : function (pos)
  {
    require(is_position(pos), "Can only handle Position instances");

    var pos = def(pos, this.cursor);
    require(pos.index + this.offset >= 0,
      "postcondition of _getIndex invalidate: " +
      "Index possibly OutOfTape"
    );
    return pos.index + this.offset;
  },

  clear : function (length)
  {
    this.tape = [];  // the actual tape as array
    this.offset = 0;  // the offset between positions and the this.tape index
    this.halted = false;  // flag, acts like "readonly" if true

    // set cursor in the middle of the tape
    if (length > 0)
    {
      this.cursor = new Position(Math.floor(length / 2));
      for (var i = 0; i < length; i++)
        this.tape.push(this.default_value);
    } else {
      this.cursor = new Position(this.default_cursor);
    }
  },

  // Move to a new position
  moveTo : function (goto)
  {
    require_position(goto);
    this._indexCheck(goto);
    this.cursor = goto;
  },

  // Extend tape such that given `pos` can be accessed
  extend : function (pos)
  {
    require_position(pos);
    var index = pos.index + this.offset;

    if (0 <= index && index < this.length())
      return;

    var target = index;
    if (target < 0) {
      while (target < 0) {
        this.tape.splice(0, 0, this.default_value);
        this.offset += 1;
        target += 1;
      }
    } else /*if (target > this.length())*/ {
      target = target - this.length() + 1;
      while (target > 0) {
        this.tape.push(this.default_value);
        target -= 1;
      }
    }

    var index = pos.index + this.offset;
    require(0 <= index && index < this.tape.length,
      "Internal error in extend: index " + index +
      " is not in range 0 til " + this.tape.length - 1);

    return this;
  },

  // Read value at position
  read : function (pos)
  {
    require_position(this.cursor);
    if (typeof pos === 'undefined')
      var pos = this.cursor;
    else
      require_position(pos);
    this._indexCheck(pos);

    var index = this._getIndex(pos);
    return this.tape[index];
  },

  // Write value at position
  write : function (value, pos)
  {
    require(!this.halted, "Tape halted. Cannot be written.");
    require_position(this.cursor);
    if (typeof pos === 'undefined')
      var pos = this.cursor;
    else
      require_position(pos);
    var index = this._getIndex(pos);
    this.tape[index] = value;

    return this;
  },

  // Return left-most (lowest) position
  begin : function()
  {
    require(this.offset >= 0);
    return new Position(-this.offset);
  },

  // Return right-most (highest) position
  end : function ()
  {
    require(this.offset >= 0);
    return new Position(this.length() - this.offset - 1);
  },

  // Go one position left, returns value of previous position
  left : function ()
  {
    require(this.offset >= 0);
    require(!this.halted, "Tape halted. Cannot go left.");
    var old_value = this.read();

    this.cursor = this.cursor.sub(1);
    this.extend(this.cursor);

    return old_value;
  },

  // Go one position right, returns value of previous position
  right : function ()
  {
    require(this.offset >= 0);
    require(!this.halted, "Tape halted. Cannot go right.");
    var old_value = this.read();

    this.cursor = this.cursor.add(1);
    this.extend(this.cursor);

    return old_value;
  },

  // Move in some direction
  move : function (move) {
    require_movement(move);
    require(!this.halted, "Tape halted. Cannot move.");

    if (move === mov.RIGHT)
      right();
    else if (move == mov.LEFT)
      left();
    else if (move == mov.HALT)
      this.halted = true;
    else if (move == mov.STOP) {
      // nothing.
    }

    return this;
  },

  leftShift : function (count)
  {
    require(!this.halted, "Tape halted. Cannot move left.");

    for (var i = 0; i < Math.abs(count); i++)
      count < 0 ? right() : left();
    return this;
  },

  rightShift : function (count)
  {
    require(!this.halted, "Tape halted. Cannot move right.");

    for (var i = 0; i < Math.abs(count); i++)
      count < 0 ? left() : right();
    return this;
  },

  toString : function ()
  {
    // @TODO(meisterluk): Show cursor position
    var t = [];
    for (var v in this.tape)
      t.push(this.tape[v].toString());
    return t.join(",");
  },

  set : function (values, pos)
  {
    require(!this.halted, "Tape halted. Cannot set value.");

    // extend tape
    this.extend(pos.add(values.length) - 1);

    // write values
    for (var i = 0; i < values.length; i++)
      write(values[i], pos + i);
  },

  forEach : function (func) {
    var pos = 0;
    for (var value in this.tape)
    {
      func(new Position(pos), this.tape[value]);
      pos += 1;
    }
  },

  equals : function (tape)
  {
    // TODO(meisterluk): to test
    var base = Math.min(this.tape.length, tape.tape.length);
    var all = base;
    for (var idx1 in this.tape)
      for (var idx2 in tape.tape)
      {
        if (this.tape[idx1] === tape.tape[idx2])
          all -= 1;
        else
          if (all !== base)
            all = base;
        if (all === 0)
          return true;
      }
      return false;
  },

  toJSON : function ()
  {
    var out = {};

    out['default_value'] = this.default_value;
    out['cursor'] = this.cursor;
    out['data'] = this.tape;
    out['offset'] = this.offset;
    out['halted'] = this.halted;

    return out;
  },

  import : function (data)
  {
    if (typeof data['data'] === 'undefined' ||
        typeof data['cursor'] === 'undefined' ||
        typeof data['default_value'] === 'undefined')
    {
      throw new AssertionException("data parameter incomplete.");
    }

    if (typeof data['offset'] !== 'undefined')
    {
      if (data['offset'] < 0 || data['data'].length < data['offset'])
        throw new OutOfTapeException(data['offset']);
    }
    if (typeof data['cursor'] !== 'undefined')
    {
      if (data['cursor'] < 0 || data['data'].length < data['cursor'])
        throw new OutOfTapeException(data['cursor']);
    }

    this.tape = data['data'];
    this.cursor = new Position(data['cursor']);
    this.default_value = data['default_value'];

    this.offset = def(data['offset'], 0);
    this.halted = def(data['halted'], false);

    this.extend(this.cursor);
  }
}

// ------------------------ class UserfriendlyTape ------------------------

// invariant: UserFriendlyTape provides a superset API of Tape

function UserFriendlyTape(initial_length, default_value)
{
  var tape = new Tape(initial_length, default_value);

  // Take a string, assume one tape entry per character,
  // write string to tape and set cursor left of it
  var setByString = function (string) {
    tape.clear(1);
    require(tape.position().equals(new Position(0)));
    for (var i = 0; i < string.length; i++) {
      tape.right();
      tape.write(string[i]);
    }
    tape.moveTo(new Position(0));
  };

  // FU, Object.setPrototype
  return {
    length : tape.length,
    position : tape.position,
    _testInvariants : tape._testInvariants,
    _indexCheck : tape._indexCheck,
    _getIndex : tape._getIndex,
    clear : tape.clear,
    moveTo : tape.moveTo,
    extend : tape.extend,
    read : tape.read,
    write : tape.write,
    begin : tape.begin,
    end : tape.end,
    left : tape.left,
    right : tape.right,
    move : tape.move,
    leftShift : tape.leftShift,
    rightShift : tape.rightShift,
    toString : tape.toString,
    set : tape.set,
    forEach : tape.forEach,
    equals : tape.equals,
    toJSON : tape.toJSON,
    import : tape.import,

    setByString : setByString
  }
}

// ----------------------------- RecordedTape -----------------------------

// invariant: RecordedTape provides a superset API of Tape

// Like Tape but stores a history
// Can revert back to old states.

function RecordedTape(history_size, initial_length, default_value)
{
  require(!isNaN(parseInt(history_size)), "History size must be integer");

  this.history_size = parseInt(history_size);
  this.history = [];
  this._tape = new UserFriendlyTape(initial_length, default_value);
}

RecordedTape.prototype = {
  length : function () { return this._tape.length(); },
  clear : function (length) { return this._tape.clear(length); },
  extend : function (pos) { return this._tape.extend(pos); },
  read : function (pos) { return this._tape.read(pos); },
  begin : function () { return this._tape.begin(); },
  end : function () { return this._tape.end(); },
  position : function () { return this._tape.position(); },
  toString : function () { return this._tape.toString(); },
  forEach : function (func) { return this._tape.forEach(func); },

  _oppositeInstruction : function (instr)
  {
    if (instr[0] === "GOTO") {
      var from = instr[1];
      var to = instr[2];
      return ["GOTO", to, from];
    } else if (instr[0] === "GO") {
      return ["GO", -instr[1]];
    } else if (instr[0] === "HALT") {
      return ["HALT", 0];
    } else if (instr[0] === "WRITE") {
      var pos = instr[1];
      var old_value = instr[2];
      var new_value = instr[3];
      return ["WRITE", pos, new_value, old_value];
    }
    throw new AssertionException("Unknown VM instruction");
  },

  _applyInstruction : function (instr)
  {
    if (instr[0] === "GOTO") {
      var from = instr[1];
      var to = instr[2];
      this.moveTo(new Position(to));
    } else if (instr[0] === "GO") {
      var go = instr[1];
      this._tape.rightShift(go);
    } else if (instr[0] === "HALT") {
      this._tape.halted = true;
    } else if (instr[0] === "WRITE") {
      this._tape.write(instr[3], instr[1]);
    } else {
      throw new AssertionException("Unknown VM instruction");
    }
  },

  restore : function (undo_ops)
  {
    require(0 < undo_ops && undo_ops <= this.history.length,
      "Cannot go any more steps back"
    );
    for (var i = 0; i < undo_ops; i++) {
      var instr = this.history.pop();
      var undo_instr = this._oppositeInstruction(instr);
      this._applyInstruction(undo_instr);
    }
    return this;
  },

  clone : function ()
  {
    var t = new RecordedTape(this.history_size);
    t._tape = this._tape.clone();
    t.history = this.history;
    return t;
  },

  moveTo : function (goto)
  {
    var old_pos = this._tape.position().toJSON();
    this._tape.moveTo(goto);
    this.history.push(["GOTO", old_pos, this._tape.position().toJSON()]);
    return this;
  },

  write : function (value, pos)
  {
    if (typeof pos !== 'undefined')
      this.history.push(["WRITE", pos, value]);
    else
      this.history.push(["WRITE", this._tape.position().toJSON(), value]);
    this._tape.write(value, pos);
    return this;
  },

  left : function ()
  {
    this.history.push(["GO", -1]);
    return this._tape.left();
  },

  right : function ()
  {
    this.history.push(["GO", 1]);
    return this._tape.right();
  },

  // Move in some direction
  move : function (move)
  {
    var move = new Movement(move);
    if (move.equals(mov.HALT))
      this.history.push(["HALT"]);
    else if (move.equals(mov.LEFT))
      this.history.push(["GO", -1]);
    else if (move.equals(mov.RIGHT))
      this.history.push(["GO", 1]);
    else if (move.equals(mov.STOP)) {
    }
    this._tape.move(move);
    return this;
  },

  rightShift : function (movement)
  {
    this.history.push(["GO", movement]);
    this._tape.rightShift(movement);
    return this;
  },

  leftShift : function (movement)
  {
    this.history.push(["GO", -movement]);
    this._tape.leftShift(movement);
    return this;
  },

  set : function (values, pos)
  {
    var i = pos;
    var j;
    for (j = 0; j < values.length; j++)
    {
      var old_value;
      if (i.toJSON() >= this._tape.length())
        old_value = this._tape.default_value;
      else
        old_value = this.read(i);
      this.history.push(["WRITE", i, old_value, values[j]]);
      i += 1;
    }
    this._tape.set(values, pos);
  },

  import : function (data)
  {
    if (typeof data['history_size'] === 'undefined')
      throw new FormatException("No history size supplied");

    /*  history is optional
    if (typeof data['history'] === 'undefined')
      throw new FormatException("No history supplied");
    */
    this.history_size = def(data['history_size'], 5);
    if (typeof data['history'] !== 'undefined')
      this.history = data['history'];
    this._tape.import(data);
  },

  toJSON : function ()
  {
    data = this._tape.toJSON();
    data['history_size'] = this.history_size;
    data['history'] = this.history;
    return data;
  }
}

// -------------------------------- Machine -------------------------------

// Machine is putting together Table, Tape and the state handling.
// This is the actual Turingmachine abstraction.

function Machine(initial_state, final_states, table, tape,
  check_inf_loop, step_id)
{
  require_state(initial_state);

  // const, immutable
  this.default_check_inf_loop = 500;

  this.step_id = def(step_id, 0);
  this.current_state = initial_state;
  this.table = table;
  this.tape = tape;

  this.check_inf_loop = def(check_inf_loop, this.default_check_inf_loop);
  this.final_states = final_states;
  this.finished = false;
}

Machine.prototype = {
  getFinished : function ()
  {
    return this.final_states.indexOf(this.current_state) >= 0 && this.finished;
  },

  setFinished : function (finished)
  {
    this.finished = finished;
  },

  read : function () 
  {
    return this.tape.read();
  },

  prev : function (steps)
  {
    var steps = def(steps, 1);
    this.tape.restore(steps);
  },

  next : function (steps)
  {
    var steps = def(steps, 1);
    for (var i = 0; i < steps; i++)
    {
      var read_symbol = this.tape.read();
      var instr = this.table.get(read_symbol, this.current_state);

      // do it
      if (typeof instr !== 'undefined')
      {
        this.tape.write(instr.write);
        this.tape.move(instr.move);
        this.current_state = instr.state;
      } else {
        finished = true;
        break;
      }
    }
  },

  run : function (_base)
  {
    var _base = def(_base, 0);
    var iter = 0;
    for (; iter < this.check_inf_loop; iter++) {
      this.next(1);
      if (this.getFinished())
        return true;
    }

    var ret = confirm("I have run " + (_base + iter) +
      " iterations without reaching a final state. " +
      "Do you still want to continue?");
    if (ret)
      return this.run(_base + iter);
    else
      return undefined;
  },

  undefinedState : function (st)
  {
    return false;
  },

  undefinedSymbol : function (symbol)
  {
    return null;
  },

  addFinalState : function (state)
  {
    require_state(state);
    this.final_states.push(state);
  },

  setFinalStates : function (states)
  {
    for (var k in states)
      require(is_state(states[k]), "Cannot add invalid state as final state");
    this.final_states = states;
  },

  // give me a testcase spec and I will return whether or not the
  // current machine fails (false) or succeeds (true) the testcase
  runTestcase : function (testcase)
  {
    // save old state
    var saved_state = this.toJSON();

    this.tape.clear();
    this.current_state = new State(testcase['input']['current_state']);

    // load tape content
    for (var v in testcase['input']['tape']['data'])
    {
      this.tape.write(testcase['input']['tape']['data'][v]);
      this.tape.right();
    }
    var cursor_pos = new Position(testcase['input']['tape']['cursor']);
    this.tape.extend(cursor_pos);
    this.tape.moveTo(cursor_pos);

    // Actually run it.
    this.run();

    // compare
    // TODO: compare tape with testcase['output']['tape']['data']
    if (testcase['test_state'])
      if (this.machine.current_state.equals(testcase['output']['current_state']))
        return false;
    if (testcase['test_cursor_position'])
      if (this.tape.position().index !== testcase['output']['tape']['cursor'])
        return false;

    // restore old state
    this.import(saved_state);
    return true;
  },

  import : function (data)
  {
    if (typeof data['current_state'] === 'undefined' ||
        typeof data['tape'] === 'undefined' ||
        typeof data['program'] === 'undefined')
    {
      throw AssertionException("data parameter is incomplete");
    }

    tape = new Tape();
    tape.import(data['tape']);
    table = new Table();
    table.import(data['program']);

    this.step_id = def(data['step'], 0);
    this.check_inf_loop = def(data['check_inf_loop'], this.default_check_inf_loop);
    this.current_state = new State(data['current_state']);
    require_state(this.current_state);
    this.table = table;
    this.tape = tape;
    this.final_states = def(data['final_states'], []);
    this.finished = def(data['finished'], false);
  },

  toJSON : function ()
  {
    // TODO(meisterluk): add alphabet
    // TODO(meisterluk): add registered states

    var out = {};
    out['step'] = this.step_id;
    out['current_state'] = this.current_state.toJSON();
    out['program'] = this.table.toJSON();
    out['tape'] = this.tape.toJSON();
    out['finished'] = this.getFinished();
    out['check_inf_loop'] = this.check_inf_loop;

    var final_states = [];
    for (var k in this.final_states)
      final_states.push(this.final_states[k].toJSON());
    out['final_states'] = final_states;

    return out;
  }
};

// ------------------------------ Application -----------------------------

// Runtime for a Machine
// Contains all kinds of UI events

function Application(name, version, author)
{
  this.name = def(name, "turingmachine01");
  this.version = def(version, new Date().toISOString().slice(0, 10));
  this.author = def(author, "user");

  var table = new Table();
  var tape = new RecordedTape(20, 15, "0");
  this.machine = new Machine(StartState, [EndState], table, tape);

  this.description = "";
  this.steps_prev = 1;
  this.steps_next = 1;
  this.speed = 50;
  this.history_size = 10;
}

Application.prototype = {
  updateName : function (name)
  {
    this.name = name;
  },
  updateVersion : function (version)
  {
    this.version = version;
  },
  updateAuthor : function (author)
  {
    this.author = author;
  },
  updateDescription : function (desc)
  {
    console.log("Update description");
    this.description = $("#tm_description p");
    if (desc === "")
      $("#tm_description").hide();
    else
      $("#tm_description").show();
  },
  updateStepsBackwards : function ()
  {
    var val = parseInt($("#tm_steps_prev").val());
    console.log("Update value: " + val);
    if (isNaN(val))
    {
      $("#tm_steps_prev").css("background-color", "red");
    } else {
      $("#tm_steps_prev").css("background-color", "inherit");
      this.steps_prev = val;
    }
  },
  updateStepsForward : function ()
  {
    var val = parseInt($("#tm_steps_next").val());
    console.log("Update value: " + val);
    if (isNaN(val))
    {
      $("#tm_steps_next").css("background-color", "red");
    } else {
      $("#tm_steps_next").css("background-color", "inherit");
      this.steps_next = val;
    }
  },
  updateSpeed : function ()
  {
    console.log("Update speed");
    var val = parseInt($("#tm_speed").val());
    if (isNaN(val))
    {
      $("#tm_speed").css("background-color", "red");
    } else {
      $("#tm_speed").css("background-color", "inherit");
      this.speed = val;
    }
  },
  updateHistorySize : function ()
  {
    console.log("Update history size");
    var val = parseInt($("#tm_history_size").val());
    if (isNaN(val))
    {
      $("#tm_history_size").css("background-color", "red");
    } else {
      $("#tm_history_size").css("background-color", "inherit");
      this.history_size = val;
    }
  },

  updateTransitions : function ()
  {

  },
  backwards : function ()
  {
    console.log("Go backwards " + this.steps_prev + " steps!");
    draw(this.machine.tape, this.machine.current_state);
  },
  forward : function ()
  {
    console.log("Go forward " + this.steps_next + " steps!");
    draw(this.machine.tape, this.machine.current_state);
  },
  loadExampleProgram : function (program)
  {
    var program = def(program, $("#tm_example").val());

    switch (program) {
      case "2bit_xor":
        var program = twobit_xor();
        break;
      default:
        throw AssertionException("Loading unknown program");
        return
        break;
    }

    // list testcases for selection
    if (typeof program['testcases'] !== 'undefined')
      this.testcases = program['testcases'];
    else
      this.testcases = [];
    if (this.testcases.length > 0)
      //this.loadTestcase(this.testcases[0]);
      0; // TODO: currently disabled

    this.machine.import(program);
    if (typeof program['description'] !== 'undefined')
      updateDescription(program['description']);
    if (typeof program['name'] !== 'undefined')
      updateName(program['name']);
    if (typeof program['version'] !== 'undefined')
      updateVersion(program['version']);
    if (typeof program['author'] !== 'undefined')
      updateAuthor(program['author']);

    console.log("Load example program " + program);
    draw(this.machine.tape, this.machine.current_state);
  },
  loadTestcase : function (testcase)
  {
    if (typeof testcase === 'undefined') {
      for (var tc in this.testcases) {
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

    var result = this.machine.runTestcase(testcase);
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
  },
  loadTape : function ()
  {
    console.log("Load tape");
    draw(this.machine.tape, this.machine.current_state);
  },
  reset : function ()
  {
    console.log("Reset");
  },
  run : function ()
  {
    console.log("Run");
    draw(this.machine.tape, this.machine.current_state);
  },
  import : function ()
  {
    console.log("Import");
  },
  export : function ()
  {
    console.log("Export");
  }
};

function defaultApplication()
{
  var instrs =
    [["0", "Z1", "1", "L", "Z2"],
     ["1", "Z1", "1", "L", "Z2"]];

  var app = new Application(app_name, app_version, app_author);
  app.storeInstructions(instrs);
  return app;
}

// --------------------------- Canvas / drawing ---------------------------

var cursor_color = '#FC3';

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
  console.log(values);
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


// ------------------------------ Test suite ------------------------------

function testsuite()
{
  // require and def
  require(true);
  require(true, "Hello World");
  require(def(undefined, 5) === 5);
  require(def(6, 5) === 6);

  // State objects
  var s1 = new State("Z1");
  var s2 = new State("Z1");
  require(s1.equals(s2));

  // Position objects
  var p1 = new Position(5);
  var p2 = new Position(-5);
  require(p1.sub(10).equals(p2));
  require(p2.add(10).equals(p1));

  // Tape tests
  var t = new Tape();
  t._testInvariants();
  t.write(4);
  t._testInvariants();
  t.right();
  t._testInvariants();
  t.write(5);
  t._testInvariants();
  require(t.read() === 5);
  require(t.position().equals(new Position(1)));
  t._testInvariants();
  t.moveTo(new Position(0));
  require(t.read() === 4);
  t._testInvariants();

  var t = new Tape(0, "t");
  t._testInvariants();
  t.write("a");
  t._testInvariants();
  t.right();
  require(t.read() === "t");

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
    'program' : {},
    'current_state' : 'Start',
    'final_states' : ['End'],
    'testcases' : twobit_xor_testcases()
  };
  // Oh, I <sarcasm>love</sarcasm> Javascript!
  out['program'][['0', 'Start']] = ['0', 'R', 'E'];
  out['program'][['1', 'Start']] = ['1', 'R', 'O'];
  out['program'][[' ', 'Start']] = [' ', 'R', 'Start'];
  out['program'][['0', 'E']] = ['0', 'R', 'E'];
  out['program'][['1', 'E']] = ['1', 'R', 'O'];
  out['program'][[' ', 'E']] = ['0', 'R', 'End'];
  out['program'][['0', 'O']] = ['0', 'R', 'O'];
  out['program'][['1', 'O']] = ['1', 'R', 'E'];
  out['program'][[' ', 'O']] = ['0', 'R', 'End'];

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
  var app = new Application(app_name, app_version, app_author);
  testsuite();
  console.debug("Testsuite successfully passed");

  $("#tm_control_prev").click(function () { app.backwards(); });
  $("#tm_steps_prev").change(function () { app.updateStepsBackwards(); });
  $("#tm_control_next").click(function () { app.forward(); });
  $("#tm_steps_next").change(function () { app.updateStepsForward(); });
  $("#tm_control_reset").click(function () { app.reset(); });
  $("#tm_control_run").click(function () { app.run(); });

  $("#tm_import").click(function () { app.import(); });
  $("#tm_export").click(function () { app.export(); });
  $("#tm_example").change(function () { app.loadExampleProgram(); });
  $("#tm_testcase").change(function () { app.loadTestcase(); });

  $("#tm_name").change(function () { app.updateHistorySize(); });
  $("#tm_history_size").change(function () { app.updateHistorySize(); });
  $("#tm_speed").change(function () { app.updateSpeed(); });

  $("#tm_apply_tape").click(function () { app.loadTape(); });
  $("#tm_transition_table").change(function () { app.updateTransitions(); });

  // initial values
  app.loadExampleProgram("2bit_xor");
  $("#tm_steps_prev").val(app.steps_prev);
  $("#tm_steps_next").val(app.steps_next);

  return app;
}