// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
function id(x) { return x[0]; }

import moo from 'moo';

function ignoreWs(lexer) {
  return {
    next() {
      while (true) {
        const token = lexer.next();
        if (token === undefined) {
          return token;
        }
        if (token.type !== "ws") {
          return token;
        }
      }
    },
    save: () => lexer.save(),
    reset: (chunk, info) => lexer.reset(chunk, info),
    formatError: (token) => lexer.formatError(token),
    has: (name) => name !== 'ws' && lexer.has(name),
  }
}

const lexer = ignoreWs(moo.compile({
  ws:      {match: /[ \t]+/},
  note:    /[1-7]/,
  rest:    '0',
  drum:    'X',
  newline: {match: '\n', lineBreaks: true},
  bar:     '|',
  sharpsharp:'##',
  sharp:   '#',
  flatflat:'bb',
  flat:    'b',
  natural: '%',
  half:    '/',
  dot:     '.',
  dash:    '-',
  lower:   ',',
  higher:  "'",
  tie:     '~',
  header_sep:'=',
  colon:   ':',
  identifier: {match: /[a-z_]+/},
  string: {match: /"(?:\\["\\rn]|[^"\\])*?"/, lineBreaks: true, value: x => x.slice(1, -1)},
}));

function merge(objects) {
  return objects.reduce((acc, obj) => ({...acc, ...obj}), {});
}

let Lexer = lexer;
let ParserRules = [
    {"name": "file$ebnf$1", "symbols": []},
    {"name": "file$ebnf$1", "symbols": ["file$ebnf$1", (lexer.has("newline") ? {type: "newline"} : newline)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "file$ebnf$2", "symbols": ["header"], "postprocess": id},
    {"name": "file$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "file$ebnf$3", "symbols": ["score"], "postprocess": id},
    {"name": "file$ebnf$3", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "file", "symbols": ["file$ebnf$1", "file$ebnf$2", "file$ebnf$3"], "postprocess": data => ({ header: data[1], score: data[2] })},
    {"name": "header$ebnf$1", "symbols": []},
    {"name": "header$ebnf$1", "symbols": ["header$ebnf$1", "property"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "header$ebnf$2", "symbols": [(lexer.has("header_sep") ? {type: "header_sep"} : header_sep)]},
    {"name": "header$ebnf$2", "symbols": ["header$ebnf$2", (lexer.has("header_sep") ? {type: "header_sep"} : header_sep)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "header$ebnf$3", "symbols": [(lexer.has("newline") ? {type: "newline"} : newline)]},
    {"name": "header$ebnf$3", "symbols": ["header$ebnf$3", (lexer.has("newline") ? {type: "newline"} : newline)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "header", "symbols": ["header$ebnf$1", "header$ebnf$2", "header$ebnf$3"], "postprocess": data => Object.fromEntries(data[0])},
    {"name": "property$ebnf$1", "symbols": [(lexer.has("newline") ? {type: "newline"} : newline)]},
    {"name": "property$ebnf$1", "symbols": ["property$ebnf$1", (lexer.has("newline") ? {type: "newline"} : newline)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "property", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier), (lexer.has("colon") ? {type: "colon"} : colon), (lexer.has("string") ? {type: "string"} : string), "property$ebnf$1"], "postprocess": data => [data[0].value, data[2].value]},
    {"name": "score$ebnf$1", "symbols": []},
    {"name": "score$ebnf$1$subexpression$1$ebnf$1", "symbols": [(lexer.has("newline") ? {type: "newline"} : newline)]},
    {"name": "score$ebnf$1$subexpression$1$ebnf$1", "symbols": ["score$ebnf$1$subexpression$1$ebnf$1", (lexer.has("newline") ? {type: "newline"} : newline)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "score$ebnf$1$subexpression$1", "symbols": ["score$ebnf$1$subexpression$1$ebnf$1", "line"], "postprocess": data => data[1]},
    {"name": "score$ebnf$1", "symbols": ["score$ebnf$1", "score$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "score$ebnf$2", "symbols": []},
    {"name": "score$ebnf$2", "symbols": ["score$ebnf$2", (lexer.has("newline") ? {type: "newline"} : newline)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "score", "symbols": ["line", "score$ebnf$1", "score$ebnf$2"], "postprocess": data => [data[0], ...data[1]]},
    {"name": "line$ebnf$1", "symbols": [(lexer.has("bar") ? {type: "bar"} : bar)], "postprocess": id},
    {"name": "line$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "line$ebnf$2", "symbols": []},
    {"name": "line$ebnf$2$subexpression$1", "symbols": [(lexer.has("bar") ? {type: "bar"} : bar), "measure"], "postprocess": data => data[1]},
    {"name": "line$ebnf$2", "symbols": ["line$ebnf$2", "line$ebnf$2$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "line$ebnf$3", "symbols": [(lexer.has("bar") ? {type: "bar"} : bar)], "postprocess": id},
    {"name": "line$ebnf$3", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "line", "symbols": ["line$ebnf$1", "measure", "line$ebnf$2", "line$ebnf$3"], "postprocess": data => [data[1], ...data[2]]},
    {"name": "measure$ebnf$1", "symbols": ["octave"], "postprocess": id},
    {"name": "measure$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "measure$ebnf$2", "symbols": ["durable_note"]},
    {"name": "measure$ebnf$2", "symbols": ["measure$ebnf$2", "durable_note"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "measure", "symbols": ["measure$ebnf$1", "measure$ebnf$2"], "postprocess":  data => (data[0] ? data[1].map(note => {
          if ('octave' in note) {
            return { ...note, octave: note.octave + data[0] }
          } else {
            return note
          }
        }) : data[1]) },
    {"name": "accidental", "symbols": [(lexer.has("sharp") ? {type: "sharp"} : sharp)], "postprocess": () => 1},
    {"name": "accidental", "symbols": [(lexer.has("sharpsharp") ? {type: "sharpsharp"} : sharpsharp)], "postprocess": () => 2},
    {"name": "accidental", "symbols": [(lexer.has("flat") ? {type: "flat"} : flat)], "postprocess": () => -1},
    {"name": "accidental", "symbols": [(lexer.has("flatflat") ? {type: "flatflat"} : flatflat)], "postprocess": () => -2},
    {"name": "accidental", "symbols": [(lexer.has("natural") ? {type: "natural"} : natural)], "postprocess": () => 0},
    {"name": "octave$ebnf$1", "symbols": [(lexer.has("lower") ? {type: "lower"} : lower)]},
    {"name": "octave$ebnf$1", "symbols": ["octave$ebnf$1", (lexer.has("lower") ? {type: "lower"} : lower)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "octave", "symbols": ["octave$ebnf$1"], "postprocess": data => -data[0].length},
    {"name": "octave$ebnf$2", "symbols": [(lexer.has("higher") ? {type: "higher"} : higher)]},
    {"name": "octave$ebnf$2", "symbols": ["octave$ebnf$2", (lexer.has("higher") ? {type: "higher"} : higher)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "octave", "symbols": ["octave$ebnf$2"], "postprocess": data => data[0].length},
    {"name": "octave_note$ebnf$1", "symbols": ["accidental"], "postprocess": id},
    {"name": "octave_note$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "octave_note$ebnf$2", "symbols": ["octave"], "postprocess": id},
    {"name": "octave_note$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "octave_note", "symbols": ["octave_note$ebnf$1", (lexer.has("note") ? {type: "note"} : note), "octave_note$ebnf$2"], "postprocess": data => ({ type: 'pitch', accidental: data[0], note: parseInt(data[1].value), octave: data[2] || 0})},
    {"name": "rest", "symbols": [(lexer.has("rest") ? {type: "rest"} : rest)], "postprocess": () => ({ type: 'rest' })},
    {"name": "drum", "symbols": [(lexer.has("drum") ? {type: "drum"} : drum)], "postprocess": () => ({ type: 'drum' })},
    {"name": "general_note", "symbols": ["octave_note"], "postprocess": id},
    {"name": "general_note", "symbols": ["rest"], "postprocess": id},
    {"name": "general_note", "symbols": ["drum"], "postprocess": id},
    {"name": "tie", "symbols": [(lexer.has("tie") ? {type: "tie"} : tie)], "postprocess": () => ({ tie: true })},
    {"name": "length$ebnf$1", "symbols": [(lexer.has("dash") ? {type: "dash"} : dash)]},
    {"name": "length$ebnf$1", "symbols": ["length$ebnf$1", (lexer.has("dash") ? {type: "dash"} : dash)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "length", "symbols": ["length$ebnf$1"], "postprocess": data => ({ dashes: data[0].length })},
    {"name": "length$ebnf$2$subexpression$1", "symbols": [(lexer.has("half") ? {type: "half"} : half)], "postprocess": id},
    {"name": "length$ebnf$2$subexpression$1", "symbols": [(lexer.has("dot") ? {type: "dot"} : dot)], "postprocess": id},
    {"name": "length$ebnf$2", "symbols": ["length$ebnf$2$subexpression$1"]},
    {"name": "length$ebnf$2$subexpression$2", "symbols": [(lexer.has("half") ? {type: "half"} : half)], "postprocess": id},
    {"name": "length$ebnf$2$subexpression$2", "symbols": [(lexer.has("dot") ? {type: "dot"} : dot)], "postprocess": id},
    {"name": "length$ebnf$2", "symbols": ["length$ebnf$2", "length$ebnf$2$subexpression$2"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "length", "symbols": ["length$ebnf$2"], "postprocess":  data => ({ 
        dots: data[0].filter(e => e.type == 'dot').length, 
        halves: data[0].filter(e => e.type == 'half').length }) 
            },
    {"name": "durable_note$ebnf$1", "symbols": ["tie"], "postprocess": id},
    {"name": "durable_note$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "durable_note$ebnf$2", "symbols": ["length"], "postprocess": id},
    {"name": "durable_note$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "durable_note", "symbols": ["durable_note$ebnf$1", "general_note", "durable_note$ebnf$2"], "postprocess": merge}
];
let ParserStart = "file";
export default { Lexer, ParserRules, ParserStart };
