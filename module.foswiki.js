//
// foswiki.js
//
// Foswiki syntax module
//
// - readProgram / writeProgram: convenient table usage
// - read: read turingmachine from userinput text
// - write: write turingmachine to text string
//
// 2014, Public Domain, Lukas Prokop
//

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
    return { 'current state': value };
  else if (key.match(/tape/i))
    return { 'tape content': value };
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

foswiki.readTransitionTriple = function (text,
  symbol_norm_fn, state_norm_fn)
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

  var symb = symbol(vals[0], symbol_norm_fn);
  var move = motion(vals[1], state_norm_fn);

  return [symb, move, vals[2]];
}

foswiki.readProgram = function (tokenstream,
  symbol_norm_fn, state_norm_fn)
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
        var n = symbol(foswiki.removeMarkup(content), symbol_norm_fn);
        if (all(symbols, function (s) { return !s.equals(n); }))
          symbols.push(n);
        else {
          var first = 0;
          for (var i = 0; i < symbols.length; i++)
            if (symbols.equals(n))
              first = i;
          foswiki.exc(repr(n) + " used twice as read symbol "
            + "(columns " + first + " and " + c + ")");
        }
      }
      // read state
      if (c === 0 && r > 0) {
        var n = state(foswiki.removeMarkup(content), state_norm_fn);
        if (all(states, function (s) { return !s.equals(n); }))
          states.push(n);
        else {
          var first = 0;
          for (var i = 0; i < states.length; i++)
            if (states.equals(n))
              first = i;
          foswiki.exc(repr(n) + " used twice as current state "
            + "(rows " + first + " and " + r + ")");
        }
      }

      // transition triple
      if (c > 0 && r > 0) {
        var tr_cell = foswiki.readTransitionTriple(content,
          symbol_norm_fn, state_norm_fn);
        program.push([symbols[c - 1], states[r - 1],
          tr_cell[0], tr_cell[1], state(tr_cell[2], state_norm_fn)])
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
  var transition_table = foswiki.readProgram(table,
    symbol_norm_fn, state_norm_fn);
  var program = tm.getProgram();
  program.clear();
  for (var i = 0; i < transition_table.length; i++)
    program.set(transition_table[i][0], transition_table[i][1],
      transition_table[i][2], transition_table[i][3],
      transition_table[i][4]);

  // load definitions to TM
  if ('machine name' in definitions)
    tm.setMachineName(definitions['machine name']);
  if ('final states' in definitions)
    tm.setFinalStates(definitions['final states'].map(function (v) {
      return state(v, state_norm_fn);
    }));
  if ('current state' in definitions)
    tm.setState(state(definitions['current state'], state_norm_fn));
  if ('tape content' in definitions)
    tm.getTape().fromHumanString(definitions['tape content'], symbol_norm_fn);

  // compatibility definitions, TODO: remove as time goes by
  if ('blank symbol' in definitions)
    tm.getTape().setBlankSymbol(definitions['blank symbol'], symbol_norm_fn);
  if ('cursor' in definitions) {
    var tape = tm.getTape();
    while (tape.cursor().index < definitions['cursor'])
      tape.right();
    while (tape.cursor().index > definitions['cursor'])
      tape.left();
  }

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
