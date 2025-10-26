import { renderFile } from "./RenderedFile";
import ReactDOMServer from 'react-dom/server'
import { ParseError } from "@/parser/grammar";
import { Canvg } from 'canvg';

interface StringifiedSVG {
    svg: string;
    width: number;
    height: number;
}

function renderToString(source: string, pageWidth: number): StringifiedSVG | null {
    const rendered = renderFile({ source, pageWidth });
    if (rendered instanceof ParseError) {
        return null;
    }
    const header = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`;
    const body = ReactDOMServer.renderToString(rendered);
    return { 
        svg: `${header}\n${body}`, 
        width: rendered.props.width, height: rendered.props.height 
    };
}

export function renderSvg(source: string, pageWidth: number): string | null {
    const stringified = renderToString(source, pageWidth);
    if (stringified === null) {
        return null;
    }
    const { svg } = stringified;
    return svg;
}

export async function renderPng(source: string, pageWidth: number, theme: string): Promise<Blob | null> {
    const stringified = renderToString(source, pageWidth);
    if (stringified === null) {
        return null;
    }
    const { svg, width, height } = stringified;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
        return null;
    }
    await Canvg.fromString(ctx, svg).render();
    return canvas.convertToBlob({ type: 'image/png' });
}