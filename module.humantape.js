//
// humantape.js
//
// Human-readable tape representation syntax module
//
// - read: read tape from userinput text
// - write: write tape to text string
//
// 2014, Public Domain, Lukas Prokop
//

humantape = {};

humantape.exc = function (msg, col) {
  msg = "[tape] " + msg;
  if (typeof col !== 'undefined')
    msg += " [string index " + col + "]";
  throw new SyntaxException(msg);
};

humantape.read = function (tape, text, symbol_norm_fn) {
  if (typeof text !== 'string')
    humantape.exc("Only strings can be interpreted as humantape syntax")
  if (text.indexOf("\n") !== -1)
    humantape.exc("Unexpected newline character", text.indexOf("\n"));

  symbol_norm_fn = def(symbol_norm_fn, normalizeSymbol);

  var elements = text.split(",");
  var data = {};

  // blank symbol
  var bs = undefined;
  if (elements.length > 0) {
    bs = elements[0].match(/^blank="(.*)"\s*$/);
    if (bs)
      data['blank_symbol'] = bs[1];
  }

  var found_cursor = false;
  var values = [];
  for (var e = 0; e < elements.length; e++) {
    if (e === 0 && bs)
      continue;

    var element = elements[e];
    var telement = element.trim();

    // detect cursor
    if (telement[0] === '*' && telement[telement.length - 1] === '*' &&
        element.length >= 2 && found_cursor === false)
    {
      element = telement;
      found_cursor = e - (bs ? 1 : 0);
      element = element.substr(1, element.length - 2);
    }

    // un-escape
    element = element.replace(/\\"/g, '"');

    // if is blank symbol, store undefined
    if (data['blank_symbol'] && element === data['blank_symbol']) {
      element = undefined;
    }

    // store element
    values.push(element);
  }

  if (found_cursor === false) {
    data['cursor'] = 0;
    data['offset'] = 0;
  } else {
    data['cursor'] = 0;
    data['offset'] = found_cursor;
  }

  data['data'] = values;

  // import tape data
  tape.fromJSON(data, symbol_norm_fn);
};

humantape.write = function (tape, with_blank_symbol) {
  var json = tape.toJSON();
  if (with_blank_symbol)
    var out = 'blank="' + json['blank_symbol'] + '",';
  else
    var out = '';
  var cursor = json['cursor'];
  var cursor_written = false;

  for (var i = 0; i < json['data'].length; i++) {
    var val = (i === cursor && !cursor_written)
      ? function (v) { cursor_written = true;
                       return "*" + (v ? v.toString() : "" + v) + "*"; }
      : function (v) { return (v ? v.toString() : "" + v); };

    if (json['data'][i] !== undefined &&
        json['data'][i][0] === '*' &&
        json['data'][i][json['data'].length - 1] === '*' &&
        (i === cursor && !cursor_written))
    {
      humantape.exc("Cannot export tape value which starts "
        + "with * and ends with *; given in " + JSON.stringify(json['data']));
    }

    if (json['data'][i] === undefined)
      out += val(json['blank']) + ",";
    else
      out += val(json['data'][i]) + ",";
  }

  return out.substr(0, out.length - 1);
};