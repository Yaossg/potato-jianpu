import { JSX } from 'react';
import { parse, ParseError, ParsedNote } from '@/parser';

import { renderHeader } from './render-header';
import { renderScore } from './render-score';

interface RenderedScoreProp {
  source: string;
  pageWidth: number
  onNoteClick?: (note: ParsedNote) => void
  playingNote?: number
}

export function RenderedFile({ source, pageWidth, onNoteClick, playingNote }: RenderedScoreProp): JSX.Element {
  const file = parse(source);
  if (file instanceof ParseError) {
    return <div className="error">{file.digest}</div>;
  }
  const { header, score } = file;
  const { timeSignature } = header;
  const renderedHeader = renderHeader(pageWidth, header);
  const renderedScore = renderScore({ score, timeSignature, onNoteClick, playingNote });

  return <svg width={pageWidth} height={renderedHeader.props.height + renderedScore.props.height}  xmlns="http://www.w3.org/2000/svg">
    <g>
      {renderedHeader}
    </g>
    <g transform={`translate(0, ${renderedHeader.props.height})`}>
      {renderedScore}
    </g>
  </svg>;
}