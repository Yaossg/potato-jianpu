import nearley from 'nearley';
import compile from 'nearley/lib/compile';
import generate from 'nearley/lib/generate';
import nearleyGrammar from 'nearley/lib/nearley-language-bootstrapped';

function compileGrammar(sourceCode, name) {
  // Parse the grammar source into an AST
  const grammarParser = new nearley.Parser(nearleyGrammar);

  grammarParser.feed(sourceCode);

  if (grammarParser.results.length === 0) {
    throw new Error('No valid grammar found in the source code.');
  }

  const grammarAst = grammarParser.results[0];
  // Compile the AST into a set of rules
  const grammarInfoObject = compile(grammarAst, {});
  // Generate JavaScript code from the rules
  const grammarJs = generate(grammarInfoObject, name);
  return grammarJs;
}

export default function nearleyc() {
  return {
    name: 'nearleyc',
    transform(code, id) {
      if (id.endsWith('.ne')) {
        const name = id.split('/').pop().replace('.ne', '');
        const compiledCode = compileGrammar(code, name);
        return { code: compiledCode };
      }
      return null;
    }
  };
}
