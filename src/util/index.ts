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
