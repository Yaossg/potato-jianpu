import { JSX } from 'react';
import { KeySignature, TimeSignature, ParsedHeader } from '@/parser';

const keyMap = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

function renderKeySignature(keySignature: KeySignature, x: number, y: number): JSX.Element {
  const key = keyMap[keySignature];
  return <g className="score-key" transform={`translate(${x}, ${y})`}>
    <text x={0} y={0} className="score-note">1</text>
    <text x={16} y={0}>=</text>
    <text x={32} y={0} className="score-note">{key}</text>
  </g>;
}

function renderTimeSignature(timeSignature: TimeSignature, x: number, y: number): JSX.Element {
  return <g className="score-time" transform={`translate(${x}, ${y - 5})`}>
    <text x={0} y={-5}>{timeSignature.beatsPerMeasure}</text>
    <line x1={-5} y1={0} x2={15} y2={0} stroke="black" strokeWidth="1" className="time-divider" />
    <text x={0} y={20}>{timeSignature.beatsPerWholeNote}</text>
  </g>;
}

const tempoMap = {
  [2]: '𝅗𝅥',
  [4]: '𝅘𝅥',
  [8]: '𝅘𝅥𝅮',
  [16]: '𝅘𝅥𝅯'
}

function renderTempo(timeSignature: TimeSignature | null, tempo: number, x: number, y: number): JSX.Element {
  return <g className="score-tempo" transform={`translate(${x}, ${y})`}>
    <text x={0} y={0}>{timeSignature && tempoMap[timeSignature.beatsPerWholeNote]} = {tempo}</text>
  </g>
}

const svgStyles = `
  .score-title { fill: currentColor; font-size: 32px; font-weight: bold; font-family: Arial, sans-serif; }
  .score-subtitle { fill: currentColor; font-size: 20px; font-family: Arial, sans-serif; }
  .score-composer { fill: currentColor; font-size: 20px; font-family: Arial, sans-serif; }
  .score-note { fill: currentColor; font-size: 20px; font-weight: bold; font-family: Helvetica, sans-serif; }
  .score-metadata { fill: currentColor; font-size: 20px; font-family: Arial, sans-serif; }
`

export function renderHeader(pageWidth: number, { title, subtitle, composer, tempo, keySignature, timeSignature }: ParsedHeader): JSX.Element {
  const titleY = title ? 40 : 0;
  const subtitleY = subtitle ? (titleY + 32) : titleY;
  const metadataY = subtitleY + 40;
  const height = metadataY + 40;
  return <svg width={pageWidth} height={height} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        {svgStyles}
      </style>
    </defs>
    {title && <text x={pageWidth / 2} y={titleY} className="score-title" textAnchor="middle">{title}</text>}
    {subtitle && <text x={pageWidth / 2} y={subtitleY} className="score-subtitle" textAnchor="middle">{subtitle}</text>}
    <g className="score-metadata" transform={`translate(0, ${metadataY})`}>
      <g className="score-details">
        {renderKeySignature(keySignature, 10, 0)}
        {renderTimeSignature(timeSignature, 72 + 16 * keyMap[keySignature].length, 0)}
        {renderTempo(timeSignature, tempo, 116 + 16 * keyMap[keySignature].length, 0)}
      </g>
      {composer && <text x={pageWidth - 50} y={0} className="score-composer" textAnchor="end">{composer}</text>}
    </g>
  </svg>;
}
