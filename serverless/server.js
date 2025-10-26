import { renderSvg } from '../src/renderer/renderer.ts';
import { exportMusic } from '../src/player/midi.ts'
import { synthMusic } from '../src/player/synth.ts'

// Cloudflare Serverless
export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'POST') {
    const json = await request.json();
    const { method } = json;
    switch (method) {
      case 'svg': {
        const { source = '', pageWidth = 1000 } = json;
        const blob = renderSvg(source, pageWidth);
        if (blob === null) {
          return new Response('Invalid Jianpu Source', { status: 400 });
        }
        return new Response(blob.stream(), {
          headers: {
            'Content-Type': 'image/svg+xml'
          }
        });
      }
      // case 'png': {
      //   const { source = '', pageWidth = 1000 } = json;
      //   const blob = await renderPng(source, pageWidth);
      //   if (blob === null) {
      //     return new Response('Invalid Jianpu Source', { status: 400 });
      //   }
      //   return new Response(blob.stream(), {
      //     headers: {
      //       'Content-Type': 'image/png'
      //     }
      //   });
      // }
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
  return onRequest({ request });
}