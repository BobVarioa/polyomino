
import seedRandom from "seedrandom";

export class Random {
	generator: seedRandom.PRNG;

	constructor(public seed = 1) {
		this.generator = seedRandom.tychei(seed+"");
	}

	next(): number {
  		// Returns a float between 0.0, and 1.0
		return this.generator();
	}

	setSeed(n: number) {
		this.generator = seedRandom.tychei(n + "")
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
