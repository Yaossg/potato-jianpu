declare module "lamejs" {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, bitRate: number);
    encodeBuffer(left: Int16Array, right?: Int16Array): Uint8Array | number[];
    flush(): Uint8Array | number[];
  }
}

declare module "lamejs/src/js/BitStream.js" {
  const BitStream: unknown;
  export default BitStream;
}

declare module "lamejs/src/js/Lame.js" {
  const Lame: unknown;
  export default Lame;
}

declare module "lamejs/src/js/MPEGMode.js" {
  const MPEGMode: unknown;
  export default MPEGMode;
}
