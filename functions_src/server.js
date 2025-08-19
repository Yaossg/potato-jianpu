import { exportMusic } from '../src/player/midi.ts' 

export function onRequest(context) {
  const { request } = context;
  if (request.method === 'POST') {
    const { source, program = 0, omitInitialRest = true } = request.body;
    const uri = exportMusic(source, program, omitInitialRest ? -1 : 0);
    return new Response(uri, {
        headers: {
            'Content-Type': 'audio/midi'
        }
    });
  }
  return new Response('Method Not Allowed', { status: 405 });
}