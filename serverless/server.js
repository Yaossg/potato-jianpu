import { RenderedFile } from '../src/renderer/RenderedFile.tsx';
import { exportMusic } from '../src/player/midi.ts'
import { synthMusic } from '../src/player/synth.ts'
import ReactDOMServer from 'react-dom/server'

// Cloudflare Serverless
export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'POST') {
    const json = await request.json();
    const { method } = json;
    switch (method) {
      case 'svg': {
        const { source = '', pageWidth = 1000 } = json;
        const rendered = ReactDOMServer.renderToString(RenderedFile({ source, pageWidth }));
        return new Response(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${rendered}`, {
          headers: {
            'Content-Type': 'image/svg+xml'
          }
        });
      }
      case 'midi': {
        const { source = '', program = 0, omitInitialRest = true } = json;
        const blob = exportMusic(source, program, omitInitialRest ? -1 : 0);
        if (blob === null) {
          return new Response('Invalid Jianpu Source', { status: 400 });
        }
        return new Response(blob.stream(), {
            headers: {
                'Content-Type': 'audio/midi'
            }
        });
      }
      case 'wav': {
        const { source = '', program = 0, volume = 100, sampleRate = 44100, omitInitialRest = true } = json;
        const blob = await synthMusic(source, program, volume / 100, sampleRate, omitInitialRest ? -1 : 0);
        if (blob === null) {
          return new Response('Invalid Jianpu Source', { status: 400 });
        }
        return new Response(blob.stream(), {
            headers: {
                'Content-Type': 'audio/wav'
            }
        });
      }
      default:
        return new Response(`Method Not Allowed: ${method}`, { status: 405 });
    }
  }
  return new Response(`Method Not Allowed: ${request.method}`, { status: 405 });
}

// Vercel Serverless
export async function POST(request) {
  return onRequest({ request })
}