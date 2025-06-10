import { ParsedNote, ParsedScoreLine, TimeSignature, Accidental } from "@/parser";

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
function widthOf({ dashes, dots, accidental }: ParsedNote): number {
  let width = DIMENSIONS.baseNoteWidth;
  width += dashes * DIMENSIONS.dashSpacing;
  width += dots * DIMENSIONS.dotSpacing;
  width += getAccidentalOffset(accidental);
  return width;
}

/**
 * Calculate the padding needed above a note
 */
function paddingUpOf({ octave = 0, tie, tieAfter }: ParsedNote): number {
  let height = DIMENSIONS.baseNoteHeight;
  height += (octave > 0) ? octave * DIMENSIONS.octaveSpacing : 0;
  height += tie || tieAfter ? DIMENSIONS.tieHeight : 0;
  return height;
}

/**
 * Calculate the padding needed below a note
 */
function paddingDownOf({ octave = 0, halves }: ParsedNote): number {
  let height = 0;
  height += (octave < 0) ? -octave * DIMENSIONS.octaveSpacing : 0;
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
 * Create a tie path between two points
 */
function createTiePath(startX: number, endX: number): string {
  const midX = (startX + endX) / 2;
  return `M${startX},0 Q${midX},-${DIMENSIONS.tieHeight} ${endX},0 Q${midX},-${DIMENSIONS.tieCurveHeight} ${startX},0 Z`;
}

/**
 * Calculate the y-offset for a tie based on octave
 */
function calculateTieYOffset(maxOctave: number): number {
  return maxOctave > 0 ? -maxOctave * DIMENSIONS.octaveSpacing - 2 : 0;
}

/**
 * Calculate the cumulative x-offset for a measure
 */
function calculateMeasureXOffset(measureDimensions: MeasureDimensions[], measureIndex: number): number {
  return measureDimensions
    .slice(0, measureIndex)
    .reduce((sum, dim) => sum + dim.width + DIMENSIONS.measureSpacing, 0);
}

interface TieComponentProp {
  startX: number,
  endX: number,
  maxPaddingUp: number,
  maxOctave: number
  clipPath?: string
}

const TieComponent = ({
  startX,
  endX,
  maxPaddingUp,
  maxOctave,
  clipPath
}: TieComponentProp) => {
  const tieWidth = endX - startX;
  if (tieWidth <= 0) {
    console.log("Internal Error: attempt to create reversed tie")
    return null;
  }

  const yOffset = calculateTieYOffset(maxOctave);

  return (
    <path
      d={createTiePath(startX, endX)}
      className="jianpu-tie"
      transform={`translate(0, ${maxPaddingUp - DIMENSIONS.tiePadding + yOffset})`}
      clipPath={clipPath && `url(#${clipPath})`}
    />
  );
};

interface NoteComponentProp {
  noteObj: ParsedNote,
  full: boolean,
  onClick: (note: ParsedNote) => void,
  playingNote: number
}

const NoteComponent = ({ noteObj, full, onClick, playingNote }: NoteComponentProp) => {
  let { note = '', octave = 0, dashes = 0, halves = 0, dots = 0, type, accidental } = noteObj;

  // Determine the note symbol based on type
  switch (type) {
    case 'rest':
      note = '0';
      break;
    case 'drum':
      note = 'X';
      break;
  }

  const accidentalSymbol = getAccidentalSymbol(accidental);
  const accidentalOffset = getAccidentalOffset(accidental);

  return (
    <g>
      {/* Draw accidental if present */}
      {accidentalSymbol && (
        <text
          x="0"
          y="-8"
          className="jianpu-accidental-text"
        >
          {accidentalSymbol}
        </text>
      )}

      {/* Draw the note number */}
      {playingNote === noteObj.indexOfScore ? <text
        className="jianpu-note-text-bg"
        x={accidentalOffset}
      >
        {note}
      </text> : null}
      <text
        className="jianpu-note-text"
        x={accidentalOffset}
        onClick={() => onClick(noteObj)}
      >
        {note}
      </text>

      {/* Draw underlines (for shorter notes) */}
      {[...Array(halves)].map((_, i) => (
        <line
          key={`underline-${i}`}
          x1="-10"
          y1="0"
          x2={`${(full ? 10 : 14 + dots * DIMENSIONS.dotSpacing) + accidentalOffset}`}
          y2="0"
          className="jianpu-underline"
          transform={`translate(0, ${5 + i * DIMENSIONS.underlineSpacing})`}
        />
      ))}

      {/* Draw octave dots (above) */}
      {octave > 0 && [...Array(octave)].map((_, i) => (
        <use
          key={`octave-above-${i}`}
          href="#octave-dot-template"
          transform={`translate(${accidentalOffset}, ${-22 - i * DIMENSIONS.octaveSpacing})`}
        />
      ))}

      {/* Draw octave dots (below) */}
      {octave < 0 && [...Array(Math.abs(octave))].map((_, i) => (
        <use
          key={`octave-below-${i}`}
          href="#octave-dot-template"
          transform={`translate(${accidentalOffset}, ${5 + (i + halves) * DIMENSIONS.octaveSpacing})`}
        />
      ))}

      {/* Draw dots (for extended duration) */}
      {[...Array(dots)].map((_, i) => (
        <use
          key={`dot-${i}`}
          href="#duration-dot-template"
          transform={`translate(${12 + i * DIMENSIONS.dotSpacing + accidentalOffset}, 0)`}
        />
      ))}

      {/* Draw dashes (for extended duration) */}
      {[...Array(dashes)].map((_, i) => (
        <use
          key={`dash-${i}`}
          href="#dash-template"
          transform={`translate(${12 + i * DIMENSIONS.dashSpacing + accidentalOffset}, 0)`}
        />
      ))}
    </g>
  );
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
 * Calculate the maximum high octave between two notes
 */
function maxHighOctave(note1: ParsedNote, note2: ParsedNote): number {
  const octave1 = note1.octave && note1.octave > 0 ? note1.octave : 0;
  const octave2 = note2.octave && note2.octave > 0 ? note2.octave : 0;
  return Math.max(octave1, octave2);
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
            const prevAccidentalOffset = getAccidentalOffset(prevNote.accidental);
            const currentAccidentalOffset = getAccidentalOffset(firstNote.accidental);

            // Calculate tie points in the global coordinate system
            const tieStartX = prevXOffset + prevX + prevAccidentalOffset;
            const tieEndX = currentXOffset + currentX + currentAccidentalOffset;

            const maxOctave = maxHighOctave(prevNote, firstNote);

            return (
              <TieComponent
                key={`tie-cross-${measureIndex}`}
                startX={tieStartX}
                endX={tieEndX}
                maxPaddingUp={maxPaddingUp}
                maxOctave={maxOctave}
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
    const prevAccidentalOffset = getAccidentalOffset(prevNote.accidental);
    const currentAccidentalOffset = getAccidentalOffset(noteObj.accidental);

    const tieStartX = prevX + prevAccidentalOffset;
    const tieEndX = currentX + currentAccidentalOffset;

    const maxOctave = maxHighOctave(prevNote, noteObj);

    return (
      <TieComponent
        key={`tie-${noteObj.indexOfScore}`}
        startX={tieStartX}
        endX={tieEndX}
        maxPaddingUp={maxPaddingUp}
        maxOctave={maxOctave}
      />
    );
  }
  return null;
}

const CrossLineLeftTie = ({ context }: { context: TieContext }) => {
  const { measures, measureIndex, notes, noteIndex, noteObj, dim, maxPaddingUp } = context;
  if (measureIndex === measures.length - 1 && noteIndex === notes.length - 1 && noteObj.tieAfter) {
    const currentX = dim.notePositions[noteIndex] + DIMENSIONS.leftPadding;
    const currentAccidentalOffset = getAccidentalOffset(noteObj.accidental);
    const tieStartX = currentX + currentAccidentalOffset;
    const tieEndX = tieStartX + widthOf(noteObj) * 2;

    const maxOctave = maxHighOctave(noteObj, noteObj);

    return (
      <TieComponent
        key={`tie-cross-left-${noteIndex}`}
        startX={tieStartX}
        endX={tieEndX}
        maxPaddingUp={maxPaddingUp}
        maxOctave={maxOctave}
      />
    );
  }
  return null;
}

const CrossLineRightTie = ({ context }: { context: TieContext }) => {
  const { measureIndex, noteIndex, noteObj, dim, maxPaddingUp } = context;
  if (measureIndex === 0 && noteIndex === 0 && noteObj.tie) {
    const currentX = dim.notePositions[noteIndex] + DIMENSIONS.leftPadding;
    const currentAccidentalOffset = getAccidentalOffset(noteObj.accidental);
    const tieEndX = currentX + currentAccidentalOffset;
    const tieStartX = tieEndX - DIMENSIONS.baseNoteWidth * 2;

    const maxOctave = maxHighOctave(noteObj, noteObj);

    return (
      <TieComponent
        key={`tie-cross-right-${noteIndex}`}
        startX={tieStartX}
        endX={tieEndX}
        maxPaddingUp={maxPaddingUp}
        maxOctave={maxOctave}
      />
    );
  }
  return null;
}

interface ScoreLineSvgProp {
  measures: ParsedScoreLine;
  timeSignature: TimeSignature;
  onNoteClick: (note: ParsedNote) => void
  playingNote: number
}

export const ScoreLineSvg = ({ measures, timeSignature, onNoteClick, playingNote }: ScoreLineSvgProp) => {
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
        const fullness = (() => {
          let acc = 0;
          const unit = timeSignature.actualNotePerBeat();
          return notes.map(note => acc += note.duration).map(d => d % unit == 0);
        })();

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
