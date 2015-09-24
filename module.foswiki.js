//
// foswiki.js
//
// Foswiki syntax module
//
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
