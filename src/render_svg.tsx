import { DurableNote, Accidental } from './parser';

// Constants for layout
const DIMENSIONS = {
  baseNoteWidth: 24,
  baseNoteHeight: 24,
  leftPadding: 18,
  measureSpacing: 0, // RESERVED FOR FUTURE USE
  accidentalOffset: 10,
  tieHeight: 13,
  tieCurveHeight: 9,
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
    stroke: #333;
    stroke-width: 2.5;
  }
  
  .jianpu-dot {
    fill: #333;
  }
  
  .jianpu-dash {
    stroke: #333;
    stroke-width: 3;
  }
  
  .jianpu-tie {
    fill: #333;
    stroke: #333;
    stroke-width: 1;
  }
  
  .jianpu-note-text {
    font-family: Helvetica;
    font-size: 24px;
    font-weight: bold;
    text-anchor: middle;
  }
  
  .jianpu-accidental-text {
    font-family: Helvetica;
    font-size: 16px;
    font-weight: bold;
    text-anchor: middle;
  }
  
  .jianpu-bar-text {
    font-family: Helvetica;
    font-size: 48px;
    font-weight: bold;
    text-anchor: middle;
  }
`;

// SVG definitions for reusable elements
const JianpuDefs = () => (
  <defs>
    <style>{svgStyles}</style>
    
    {/* Underline template */}
    <line
      id="underline-template"
      x1="-10"
      y1="0"
      x2="10"
      y2="0"
      className="jianpu-underline"
    />

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

interface MeasureSvgProps {
  notes: DurableNote[];
  bar: string;
}

/**
 * Calculate the width of a note in relative units
 */
function widthOf({ dashes = 0, dots = 0, accidental }: DurableNote): number {
  let width = 1;
  width += dashes;
  width += dots * 0.5;
  width += accidental !== null && accidental !== undefined ? 0.5 : 0;
  return width;
}

/**
 * Calculate the padding needed above a note
 */
function paddingUpOf({ octave = 0, tie }: DurableNote): number {
  let height = DIMENSIONS.baseNoteHeight;
  height += (octave > 0) ? octave * DIMENSIONS.octaveSpacing : 0;
  height += tie ? DIMENSIONS.tieHeight : 0;
  return height;
}

/**
 * Calculate the padding needed below a note
 */
function paddingDownOf({ octave = 0, halves = 0 }: DurableNote): number {
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

/**
 * Render a tie between two notes
 */
const TieComponent = ({ 
  startX, 
  endX, 
  maxPaddingUp, 
  maxOctave = 0, 
  key 
}: { 
  startX: number, 
  endX: number, 
  maxPaddingUp: number, 
  maxOctave?: number, 
  key: string 
}) => {
  const tieWidth = endX - startX;
  if (tieWidth <= 0) return null;
  
  const yOffset = calculateTieYOffset(maxOctave);
  
  return (
    <path 
      key={key}
      d={createTiePath(startX, endX)}
      className="jianpu-tie"
      transform={`translate(0, ${maxPaddingUp - DIMENSIONS.tiePadding + yOffset})`}
    />
  );
};

// JianpuNoteComponent for rendering a single note
const JianpuNoteComponent = ({ noteObj }: { noteObj: DurableNote }) => {
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
      <text
        className="jianpu-note-text"
        x={accidentalOffset}
      >
        {note}
      </text>

      {/* Draw underlines (for shorter notes) */}
      {[...Array(halves)].map((_, i) => (
        <use
          key={`underline-${i}`}
          href="#underline-template"
          transform={`translate(${accidentalOffset}, ${5 + i * DIMENSIONS.underlineSpacing})`}
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
function calculateMeasureDimensions(measures: MeasureSvgProps[]): MeasureDimensions[] {
  return measures.map(({notes}) => {
    let totalWidth = 0;
    let notePositions: number[] = [];
    let paddingUp = 0;
    let paddingDown = 0;
    
    notes.forEach((noteObj) => {
      notePositions.push(totalWidth);
      totalWidth += widthOf(noteObj) * DIMENSIONS.baseNoteWidth;
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
 * Render cross-measure ties
 */
const CrossMeasureTies = ({ 
  measures, 
  measureDimensions, 
  maxPaddingUp 
}: { 
  measures: MeasureSvgProps[], 
  measureDimensions: MeasureDimensions[], 
  maxPaddingUp: number 
}) => {
  return (
    <>
      {measures.map(({notes}, measureIndex) => {
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
            
            const prevOctave = prevNote.octave && prevNote.octave > 0 ? prevNote.octave : 0;
            const currentOctave = firstNote.octave && firstNote.octave > 0 ? firstNote.octave : 0;
            const maxOctave = Math.max(prevOctave, currentOctave);
            
            return (
              <TieComponent
                key={`tie-${measureIndex}-0-cross`}
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

/**
 * Main component for rendering Jianpu notation
 */
export const ScoreLineSvg = ({ measures }: { measures: MeasureSvgProps[] }) => {
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
      <JianpuDefs />
      
      {/* Render ties across measures */}
      <CrossMeasureTies 
        measures={measures} 
        measureDimensions={measureDimensions} 
        maxPaddingUp={maxPaddingUp} 
      />
      
      {/* Render measures */}
      {measures.map(({notes, bar}, measureIndex) => {
        const dim = measureDimensions[measureIndex];
        const xOffset = calculateMeasureXOffset(measureDimensions, measureIndex);
        
        return (
          <g key={measureIndex} transform={`translate(${xOffset}, 0)`}>
            {/* Render ties within measure */}
            {notes.map((noteObj, index) => {
              if (index > 0 && noteObj.tie) {
                const prevX = dim.notePositions[index - 1] + DIMENSIONS.leftPadding;
                const currentX = dim.notePositions[index] + DIMENSIONS.leftPadding;
                
                const prevNote = notes[index - 1];
                const prevAccidentalOffset = getAccidentalOffset(prevNote.accidental);
                const currentAccidentalOffset = getAccidentalOffset(noteObj.accidental);
                
                const tieStartX = prevX + prevAccidentalOffset;
                const tieEndX = currentX + currentAccidentalOffset;
                
                const prevOctave = prevNote.octave && prevNote.octave > 0 ? prevNote.octave : 0;
                const currentOctave = noteObj.octave && noteObj.octave > 0 ? noteObj.octave : 0;
                const maxOctave = Math.max(prevOctave, currentOctave);
                
                return (
                  <TieComponent
                    key={`tie-${measureIndex}-${index}`}
                    startX={tieStartX}
                    endX={tieEndX}
                    maxPaddingUp={maxPaddingUp}
                    maxOctave={maxOctave}
                  />
                );
              }
              return null;
            })}
            
            {/* Render notes */}
            {notes.map((noteObj, index) => (
              <g 
                key={`note-${measureIndex}-${index}`} 
                transform={`translate(${dim.notePositions[index] + DIMENSIONS.leftPadding}, ${maxPaddingUp})`}
              >
                <JianpuNoteComponent noteObj={noteObj} />
              </g>
            ))}
            
            {/* Render bar */}
            <text
              className="jianpu-bar-text"
              x={dim.width - DIMENSIONS.leftPadding + 12}
              y={maxPaddingUp + DIMENSIONS.noteBottomPadding}
            >
              {bar}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
