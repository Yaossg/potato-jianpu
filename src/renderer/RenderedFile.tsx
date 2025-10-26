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

export function renderFile({ source, pageWidth, onNoteClick, playingNote }: RenderedScoreProp): JSX.Element & React.SVGProps<SVGSVGElement> | ParseError {
  const file = parse(source);
  if (file instanceof ParseError) {
    return file;
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

export function RenderedFile(prop: RenderedScoreProp): JSX.Element {
  const rendered = renderFile(prop);
  if (rendered instanceof ParseError) {
    return <div className="error">{rendered.digest}</div>;
  } else {
    return rendered;
  }
}