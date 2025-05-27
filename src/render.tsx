import { JSX } from 'react';
import { parse, ParseError } from './parser';

import { ScoreLineSvg } from './render_svg';

function selectBar(last_bar: boolean, last_measure: boolean, last_line: boolean): string {
    if (last_measure && last_line) {
        return '𝄂';
    }
    if (!last_measure || last_bar) {
        return '𝄀';
    }
    return '';
}

// TODO time signature and connected underlines
// TODO tie across lines

export function compile(source: string): JSX.Element {
    const score = parse(source);
    if (score instanceof ParseError) {
        return <>{JSON.stringify(score)}</>;
    }
    return <div>{
        ...score.map((line, lineno) => <><ScoreLineSvg measures={
            line.measures.map((notes, measureno) => ({notes, bar: 
                selectBar(line.last_bar, measureno === line.measures.length - 1, lineno === score.length - 1)}))
            } /><br/></>)
    }</div>
}