/**
 * Park Miller "Minimal Standard" PRNG.
 */

export class Random {
	constructor(public seed = 1) {}

	next(): number {
  		// Returns a float between 0.0, and 1.0
		return this.nextSeed() / 2147483647;
	}

	setSeed(n: number) {
		this.seed = n;
	}

	nextSeed() {
		return this.seed = (this.seed * 16807) % 2147483647;
	}

	randomInt(min: number, max: number): number {
		return Math.floor(this.next() * (max - min + 1)) + min;
	}

	shuffleArray<T>(array: T[]): T[] {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(this.next() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	chooseRandom<T>(list: T[]): T {
		return list[Math.floor(this.next() * list.length)];
	}
}
