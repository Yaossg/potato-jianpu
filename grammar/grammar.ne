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
  nopitch: 'X',
  newline: {match: '\n', lineBreaks: true},
  // lrepeat: '|:',
  // rrepeat: ':|',
  bar: '|',
  sharpsharp: '##',
  sharp: '#',
  flatflat: 'bb',
  flat: 'b',
  natural: '%',
  half: '/',
  dot: '.',
  hyphen: '-',
  lower: ',',
  higher: "'",
  tie: '~',
}));

function merge(objects) {
  return objects.reduce((acc, obj) => ({...acc, ...obj}), {});
}

%}

@lexer lexer

score -> %newline:* line (%newline:+ line {% data => data[1] %}):* %newline:* {% data => [data[1], ...data[2]] %}

line -> %bar:? measure (%bar measure {% data => data[1] %}):* %bar:? {% data => [data[1], ...data[2]] %}

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

octave_note -> accidental:? %note octave:? {% data => ({ accidental: data[0], note: parseInt(data[1].value), octave: data[2] || 0}) %} 

rest -> %rest {% () => ({ rest: true }) %}

nopitch -> %nopitch {% () => ({ nopitch: true }) %}

general_note -> octave_note {% id %} | rest {% id %} | nopitch {% id %}

tie -> %tie {% () => ({ tie: true }) %} 

length -> 
    %hyphen:+ {% data => ({ hyphens: data[0].length }) %} 
  | (%half {% id %} | %dot {% id %} ):+ {% data => ({ 
      dots: data[0].filter(e => e.type == 'dot').length, 
      halves: data[0].filter(e => e.type == 'half').length }) 
    %} 

durable_note -> tie:? general_note length:? {% merge %}
