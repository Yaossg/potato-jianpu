import { JSX } from 'react';
import { Header, KeySignature, parse, ParseError, parseKeySignature, parseTimeSignature, Score, TimeSignature } from './parser';
import './render.css';

// TODO tie across lines
import { ScoreLineSvg, selectBar } from './render_svg';

function renderKeySignature(keySignature: KeySignature | null): JSX.Element {
  if (keySignature === null) {
    return <span className="error">Invalid key signature</span>;
  }
  const key = ['C', '♯C', 'D', '♯D', 'E', 'F', '♯F', 'G', '♯G', 'A', '♯A', 'B'][keySignature];
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

function renderTempo(timeSignature: TimeSignature | null, tempo: string): JSX.Element {
  const tempoNumber = Number(tempo);
  return tempoNumber > 0 
      ? <span className="score-tempo">{timeSignature && tempoMap[timeSignature.thNotePerBeat]} = {tempoNumber}</span> 
      : <span className="error">Invalid tempo</span>;
}

export function compile(source: string): JSX.Element {
  const file = parse(source);
  if (file instanceof ParseError) {
    return <div className="error">{file.digest}</div>;
  }
  const { header, score } = file;
  const { title = '', subtitle = '', composer = '', tempo = '120', key = 'C', time = '4/4' } = header;
  const timeSignature = parseTimeSignature(time);
  const keySignature = parseKeySignature(key);
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
  const renderedScore = <div>{
    ...score.map((line, lineno) => <><ScoreLineSvg measures={
      line.measures.map((notes, measureno) => ({
        notes, bar:
          selectBar(line.last_bar, measureno === line.measures.length - 1, lineno === score.length - 1)
      }))
    } timeSignature={timeSignature ?? new TimeSignature(4, 4)} /><br /></>)
  }</div>;
  return <div> {renderedHeader} {renderedScore} </div>
}