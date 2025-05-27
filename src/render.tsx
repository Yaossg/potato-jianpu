import { JSX } from 'react';
import './render.css';
import { DurableNote, Measure, durationOf, parse, ParseError } from './parser';

function isInteger(value: number): boolean {
    return Math.floor(value) === value;
}

class Context {
    accumulate = 0;
    spacing = false;
    width = 0;

    resetSpacing() {
        this.accumulate = 0;
        this.spacing = false;
    }

    shouldAddSpacing(currentLength: number): boolean {
        const spacing = this.spacing;
        this.spacing = false;
        return spacing || isInteger(this.accumulate) || isInteger(currentLength);
    }

    tieLength() {
        return this.width + (this.accumulate == 0 ? 1 : 0)
    }
}

function renderNote(context: Context, durableNote: DurableNote): JSX.Element {
    let { accidental = null, note = '', octave = 0, dashes = 0, halves = 0, dots = 0, tie = false, type } = durableNote;
    switch (type) {
        case 'rest':
            note = '0';
            break;
        case 'drum':
            note = 'X';
            break;
    }
    const elements: JSX.Element[] = [];
    const currentLength = durationOf(durableNote);
    if (context.shouldAddSpacing(currentLength)) {
        elements.push(<> </>);
    }
    if (accidental !== null) {
        const accidentalMap = {
            [2]: "𝄪",
            [1]: "♯",
            [0]: "♮",
            [-1]: "♭",
            [-2]: "𝄫",
        }
        elements.push(<><span className="accidental">{accidentalMap[accidental]}</span> </>);
    }
    elements.push(<>{note}</>)
    for (let i = 0; i < octave; i++) {
        elements.push(<span className={`up${i + 1} high`}>•</span>);
    }
    for (let i = 0; i < halves; i++) {
        elements.push(<span className={`half${i + 1}`}>_</span>);
    }
    for (let i = 0; i < -octave; i++) {
        elements.push(<span className={`low${i + 1 + halves}`}>•</span>);
    }
    if (tie) {
        const high = Math.max(octave, 0);
        elements.push(<span className={`up${high + 1}`}><span className={`arch${context.tieLength()}`}>⁀</span></span>);
    }
    for (let i = 0; i < dots; i++) {
        elements.push(<><span className="dot">•</span> </>);
    }
    for (let i = 0; i < dashes; i++) {
        elements.push(<span className="hyphen">&nbsp;–</span>);
    }
    if (isInteger(currentLength)) context.spacing = true;
    context.accumulate += currentLength;
    if (dashes > 0) {
        context.width = 1 + dashes;
    } else {
        context.width = 1 + dots;
    }
    return <>{...elements}</>;
}

function selectBar(last_bar: boolean, last_measure: boolean, last_line: boolean): string {
    if (last_measure && last_line) {
        return '𝄂';
    }
    if (!last_measure || last_bar) {
        return '𝄀';
    }
    return '';
}

function renderBar(bar: string): JSX.Element {
    return <> <span className="separator">{bar}</span></>;
}

function renderMeasure(context: Context, measure: Measure, bar: string): JSX.Element {
    context.resetSpacing();
    return <>{...measure.map(note => renderNote(context, note))}{renderBar(bar)}</>;
}

export function compile(source: string): JSX.Element {
    const context = new Context();
    const score = parse(source);
    if (score instanceof ParseError) {
        return <>{JSON.stringify(score)}</>;
    }
    return <div className="notes">{
        score.map((line, lineno) => <>{...line.measures.map((measure, measureno) => 
            renderMeasure(context, measure, selectBar(line.last_bar, measureno === line.measures.length - 1, lineno === score.length - 1)))}<br/></>)
    }</div>
}