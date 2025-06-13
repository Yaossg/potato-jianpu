export function dropWhile<T>(array: T[], pred: (element: T) => boolean): T[] {
    let i = 0;
    for (; i < array.length; i++) {
        if (!pred(array[i])) {
            break;
        }
    }
    return array.slice(i);
}

export function inclusiveScan(array: number[]): number[] {
   const result: number[] = [];
   let sum = 0;
   for (let i = 0; i < array.length; i++) {
       sum += array[i];
       result.push(sum);
   }
   return result;
}

export function exclusiveScan(array: number[]): number[] {
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < array.length; i++) {
        result.push(sum);
        sum += array[i];
    }
    return result;
}

export class Continuation {
    id: number = -1;

    async delay(seconds: number) {
        await new Promise(resolve => this.id = setTimeout(resolve, seconds * 1000));
        this.id = -1;
    }

    cancel() {
        if (this.id !== -1) {
            clearTimeout(this.id);
            this.id = -1;
        }
    }
}

export function toBytes(number: number, byteCount: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < byteCount; i++) {
        bytes[byteCount - 1 - i] = number & 0xFF;
        number >>= 8;
    }
    return bytes;
}

export function toVarInt(number: number): number[] {
    if (number < 0) {
        throw new Error("Negative numbers are not supported");
    }
    const bytes: number[] = [];
    do {
        let byte = number & 0x7F;
        number >>= 7;
        if (bytes.length > 0) {
            byte |= 0x80; // Set the continuation bit
        }
        bytes.push(byte);
    } while (number > 0);
    return bytes.reverse();
}