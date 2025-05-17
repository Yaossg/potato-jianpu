function tokenize(source: string): string[] {
    const tokens: string[] = [];
    let token = '';
    const flush = () => {
        if (token) {
            tokens.push(token);
            token = '';
        }
    };
    outer: for (let i = 0; i < source.length; i++) {
        let ch = source.charAt(i);
        if (ch === ' ') {
            continue;
        } else if (ch === '\n') {
            tokens.push('\n');
        } else if ('0' <= ch && ch <= '7' || ch === '~') {
            if (token === '~') {
                token += ch;
            } else {
                flush();
                if (ch === '~' && tokens.length === 0) {
                    tokens.push(ch);
                } else {
                    token = ch;
                }
            }
        } else {
            const tail = source.substring(i);
            for (const symbol of ["||", ":|", "|:", "|"]) {
                if (tail.startsWith(symbol)) {
                    flush();
                    tokens.push(symbol);
                    i += symbol.length - 1;
                    continue outer;
                }
            }
            token += ch;
        }
    }
    flush();
    return tokens;
}

class DecoratedNote {
    note: number;
    high: number;
    low: number;
    length: number;
    halves: number;
    dots: number;
    tie: boolean;

    constructor(note: number, high: number, low: number, length: number, halves: number, dots: number, tie: boolean) {
        this.note = note;
        this.high = high;
        this.low = low;
        this.length = length;
        this.halves = halves;
        this.dots = dots;
        this.tie = tie;
    }

    getNoteLength(): number {
        if (this.length > 0) {
            return 1 + this.length;
        } else {
            let one = 1;
            let dot = 1/2;
            for (let i = 0; i < this.dots; i++) {
                one += dot;
                dot /= 2;
            }
            return one / (2 ** this.halves);
        }
    }
}

function parse(token: string): DecoratedNote | null {
    const tie = token.charAt(0) === '~';
    if (tie) {
        token = token.substring(1);
    }
    const note = parseInt(token, 10);
    if (isNaN(note) || note < 0 || note > 7) {
        return null;
    }
    let high = 0;
    let low = 0;
    let length = 0;
    let halves = 0;
    let dots = 0;
    for (let i = 1; i < token.length; i++) {
        const ch = token.charAt(i);
        if (ch === '-') {
            length++;
        } else if (ch === '/') {
            halves++;
        } else if (ch === '.') {
            dots++;
        } else if (ch === '\'') {
            high++;
        } else if (ch === ',') {
            low++;
        } else {
            return null;
        }
    }
    if (high > 0 && low > 0) {
        return null;
    }
    if (length > 0) {
        if (halves > 0 || dots > 0) {
            return null;
        }
    }
    return new DecoratedNote(note, high, low, length, halves, dots, tie);
}

export { tokenize, parse, DecoratedNote };