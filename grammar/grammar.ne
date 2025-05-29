@preprocessor esmodule
@{%
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

%}

@lexer lexer

file -> %newline:* header:? score:? {% data => ({ header: data[1], score: data[2] }) %}

header -> property:* %header_sep:+ %newline:+ {% data => Object.fromEntries(data[0]) %}

property -> %identifier %colon %string %newline:+ {% data => [data[0].value, data[2].value] %}

score -> line (%newline:+ line {% data => data[1] %}):* %newline:* {% data => [data[0], ...data[1]] %}

line -> %bar:? measure (%bar measure {% data => data[1] %}):* %bar:? {% data => ({ measures: [data[1], ...data[2]], last_bar: data[3] !== null }) %}

measure -> octave:? durable_note:+ {% data => (data[0] ? data[1].map(note => {
  if ('octave' in note) {
    return { ...note, octave: note.octave + data[0] }
  } else {
    return note
  }
}) : data[1]) %}

accidental -> 
    %sharp {% () => 1 %} 
  | %sharpsharp {% () => 2 %} 
  | %flat {% () => -1 %} 
  | %flatflat {% () => -2 %} 
  | %natural  {% () => 0 %}

octave -> %lower:+ {% data => -data[0].length %} | %higher:+ {% data => data[0].length %}

octave_note -> accidental:? %note octave:? {% data => ({ type: 'pitch', accidental: data[0], note: parseInt(data[1].value), octave: data[2] || 0}) %} 

rest -> %rest {% () => ({ type: 'rest' }) %}

drum -> %drum {% () => ({ type: 'drum' }) %}

general_note -> octave_note {% id %} | rest {% id %} | drum {% id %}

tie -> %tie {% () => ({ tie: true }) %} 

length -> 
    %dash:+ {% data => ({ dashes: data[0].length }) %} 
  | (%half {% id %} | %dot {% id %} ):+ {% data => ({ 
      dots: data[0].filter(e => e.type == 'dot').length, 
      halves: data[0].filter(e => e.type == 'half').length }) 
    %} 

durable_note -> tie:? general_note length:? {% merge %}
