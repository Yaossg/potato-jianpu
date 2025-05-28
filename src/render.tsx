import { JSX } from 'react';
import { parse, ParseError } from './parser';

import { ScoreLineSvg, selectBar } from './render_svg';

// TODO time signature
// TODO tie across lines

export function compile(source: string): JSX.Element {
    const score = parse(source);
    if (score instanceof ParseError) {
        return <>{JSON.stringify(score)}</>;
    }
    return <div>{
        ...score.map((line, lineno) => <><ScoreLineSvg measures={
            line.measures.map((notes, measureno) => ({
                notes, bar:
                    selectBar(line.last_bar, measureno === line.measures.length - 1, lineno === score.length - 1)
            }))
        } /><br /></>)
    }</div>
}