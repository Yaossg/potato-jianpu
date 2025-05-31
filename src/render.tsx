import { JSX } from 'react';
import { KeySignature, TimeSignature, parse, ParseError, ParsedNote } from './parser';
import './render.css';

import { ScoreLineSvg } from './render_svg';

const keyMap = ['C', '♯C', 'D', '♯D', 'E', 'F', '♯F', 'G', '♯G', 'A', '♯A', 'B']

function renderKeySignature(keySignature: KeySignature | null): JSX.Element {
  if (keySignature === null) {
    return <span className="error">Invalid key signature</span>;
  }
  const key = keyMap[keySignature];
  return <span className="score-key"><span className="score-note">1</span> = <span className="score-note">{key}</span></span>;
}

function renderTimeSignature(timeSignature: TimeSignature | null): JSX.Element {
  if (timeSignature === null) {
    return <span className="error">Invalid time signature</span>;
  }
  return <span className="score-time">
  <div className="time-signature">
    <div className="time-numerator">{timeSignature.beatsPerMeasure}</div>
    <div className="time-divider"></div>
      <div className="time-denominator">{timeSignature.thNotePerBeat}</div>
    </div>
  </span>;
}

const tempoMap = {
  [2]: '𝅗𝅥',
  [4]: '𝅘𝅥',
  [8]: '𝅘𝅥𝅮',
  [16]: '𝅘𝅥𝅯'
}

function renderTempo(timeSignature: TimeSignature | null, tempo: number): JSX.Element {
  return <span className="score-tempo">{timeSignature && tempoMap[timeSignature.thNotePerBeat]} = {tempo}</span>
}

interface RenderedScoreProp {
  source: string;
  onNoteClick: (note: ParsedNote) => void
  playingNote: number
}

export const RenderedScore = ({ source, onNoteClick, playingNote }: RenderedScoreProp) => {
  const file = parse(source);
  if (file instanceof ParseError) {
    return <div className="error">{file.digest}</div>;
  }
  const { header, score } = file;
  const { title, subtitle, composer, tempo, keySignature, timeSignature } = header;
  const renderedHeader = <div className="score-header">
    {title && <div className="score-title">{title}</div>}
    {subtitle && <div className="score-subtitle">{subtitle}</div>}
    <div className="score-metadata">
      <div className="score-details">
        {renderKeySignature(keySignature)}
        {renderTimeSignature(timeSignature)}
        {renderTempo(timeSignature, tempo)}
      </div>
      {composer && <div className="score-composer">{composer}</div>}
    </div>
  </div>
  return <div> {renderedHeader} {...score.map(line => (<><ScoreLineSvg measures={line} timeSignature={timeSignature ?? new TimeSignature(4, 4)} onNoteClick={onNoteClick} playingNote={playingNote} /><br/></>))} </div>
}