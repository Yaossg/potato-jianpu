import { ParsedNote, ParsedScoreLine, TimeSignature, Accidental, ParsedScore, PitchNote } from "@/parser";
import { exclusiveScan, inclusiveScan } from "@/util";
import { JSX } from "react";

// Constants for layout
const DIMENSIONS = {
  baseNoteWidth: 24,
  baseNoteHeight: 24,
  leftPadding: 18,
  measureSpacing: 0, // RESERVED FOR FUTURE USE
  accidentalOffset: 10,
  tieHeight: 16,
  tieCurveHeight: 13,
  tiePadding: 24,
  octaveSpacing: 5,
  noteBottomPadding: 10,
  underlineSpacing: 5,
  dotSpacing: 12,
  dashSpacing: 24,
  lineSpacing: 10,
  octaveDotVerticalOffset: 22,
  octaveDotBelowOffset: 5,
  accidentalVerticalOffset: 8,
  tieYOffsetThreshold: 2,
  underlineXStart: -10,
  underlineXEndOffset: 14,
  dotXOffset: 12,
  dashXOffset: 12,
};

// SVG CSS styles
const svgStyles = `
  .jianpu-underline {
    stroke: currentColor;
    stroke-width: 2.5;
  }
  
  .jianpu-dot {
    fill: currentColor;
  }
  
  .jianpu-dash {
    stroke: currentColor;
    stroke-width: 3;
  }
  
  .jianpu-tie {
    fill: currentColor;
    stroke: currentColor;
    stroke-width: 1;
  }
  
  .jianpu-note-text {
    font-family: Helvetica;
    font-size: 24px;
    font-weight: bold;
    text-anchor: middle;
    fill: currentColor;
    cursor: pointer;
  }

  .jianpu-note-text:hover {
    fill: #3366CC;
  }
  
  .jianpu-note-text-bg {
    font-family: Helvetica;
    font-size: 24px;
    font-weight: bold;
    text-anchor: middle;
    stroke: #FFCC66;
    stroke-width: 0.1em;
  }
  
  .jianpu-accidental-text {
    font-family: Helvetica;
    font-size: 14px;
    font-weight: bold;
    text-anchor: middle;
    fill: currentColor;
  }
  
  .jianpu-bar-text {
    font-family: Helvetica;
    font-size: 48px;
    font-weight: bold;
    text-anchor: middle;
    fill: currentColor;
  }
`;

// SVG definitions for reusable elements
const Defs = () => (
  <defs>
    <style>{svgStyles}</style>
    {/* Octave dot template (above or below) */}
    <circle
      id="octave-dot-template"
      cx="0"
      cy="0"
      r="2"
      className="jianpu-dot"
    />

    {/* Duration dot template */}
    <circle
      id="duration-dot-template"
      cx="0"
      cy="-9"
      r="3"
      className="jianpu-dot"
    />

    {/* Dash template (for extended duration) */}
    <line
      id="dash-template"
      x1="2"
      y1="-9"
      x2="18"
      y2="-9"
      className="jianpu-dash"
    />
  </defs>
);

const accidentalMap = {
  [2]: "𝄪",  // double sharp
  [1]: "♯",  // sharp
  [0]: "♮",  // natural
  [-1]: "♭", // flat
  [-2]: "𝄫", // double flat
};

interface MeasureDimensions {
  width: number;
  notePositions: number[];
  paddingUp: number;
  paddingDown: number;
}

/**
 * Calculate the width of a note in relative units
 */
function widthOf({ dashes, dots, chord }: ParsedNote): number {
  let width = DIMENSIONS.baseNoteWidth;
  width += dashes * DIMENSIONS.dashSpacing;
  width += dots * DIMENSIONS.dotSpacing;
  width += chord ? Math.max(...chord.map(note => getAccidentalOffset(note.accidental))) : 0;
  return width;
}

/**
 * Calculate the padding needed above a note
 */
function paddingUpOf({ chord, tie, tieAfter }: ParsedNote): number {
  let height = DIMENSIONS.baseNoteHeight;
  if (chord) {
    height += chord[chord.length - 1].octave > 0 ? chord[chord.length - 1].octave * DIMENSIONS.octaveSpacing : 0;
    for (const note of chord.slice(0, -1)) {
      height += DIMENSIONS.baseNoteHeight;
      height += Math.abs(note.octave) * DIMENSIONS.octaveSpacing;
    }
  }
  height += tie || tieAfter ? DIMENSIONS.tieHeight : 0;
  return height;
}

/**
 * Calculate the padding needed below a note
 */
function paddingDownOf({ chord, halves }: ParsedNote): number {
  let height = 0;
  height += chord && (chord[chord.length - 1].octave < 0) ? -chord[chord.length - 1].octave * DIMENSIONS.octaveSpacing : 0;
  height += halves * DIMENSIONS.underlineSpacing;
  return height;
}

/**
 * Calculate the horizontal offset for an accidental
 */
function getAccidentalOffset(accidental: Accidental | undefined): number {
  return accidental !== null && accidental !== undefined ? DIMENSIONS.accidentalOffset : 0;
}

/**
 * Get the accidental symbol for a given accidental
 */
function getAccidentalSymbol(accidental: Accidental | undefined): string | null {
  return accidental !== null && accidental !== undefined ? accidentalMap[accidental] : null;
}

/**
 * Get the maximum accidental offset for a parsed note
 */
function getMaxAccidentalOffset(chord: PitchNote[] | undefined): number {
  if (!chord || chord.length === 0) return 0;
  return Math.max(...chord.map(pitchNote => getAccidentalOffset(pitchNote.accidental)));
}

/**
 * Create a tie path between two points
 */
function createTiePath(startX: number, endX: number): string {
  const midX = (startX + endX) / 2;
  return `M${startX},0 Q${midX},-${DIMENSIONS.tieHeight} ${endX},0 Q${midX},-${DIMENSIONS.tieCurveHeight} ${startX},0 Z`;
}

/**
 * Calculate the y-offset for a tie based on chord height
 */
function calculateTieYOffset(chordHeight: number): number {
  return chordHeight > DIMENSIONS.baseNoteHeight ? -(chordHeight - DIMENSIONS.baseNoteHeight) - 2 : 0;
}

/**
 * Calculate the cumulative x-offset for a measure
 */
function calculateMeasureXOffset(measureDimensions: MeasureDimensions[], measureIndex: number): number {
  return measureDimensions
    .slice(0, measureIndex)
    .reduce((sum, dim) => sum + dim.width + DIMENSIONS.measureSpacing, 0);
}

interface NotePosition {
  note: PitchNote;
  yPos: number;
  accidentalOffset: number;
  isBaseNote: boolean;
}

/**
 * Calculate vertical positions for all notes in a chord
 */
function calculateNotePositions(chord: PitchNote[]): NotePosition[] {
  let currentY = 0;
  const notePositions: NotePosition[] = [];
  const accidentalOffset = getMaxAccidentalOffset(chord);
  
  // Process notes from bottom to top (reverse order since we stack upward)
  for (let chordIndex = chord.length - 1; chordIndex >= 0; chordIndex--) {
    const pitchNote = chord[chordIndex];
    const { octave, accidental } = pitchNote;
    const isBaseNote = chordIndex === chord.length - 1; // First note in the chord array (base note)

    // For non-base notes, add space for lower octave dots
    if (!isBaseNote && octave < 0) {
      currentY -= Math.abs(octave) * DIMENSIONS.octaveSpacing;
    }
    
    // Position for the note itself
    const noteY = currentY;
    notePositions.unshift({ note: pitchNote, yPos: noteY, accidentalOffset, isBaseNote });
    
    // Add space for the note
    currentY -= DIMENSIONS.baseNoteHeight;
    
    // Add space for upper octave dots
    if (octave > 0) {
      currentY -= octave * DIMENSIONS.octaveSpacing;
    }
  }
  
  return notePositions;
}

/**
 * Render octave dots for a note
 */
function renderOctaveDots(
  octave: number, 
  yPos: number, 
  accidentalOffset: number, 
  isBaseNote: boolean, 
  index: number
): JSX.Element[] {
  const dots: JSX.Element[] = [];

  // Above octave dots
  if (octave > 0) {
    for (let i = 0; i < octave; i++) {
      dots.push(
        <use
          key={`octave-above-${index}-${i}`}
          href="#octave-dot-template"
          transform={`translate(${accidentalOffset}, ${yPos - DIMENSIONS.octaveDotVerticalOffset - i * DIMENSIONS.octaveSpacing})`}
        />
      );
    }
  }

  // Below octave dots (only for non-base notes)
  if (!isBaseNote && octave < 0) {
    for (let i = 0; i < Math.abs(octave); i++) {
      dots.push(
        <use
          key={`octave-below-${index}-${i}`}
          href="#octave-dot-template"
          transform={`translate(${accidentalOffset}, ${yPos + DIMENSIONS.octaveDotBelowOffset + i * DIMENSIONS.octaveSpacing})`}
        />
      );
    }
  }

  return dots;
}

/**
 * Render a single note in a chord with its octave dots
 */
function renderChordNote(
  position: NotePosition, 
  index: number, 
  noteObj: ParsedNote,
  onClick?: (note: ParsedNote) => void,
  playingNote?: number
): JSX.Element {
  const { note: pitchNote, yPos, accidentalOffset, isBaseNote } = position;
  const { note, octave, accidental } = pitchNote;
  const { indexOfScore } = noteObj;
  const accidentalSymbol = getAccidentalSymbol(accidental);

  return (
    <g key={`chord-note-${index}`}>
      {/* Draw accidental if present */}
      {accidentalSymbol && (
        <text
          x="0"
          y={yPos - DIMENSIONS.accidentalVerticalOffset}
          className="jianpu-accidental-text"
        >
          {accidentalSymbol}
        </text>
      )}

      {/* Draw the note number */}
      {playingNote === indexOfScore && (
        <text
          className="jianpu-note-text-bg"
          x={accidentalOffset}
          y={yPos}
        >
          {note}
        </text>
      )}
      <text
        className="jianpu-note-text"
        x={accidentalOffset}
        y={yPos}
        onClick={onClick && (() => onClick(noteObj))}
      >
        {note}
      </text>

      {/* Draw octave dots */}
      {renderOctaveDots(octave, yPos, accidentalOffset, isBaseNote, index)}
    </g>
  );
}

/**
 * Render base note's lower octave dots below underlines
 */
function renderBaseNoteLowerOctaveDots(baseNote: PitchNote, halves: number): JSX.Element[] {
  if (baseNote.octave >= 0) return [];

  const dots: JSX.Element[] = [];
  for (let i = 0; i < Math.abs(baseNote.octave); i++) {
    dots.push(
      <use
        key={`base-note-octave-below-${i}`}
        href="#octave-dot-template"
        transform={`translate(${getAccidentalOffset(baseNote.accidental)}, ${DIMENSIONS.octaveDotBelowOffset + (i + halves) * DIMENSIONS.octaveSpacing})`}
      />
    );
  }
  return dots;
}

/**
 * Render duration elements (underlines, dots, dashes)
 */
function renderDurationElements(
  halves: number, 
  dots: number, 
  dashes: number, 
  full: boolean, 
  maxAccidentalOffset: number
): JSX.Element[] {
  const elements: JSX.Element[] = [];

  // Draw underlines (for shorter notes)
  for (let i = 0; i < halves; i++) {
    elements.push(
      <line
        key={`underline-${i}`}
        x1={DIMENSIONS.underlineXStart}
        y1="0"
        x2={`${(full ? 10 : DIMENSIONS.underlineXEndOffset + dots * DIMENSIONS.dotSpacing) + maxAccidentalOffset}`}
        y2="0"
        className="jianpu-underline"
        transform={`translate(0, ${DIMENSIONS.octaveDotBelowOffset + i * DIMENSIONS.underlineSpacing})`}
      />
    );
  }

  // Draw dots (for extended duration)
  for (let i = 0; i < dots; i++) {
    elements.push(
      <use
        key={`dot-${i}`}
        href="#duration-dot-template"
        transform={`translate(${DIMENSIONS.dotXOffset + i * DIMENSIONS.dotSpacing + maxAccidentalOffset}, 0)`}
      />
    );
  }

  // Draw dashes (for extended duration)
  for (let i = 0; i < dashes; i++) {
    elements.push(
      <use
        key={`dash-${i}`}
        href="#dash-template"
        transform={`translate(${DIMENSIONS.dashXOffset + i * DIMENSIONS.dashSpacing + maxAccidentalOffset}, 0)`}
      />
    );
  }

  return elements;
}

interface RestOrDrumNoteProps {
  noteObj: ParsedNote;
  full: boolean;
  onClick?: (note: ParsedNote) => void;
  playingNote?: number;
}

/**
 * Component for rendering rest and drum notes
 */
const RestOrDrumNote = ({ noteObj, full, onClick, playingNote }: RestOrDrumNoteProps) => {
  const { type, dashes = 0, halves = 0, dots = 0, indexOfScore } = noteObj;
  const text = type === 'rest' ? '0' : 'X';

  return (
    <g>
      {/* Draw the rest/drum symbol */}
      {playingNote === indexOfScore && (
        <text className="jianpu-note-text-bg" x="0">
          {text}
        </text>
      )}
      <text
        className="jianpu-note-text"
        x="0"
        onClick={onClick && (() => onClick(noteObj))}
      >
        {text}
      </text>

      {/* Draw underlines (for shorter notes) */}
      {[...Array(halves)].map((_, i) => (
        <line
          key={`underline-${i}`}
          x1="-10"
          y1="0"
          x2={`${full ? 10 : 14 + dots * DIMENSIONS.dotSpacing}`}
          y2="0"
          className="jianpu-underline"
          transform={`translate(0, ${5 + i * DIMENSIONS.underlineSpacing})`}
        />
      ))}

      {/* Draw dots (for extended duration) */}
      {[...Array(dots)].map((_, i) => (
        <use
          key={`dot-${i}`}
          href="#duration-dot-template"
          transform={`translate(${12 + i * DIMENSIONS.dotSpacing}, 0)`}
        />
      ))}

      {/* Draw dashes (for extended duration) */}
      {[...Array(dashes)].map((_, i) => (
        <use
          key={`dash-${i}`}
          href="#dash-template"
          transform={`translate(${12 + i * DIMENSIONS.dashSpacing}, 0)`}
        />
      ))}
    </g>
  );
};

interface PitchNoteSvgProps {
  noteObj: ParsedNote;
  full: boolean;
  onClick?: (note: ParsedNote) => void;
  playingNote?: number;
}

/**
 * Component for rendering pitch notes (single notes or chords)
 */
const PitchNoteSvg = ({ noteObj, full, onClick, playingNote }: PitchNoteSvgProps) => {
  const { chord, dashes = 0, halves = 0, dots = 0 } = noteObj;
  
  if (!chord || chord.length === 0) {
    return null; // Invalid pitch note
  }

  const maxAccidentalOffset = Math.max(...chord.map(note => getAccidentalOffset(note.accidental)));
  const notePositions = calculateNotePositions(chord);
  const baseNote = chord[chord.length - 1]; // Last note in array is the base note

  return (
    <g>
      {/* Render chord notes */}
      {notePositions.map((position: NotePosition, index: number) => 
        renderChordNote(position, index, noteObj, onClick, playingNote)
      )}

      {/* Render base note's lower octave dots */}
      {renderBaseNoteLowerOctaveDots(baseNote, halves)}

      {/* Render duration elements */}
      {renderDurationElements(halves, dots, dashes, full, maxAccidentalOffset)}
    </g>
  );
};

interface TieComponentProp {
  startX: number,
  endX: number,
  maxPaddingUp: number,
  chordHeight: number
}

const TieComponent = ({
  startX,
  endX,
  maxPaddingUp,
  chordHeight
}: TieComponentProp) => {
  const tieWidth = endX - startX;
  if (tieWidth <= 0) {
    console.log("Internal Error: attempt to create reversed tie")
    return null;
  }

  const yOffset = calculateTieYOffset(chordHeight);

  return (
    <path
      d={createTiePath(startX, endX)}
      className="jianpu-tie"
      transform={`translate(0, ${maxPaddingUp - DIMENSIONS.tiePadding + yOffset})`}
    />
  );
};

interface NoteComponentProp {
  noteObj: ParsedNote;
  full: boolean;
  onClick?: (note: ParsedNote) => void;
  playingNote?: number;
}

const NoteComponent = ({ noteObj, full, onClick, playingNote }: NoteComponentProp) => {
  const { type } = noteObj;
  
  if (type === 'rest' || type === 'drum') {
    return <RestOrDrumNote noteObj={noteObj} full={full} onClick={onClick} playingNote={playingNote} />;
  }

  return <PitchNoteSvg noteObj={noteObj} full={full} onClick={onClick} playingNote={playingNote} />;
};

/**
 * Calculate dimensions for all measures
 */
function calculateMeasureDimensions(measures: ParsedScoreLine): MeasureDimensions[] {
  return measures.map(({ notes }) => {
    let totalWidth = 0;
    let notePositions: number[] = [];
    let paddingUp = 0;
    let paddingDown = 0;

    notes.forEach((noteObj) => {
      notePositions.push(totalWidth);
      totalWidth += widthOf(noteObj);
      paddingUp = Math.max(paddingUp, paddingUpOf(noteObj));
      paddingDown = Math.max(paddingDown, paddingDownOf(noteObj));
    });

    return {
      width: totalWidth + DIMENSIONS.leftPadding + 4,
      notePositions,
      paddingUp,
      paddingDown
    };
  });
}

/**
 * Calculate the actual height of a chord based on vertical stacking
 */
function calculateChordHeight(note: ParsedNote): number {
  if (!note.chord || note.chord.length === 0) return 0;
  
  let totalHeight = 0;
  
  // Process notes from bottom to top to calculate total height
  for (let chordIndex = note.chord.length - 1; chordIndex >= 0; chordIndex--) {
    const pitchNote = note.chord[chordIndex];
    const { octave } = pitchNote;
    const isBaseNote = chordIndex === note.chord.length - 1;
    
    // For non-base notes, add space for lower octave dots
    if (!isBaseNote && octave < 0) {
      totalHeight += Math.abs(octave) * DIMENSIONS.octaveSpacing;
    }
    
    // Add space for the note itself
    totalHeight += DIMENSIONS.baseNoteHeight;
    
    // Add space for upper octave dots
    if (octave > 0) {
      totalHeight += octave * DIMENSIONS.octaveSpacing;
    }
  }
  
  return totalHeight;
}

/**
 * Calculate the maximum chord height between two notes for tie positioning
 */
function maxChordHeight(note1: ParsedNote, note2: ParsedNote): number {
  const height1 = calculateChordHeight(note1);
  const height2 = calculateChordHeight(note2);
  return Math.max(height1, height2);
}

/**
 * Render cross-measure ties
 */
const InlineCrossMeasureTie = ({
  measures,
  measureDimensions,
  maxPaddingUp
}: {
  measures: ParsedScoreLine,
  measureDimensions: MeasureDimensions[],
  maxPaddingUp: number
}) => {
  return (
    <>
      {measures.map(({ notes }, measureIndex) => {
        if (measureIndex === 0) return null; // Skip first measure

        const dim = measureDimensions[measureIndex];

        const firstNote = notes[0];
        if (firstNote?.tie) {
          const prevMeasure = measures[measureIndex - 1].notes;
          if (prevMeasure.length > 0) {
            const prevXOffset = calculateMeasureXOffset(measureDimensions, measureIndex - 1);
            const currentXOffset = calculateMeasureXOffset(measureDimensions, measureIndex);

            const prevX = measureDimensions[measureIndex - 1].notePositions[prevMeasure.length - 1] + DIMENSIONS.leftPadding;
            const currentX = dim.notePositions[0] + DIMENSIONS.leftPadding;

            const prevNote = prevMeasure[prevMeasure.length - 1];
            const prevAccidentalOffset = getMaxAccidentalOffset(prevNote.chord);
            const currentAccidentalOffset = getMaxAccidentalOffset(firstNote.chord);

            // Calculate tie points in the global coordinate system
            const tieStartX = prevXOffset + prevX + prevAccidentalOffset;
            const tieEndX = currentXOffset + currentX + currentAccidentalOffset;

            const chordHeight = maxChordHeight(prevNote, firstNote);

            return (
              <TieComponent
                key={`tie-cross-${measureIndex}`}
                startX={tieStartX}
                endX={tieEndX}
                maxPaddingUp={maxPaddingUp}
                chordHeight={chordHeight}
              />
            );
          }
        }
        return null;
      })}
    </>
  );
};

interface TieContext {
  measures: ParsedScoreLine;
  measureIndex: number;
  notes: ParsedNote[];
  noteIndex: number;
  noteObj: ParsedNote;
  dim: MeasureDimensions;
  maxPaddingUp: number;
}

const LocalTie = ({ context }: { context: TieContext }) => {
  const { notes, noteIndex, noteObj, dim, maxPaddingUp } = context;
  if (noteIndex > 0 && noteObj.tie) {
    const prevX = dim.notePositions[noteIndex - 1] + DIMENSIONS.leftPadding;
    const currentX = dim.notePositions[noteIndex] + DIMENSIONS.leftPadding;

    const prevNote = notes[noteIndex - 1];
    const prevAccidentalOffset = getMaxAccidentalOffset(prevNote.chord);
    const currentAccidentalOffset = getMaxAccidentalOffset(noteObj.chord);

    const tieStartX = prevX + prevAccidentalOffset;
    const tieEndX = currentX + currentAccidentalOffset;

    const chordHeight = maxChordHeight(prevNote, noteObj);

    return (
      <TieComponent
        key={`tie-${noteObj.indexOfScore}`}
        startX={tieStartX}
        endX={tieEndX}
        maxPaddingUp={maxPaddingUp}
        chordHeight={chordHeight}
      />
    );
  }
  return null;
}

const CrossLineLeftTie = ({ context }: { context: TieContext }) => {
  const { measures, measureIndex, notes, noteIndex, noteObj, dim, maxPaddingUp } = context;
  if (measureIndex === measures.length - 1 && noteIndex === notes.length - 1 && noteObj.tieAfter) {
    const currentX = dim.notePositions[noteIndex] + DIMENSIONS.leftPadding;
    const currentAccidentalOffset = getMaxAccidentalOffset(noteObj.chord);
    const tieStartX = currentX + currentAccidentalOffset;
    const tieEndX = tieStartX + widthOf(noteObj) * 2;

    const chordHeight = maxChordHeight(noteObj, noteObj);

    return (
      <TieComponent
        key={`tie-cross-left-${noteIndex}`}
        startX={tieStartX}
        endX={tieEndX}
        maxPaddingUp={maxPaddingUp}
        chordHeight={chordHeight}
      />
    );
  }
  return null;
}

const CrossLineRightTie = ({ context }: { context: TieContext }) => {
  const { measureIndex, noteIndex, noteObj, dim, maxPaddingUp } = context;
  if (measureIndex === 0 && noteIndex === 0 && noteObj.tie) {
    const currentX = dim.notePositions[noteIndex] + DIMENSIONS.leftPadding;
    const currentAccidentalOffset = getMaxAccidentalOffset(noteObj.chord);
    const tieEndX = currentX + currentAccidentalOffset;
    const tieStartX = tieEndX - DIMENSIONS.baseNoteWidth * 2;

    const chordHeight = maxChordHeight(noteObj, noteObj);

    return (
      <TieComponent
        key={`tie-cross-right-${noteIndex}`}
        startX={tieStartX}
        endX={tieEndX}
        maxPaddingUp={maxPaddingUp}
        chordHeight={chordHeight}
      />
    );
  }
  return null;
}

interface ScoreLineSvgProp {
  measures: ParsedScoreLine;
  timeSignature: TimeSignature;
  onNoteClick?: (note: ParsedNote) => void
  playingNote?: number
}

const ScoreLineSvg = ({ measures, timeSignature, onNoteClick, playingNote }: ScoreLineSvgProp) => {
  // Calculate dimensions for all measures
  const measureDimensions = calculateMeasureDimensions(measures);

  // Calculate total width and unified height
  const totalWidth = measureDimensions.reduce(
    (sum, dim) => sum + dim.width + DIMENSIONS.measureSpacing, 0
  ) - DIMENSIONS.measureSpacing;

  const maxPaddingUp = Math.max(...measureDimensions.map(dim => dim.paddingUp));
  const maxPaddingDown = Math.max(...measureDimensions.map(dim => dim.paddingDown));
  const unifiedHeight = maxPaddingUp + maxPaddingDown + DIMENSIONS.noteBottomPadding;

  return (
    <svg width={totalWidth} height={unifiedHeight} xmlns="http://www.w3.org/2000/svg">
      <Defs />

      {/* Render ties across measures */}
      <InlineCrossMeasureTie
        measures={measures}
        measureDimensions={measureDimensions}
        maxPaddingUp={maxPaddingUp}
      />

      {/* Render measures */}
      {measures.map(({ notes, bar }, measureIndex) => {
        const dim = measureDimensions[measureIndex];
        const xOffset = calculateMeasureXOffset(measureDimensions, measureIndex);
        const unit = timeSignature.actualNotePerBeat();
        const fullness = inclusiveScan(notes.map(note => note.duration)).map(d => d % unit == 0);

        return (
          <g key={measureIndex} transform={`translate(${xOffset}, 0)`}>
            {/* Render ties within measure */}
            {notes.map((noteObj, index) => {
              const context: TieContext = {
                measures,
                measureIndex,
                notes,
                noteIndex: index,
                noteObj,
                dim,
                maxPaddingUp
              }
              return (
                <g key={`tie-${measureIndex}-${index}`}>
                  <LocalTie key={`local-tie-${measureIndex}-${index}`} context={context} />
                  <CrossLineLeftTie key={`cross-line-left-${measureIndex}-${index}`} context={context} />
                  <CrossLineRightTie key={`cross-line-right-${measureIndex}-${index}`} context={context} />
                </g>
              );
            })}

            {/* Render notes */}
            {notes.map((noteObj, index) => {
              return (
                <g
                  key={`note-${measureIndex}-${index}`}
                  transform={`translate(${dim.notePositions[index] + DIMENSIONS.leftPadding}, ${maxPaddingUp})`}
                >
                  <NoteComponent noteObj={noteObj} full={fullness[index]} onClick={onNoteClick} playingNote={playingNote} />
                </g>
              );
            })}

            {/* Render bar */}
            {bar && <text
              className="jianpu-bar-text"
              x={dim.width - DIMENSIONS.leftPadding + 12}
              y={maxPaddingUp + DIMENSIONS.noteBottomPadding}
            >
              {bar}
            </text>}
          </g>
        );
      })}
    </svg>
  );
};

interface ScoreSvgProp {
  score: ParsedScore;
  timeSignature: TimeSignature;
  onNoteClick?: (note: ParsedNote) => void;
  playingNote?: number;
}

export function renderScore({ score, timeSignature, onNoteClick, playingNote }: ScoreSvgProp): JSX.Element {
  const lines = score.map(measures => ScoreLineSvg({
    measures,
    timeSignature,
    onNoteClick,
    playingNote
  }))
  const heights = exclusiveScan(lines.map(line => line.props.height + DIMENSIONS.lineSpacing))
  return (
    <svg xmlns="http://www.w3.org/2000/svg"
      width={Math.max(0, ...lines.map(line => line.props.width))}
      height={lines.reduce((totalHeight, line) => totalHeight + line.props.height + DIMENSIONS.lineSpacing, 0)}>
      {lines.map((line, index) => (
        <g key={index} transform={`translate(0, ${heights[index]})`}>
          {line}
        </g>
      ))}
    </svg>
  );
};