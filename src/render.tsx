import { JSX } from 'react';
import './render.css';
import { tokenize, parse } from './parser';

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

function invalid(note: string): JSX.Element {
    return <span className="invalid">{note}</span>;
}

function separator(symbol: string): JSX.Element {
    return <> <span className="border">{symbol}</span></>;
}

function render(context: Context, token: string): JSX.Element {
    const separatorMap = {
        '|': '𝄀',
        '||': '𝄂',
        ':|': '𝄇',
        '|:': '𝄆',
    }
    if (token in separatorMap) {
        context.resetSpacing();
        return separator(separatorMap[token as keyof typeof separatorMap]);
    }
    if (token === '\n') {
        context.resetSpacing();
        return <br/>;
    }
    const result = parse(token);
    if (result === null) {
        return invalid(token);
    }
    const { note, high, low, length, halves, dots, tie } = result;
    const modifiers: JSX.Element[] = [];
    for (let i = 0; i < high; i++) {
        modifiers.push(<span className={`up${i + 1} high`}>•</span>);
    }
    for (let i = 0; i < halves; i++) {
        modifiers.push(<span className={`half${i + 1}`}>_</span>);
    }
    for (let i = 0; i < low; i++) {
        modifiers.push(<span className={`low${i + 1 + halves}`}>•</span>);
    }
    if (tie) {
        modifiers.push(<span className={`up${high + 1}`}><span className={`arch${context.tieLength()}`}>⁀</span></span>);
    }
    for (let i = 0; i < dots; i++) {
        modifiers.push(<><span className="dot">•</span> </>);
    }
    for (let i = 0; i < length; i++) {
        modifiers.push(<span className="hyphen">&nbsp;–</span>);
    }
    const currentLength = result.getNoteLength();
    const rendered = context.shouldAddSpacing(currentLength) ? (<> {note}{...modifiers}</>) : (<>{note}{...modifiers}</>);
    if (isInteger(currentLength)) context.spacing = true;
    context.accumulate += currentLength;
    if (length > 0) {
        context.width = 1 + length;
    } else {
        context.width = 1 + dots;
    }
    return rendered;
}

export function compile(source: string): JSX.Element {
    const tokens = tokenize(source);
    const context = new Context();
    return <div className="notes">{...tokens.map(token => render(context, token))}</div>;
}