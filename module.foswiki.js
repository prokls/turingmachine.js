//
// foswiki.js
//
// Foswiki syntax module
//
// - InvalidFoswikiException: to trigger Syntax Errors
// - readProgram / writeProgram: convenient table usage
// - read: read turingmachine from userinput text
// - write: write turingmachine to text string
//
// 2014, Public Domain, Lukas Prokop
//

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


foswiki = {};

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

foswiki.readDefinitionLine = function (line, lineno) {
  var normalize = foswiki.removeMarkup;

  var m = line.match(/( +)\$ ([^:]+?): (.*)/);
  if (m === null)
    return null;
  if (m[1].length !== 3)
    throw new InvalidFoswikiException("Foswiki definition list items "
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
    return { 'current state': value };
  else if (key.match(/tape/i))
    return { 'tape content': value };
  else if (key.match(/cursor/i)) {
    var cursor = parseInt(value);
    if (isNaN(cursor))
      throw new InvalidFoswikiException("Cursor must be integer "
        + "(line " + line + ")");
    return { 'cursor': cursor };
  } else {
    var obj = {};
    obj[key] = value;
    return obj;
  }
};

foswiki.writeDefinitionLine = function (obj) {
  var create = function (a, b) {
    return "   $ __" + a + "__: " + b + "\n";
  };
  var assoc = [["machine name", "Machine name"],
    ["final states", "Final states"],
    ["current state", "Current state"],
    ["tape content", "Tape content"],
    ["cursor", "Cursor"]];
  var out = "";

  var used = [];
  for (var p in assoc) {
    if (assoc[p][0] in obj) {
      out += create(assoc[p][0], assoc[p][1]);
      used.push(assoc[p][0]);
    }
  }

  for (var prop in obj) {
    if ($.inArray(prop, used) === -1)
      out += create(prop, obj[prop]);
  }

  return out;
};

foswiki.readTable = function (text) {
  var rowsep = "\n";
  var colsep = "|";
  text = text.trim();

  var table = [];
  var columns = -1;

  var rows = text.split(rowsep);
  if (rows.length < 1)
    throw new InvalidFoswikiException("No row found in foswiki table");
  for (var row = 0; row < rows.length; row++) {
    var cols = rows[row].split(colsep);

    if (cols.length < 2)
      throw new InvalidFoswikiException("No row found in foswiki table");

    if (columns === -1)
      columns = cols.length;
    if (columns !== cols.length)
      throw new InvalidFoswikiException("Inconsistent number of columns "
        + "in table rows. Expected " + columns + " but was " + cols.length);

    var onerow = [];
    for (var col = 0; col < cols.length; col++) {
      if (col === 0 && rows[row][col].trim() !== "")
        throw new InvalidFoswikiException("Table lines must start with |");
      if (col === cols.length - 1 && rows[row][col].trim() !== "")
        throw new InvalidFoswikiException("Table lines must end with |");

      onerow.append(rows[row][col]);
    }
    table.push(onerow);
  }

  return table;
};

foswiki.readTransitionTriple = function (text) {
  if (text.trim() === "" || text.trim() === "..." || text.trim() === "…")
    return null;
  var vals = v.split(" - ");
  if (vals.length !== 3)
    throw new InvalidFoswikiException("Transition cell must contain "
      + "3 values but '" + v + "' is given");

  var symbol = normalizeSymbol(vals[0]);
  var move = normalizeMovement(vals[1]);

  return [symbol, move, state(vals[2])];
}

foswiki.readProgram = function (text) {
  var table = foswiki.readTable(text);

  var symbols = [];
  var states = [];
  var program = [];

  for (var r = 0; r < table.length; r++) {
    for (var c = 0; c < table.length; c++) {
      if (r === 0 && c !== 0) {
        var n = normalizeSymbol(table[r][c].trim());
        if ($.inArray(n, symbols) === -1)
          symbols.push(n);
        else
          throw new InvalidFoswikiException("Symbol '" + n
            + "' used twice as read symbol");
      }
      if (c === 0 && row !== 0) {
        var n = table[r][c].trim();
        if ($.inArray(n, states) === -1)
          states.push(n);
        else
          throw new InvalidFoswikiException("State '" + n
            + "' used twice as state identifier");
      }

      if (c !== 0 && row !== 0) {
        var tr_cell = foswiki.readTransitionTriple(table[r][c]);
        program.push([symbols[c - 1], states[r - 1],
          tr_cell[0], tr_cell[1], tr_cell[2]])
      }
    }
  }

  return program;
};

foswiki.writeProgram = function (prg) {
  var justify = function (text, size) {
    if (typeof size === 'undefined')
      size = 25;
    else if (isNaN(parseInt(size)))
      throw new Error("justify() only accepts integers as size parameter");
    else
      size = parseInt(size);

    if (typeof text === 'undefined')
      return repeat(" ", size);
    var chars = size - text.toString().length;
    if (chars < 0)
      chars = 0;
    return text.toString() + repeat(" ", chars);
  };

  // retrieve possible symbols and states to start with
  var from_symbols = prg.getFromSymbols();
  var from_states = prg.getFromStates();

  var j = function (v) { return justify(v); };
  text += "\n| " + j("") + " | " + from_symbols.map(j).join(" | ") + " |\n";

  for (var j = 0; j < from_states.length; j++) {
    var from_state = from_states[j];
    var cols = [];

    for (var i = 0; i < from_symbols.length; i++) {
      var from_symb = from_symbols[i];
      var instr = prg.get(from_symb, state(from_state));

      if (!instr)
        cols.push(justify(""));
      else
        cols.push(justify(instr.toJSON().join(" - ")));
    }

    text += "| " + justify(from_state) + " | " + cols.join(" | ") + " |\n";
  }
};

foswiki.read = function (tm, text) {
  if (typeof text !== 'string' || text.trim().length === 0)
    throw new InvalidFoswikiException("Cannot import empty Foswiki text");

  var lines = text.split("\n");

  var table_here = null;
  var table = "";
  var definitions = {};

  // read it line-by-line
  for (var l = 0; l < lines.length; l++) {
    var line = lines[l];
    if (line.match(/^\s*$/))
      continue;

    // mode transition
    if (line.trim()[0] === '|' && (table_here === null || table_here === true)) {
      table += line + "\n";
      table_here = true;
    } else if (line.substr(0, 5) === '   * ') {
      if (table_here === true)
        table_here = false;
      var result = foswiki.readDefinitionLine(line, l);
      for (var i in result)
        definitions[i] = result[i];
    }
  }

  if (table === '')
    throw new InvalidFoswikiException("No Foswiki (transition) table "
      + "found in string to parse");

  // load program to TM
  var transition_table = foswiki.readProgram(table);
  var program = tm.getProgram();
  program.clear();
  for (var i = 0; i < transition_table.length; i++) {
    program.set(transition_table[i]);
  }

  // load definitions to TM
  if ('machine name' in definitions)
    tm.setMachineName(definitions['machine name']);
  if ('final states' in definitions)
    tm.setFinalStates(definitions['final states']);
  if ('current state' in definitions)
    tm.setState(definitions['current state']);
  if ('tape content' in definitions)
    tm.getTape().fromHumanString(definitions['tape content']);
  if ('cursor' in definitions)   // TODO: remove cursor, should be in Tape Content contained
    tm.getTape().moveTo(position(definitions['cursor']));

  // invalid data fixes
  if (tm.getFinalStates().length === 0)
    final_states.push("End");
  if (tm.getMachineName() === "")
    tm.setMachineName(UI['getRandomMachineName']());

  // write configuration to TM
  return definitions;
};

foswiki.write = function (tm) {
  // metadata header
  var text = foswiki.writeDefinitionLine({
    'machine name': tm.getMachineName(),
    'current state': tm.getState().toString(),
    'final states': tm.getFinalStates()
      .map(function (v) { return v.toString(); })
      .join(","),
    'tape content': tm.getTape().toHumanString()
  });

  text += "\n";

  // transition table
  text += foswiki.writeProgram(tm.getProgram());

  return text;
};
