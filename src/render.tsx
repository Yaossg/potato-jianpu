import { JSX } from 'react';
import './render.css';
import { DurableNote, Measure, noteLength, parse, ParseError } from './parser';

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
    let { accidental = null, note = '', octave = 0, hyphens = 0, halves = 0, dots = 0, tie = false, rest = false, nopitch = false } = durableNote;
    if (rest) {
        note = '0';
    } else if (nopitch) {
        note = 'X';
    }
    const elements: JSX.Element[] = [];
    const currentLength = noteLength(durableNote);
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
        elements.push(<><span className="accidental">{accidentalMap[accidental as keyof typeof accidentalMap]}</span> </>);
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
    for (let i = 0; i < hyphens; i++) {
        elements.push(<span className="hyphen">&nbsp;–</span>);
    }
    if (isInteger(currentLength)) context.spacing = true;
    context.accumulate += currentLength;
    if (hyphens > 0) {
        context.width = 1 + hyphens;
    } else {
        context.width = 1 + dots;
    }
    return <>{...elements}</>;
}

function renderMeasure(context: Context, measure: Measure): JSX.Element {
    context.resetSpacing();
    return <>{...measure.map(note => renderNote(context, note))}</>;
}

function renderBar(last: boolean): JSX.Element {
    return <> <span className="separator">{last ? '𝄂' : '𝄀'}</span></>;
}

export function compile(source: string): JSX.Element {
    const context = new Context();
    const measures = parse(source);
    if (measures instanceof ParseError) {
        return <>{JSON.stringify(measures)}</>;
    }
    const last = measures.length - 1;
    return <div className="notes">{...measures.map(
        (measure, index) => <>{renderMeasure(context, measure)}{renderBar(index === last)}</>
    )}</div>;
}