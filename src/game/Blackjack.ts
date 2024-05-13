import { Random } from "../utils/randomizer";

/*
(Copied from https://tetris.fandom.com/wiki/Blackjack)
Syntax
[list]
	Choose a piece at random from the comma-separated list and deal it. Duplicates are permitted, making the duplicated pieces more likely. Equivalent to 1 bag of list, list with 0 history, or list with len history 1 rolls.
bag of [list]
	Make a bag of list and deal them all in random sequence, then reshuffle. Equivalent to len(list) bag of list.
[number] bag of [list]
	Make a bag of list and deal the first number in random sequence, then reshuffle.
sequence of [list]
	Starting with the first piece of list, deal each piece in turn. When the end of the list is reached, start again from the beginning. Equivalent to list with len(list)-1 history
[list] with [len] history
	Keep a list called history of the last len pieces dealt. (Repeated pieces in list are separate pieces for purpose of the history.) Choose a piece at random from list which is not in history and deal it. Then put the piece in history and remove the oldest piece from history.
[list] with [len] history [number] rolls
	Keep a list called history of the last len pieces dealt. (Repeated pieces in list are separate pieces for purpose of the history.) Up to number times, choose a piece at random from list, and if it is not in history, deal it. Otherwise, deal the last piece chosen. Then put the piece in history and remove the oldest piece from history.
[spec] first [list]
	Follow spec, except choose the first piece from list.
*/

export interface WrappedGenerator<T> {
	next(): T;
	peek(n: number): T[];
	reset(seed: number): void;
	[Symbol.iterator]: () => Generator<T>;
}

function wrapGenerator<T>(
	gen: (rng: Random) => Generator<T>
): WrappedGenerator<T> {
	let random = new Random();
	let iter = gen(random);
	let peekCache: T[] = [];

	return {
		next: (): T => {
			if (peekCache.length > 0) {
				return peekCache.shift();
			}
			return iter.next().value as T;
		},
		peek: (n = 1): T[] => {
			for (let i = peekCache.length; i < n; i++) {
				peekCache.push(this.next());
			}
			return peekCache.slice(0, n);
		},
		reset: (seed: number) => {
			random.seed = seed;
			iter = gen(random);
			peekCache = [];
		},
		[Symbol.iterator]: () => {
			return iter;
		},
	};
}

/*
const rng = wrapGenerator(function* () {
	let seed = Math.floor(Math.random() * 2147483647)
	while (true) yield (seed = (seed * 16807) % 2147483647) / 2147483647;
});
*/

const bagOfRegex = /^(\d+)?\+?(\d+)? ?bag of (.*)$/;
const sequenceOfRegex = /^(\d+) ?(random)? ?sequence of (.*)$/;
const withRegex =
	/^(.*) with (\d+) history(?: (\d+) rolls)?(?: starting with (.*))?$/;
const listItemRegex = /^(\d*)?\*?(.*)$/;
const firstRegex = /^(.*) but first (.*)$/;

function listNormalize(list: string): string[] {
	return list.split(",").flatMap((x: string) => {
		const str = x.trim();
		if (str.length === 0) return [];
		const match = listItemRegex.exec(str);
		if (!match) return [];
		const [, count, item] = match;
		if (!count) return item;
		else return Array<string>(parseInt(count, 10)).fill(item);
	});
}

const whitespaceRegex = /\s+/g;

function createRandomizer(str: string): (rng: Random) => Generator<string> {
	str = str.replace(whitespaceRegex, " ");

	let first: string[] | undefined;

	let res: RegExpExecArray | null = null;

	res = firstRegex.exec(str);
	if (res) {
		const [, list, firstList] = res;
		first = listNormalize(firstList);
		str = list;
	}

	res = bagOfRegex.exec(str);
	if (res) {
		const list = listNormalize(res[3]);
		const count = res[1] ? parseInt(res[1], 10) : list.length;
		const bonus = res[2] ? parseInt(res[2], 10) : 0;

		const len = count + bonus;
		return function* (rng: Random) {
			let bag = rng.shuffleArray(list.slice());
			let bonusBag: string[] = [];
			if (first) {
				const piece = rng.chooseRandom(first);
				yield piece;
				bag = bag.filter((x) => x !== piece);
			}

			while (true) {
				for (let i = 0; i < len; i++) {
					if (!bag.length) {
						if (bonus) {
							if (!bonusBag.length)
								bonusBag = rng.shuffleArray(list.slice());
							yield bonusBag.pop();
						} else {
							yield rng.chooseRandom(list);
						}
					} else {
						yield bag.pop();
					}
				}
				bag = rng.shuffleArray(list.slice());
			}
		};
	}

	res = sequenceOfRegex.exec(str);
	if (res) {
		const list = listNormalize(res[3]);
		const len = res[1] ? parseInt(res[1]) : undefined;
		const random = res[2] === "random";
		return function* (rng: Random) {
			while (true) {
				let newList = first ? [rng.chooseRandom(first)] : [];
				if (len) {
					while (newList.length < len) {
						if (random) {
							newList.push(rng.chooseRandom(list));
						} else {
							newList.push(...list);
						}
					}
					newList = newList.slice(0, len);
				} else {
					newList = list;
				}
				yield* newList;
			}
		};
	}

	res = withRegex.exec(str);
	if (res) {
		const list = listNormalize(res[1]);
		const historyLen = parseInt(res[2]);
		const rolls = res[3] ? parseInt(res[3]) : undefined;
		const history = res[4] ? listNormalize(res[4]) : [];
		return function* (rng: Random) {
			if (first) {
				const piece = rng.chooseRandom(first);
				yield piece;
				if (history.length === historyLen) history.shift();
				history.push(piece);
			}
			while (true) {
				const arr = rng.shuffleArray(list.slice());
				for (let i = 0; i < (rolls ?? list.length); i++) {
					const piece = rng.chooseRandom(arr);
					if (!history.includes(piece) || (rolls && i + 1 == rolls)) {
						yield piece;
						if (history.length === historyLen) history.shift();
						history.push(piece);
						break;
					}
				}
			}
		};
	}

	const list = listNormalize(str);
	return function* (rng: Random) {
		if (first) yield rng.chooseRandom(first);
		while (true) {
			yield rng.chooseRandom(list);
		}
	};
}

export const blackjack = (str: string) => wrapGenerator(createRandomizer(str));

// export const tgm1 = rand(
// 	`I,J,L,O,S,T,Z
// 		with 4 history 4 rolls starting with Z,Z,Z,Z
// 		but first I,J,L,T`
// );
// export const tgm2 = rand(
// 	`I,J,L,O,S,T,Z
// 		with 4 history 6 rolls starting with Z,S,Z,S
// 		but first I,J,L,T`
// );
// // this is incomplete because I am unsure of how to represent the least recently used piece
// export const tgm3 = rand(
// 	`5*I,5*J,5*L,5*O,5*S,5*T,5*Z
// 		with 4 history 6 rolls starting with Z,S,Z,S
// 		${/*weighted on frequency // maybe?*/""}
// 		but first I,J,L,T`
// );
// export const ace = rand("bag of I,J,L,O,S,T,Z but first I,J,L,T");

// export const guideline = rand("bag of I,J,L,O,S,T,Z");
// export const alexey = rand("I,J,L,O,S,T,Z");
// export const nes = rand("I,J,L,O,S,T,Z with 1 history");
// //
// export const square = rand("bag of 9*I,9*J,9*L,9*O,9*S,9*T,9*Z");
// export const sega = rand("1000 random sequence of I,J,L,O,S,T,Z");

// // has a "bonus" bag, which is used if the bag is empty up to the number of times specified
// // (i.e. 7+1 is 1 draw from the bonus bag)
// export const bonusBag = rand("7+1 bag of I,J,L,O,S,T,Z");
// // this is different because once finished with the bag it generates a new piece randomly
// export const bag8 = rand("8 bag of I,J,L,O,S,T,Z");

// export const iOnly = rand("I");
// export const noI = rand("bag of J,L,O,S,T,Z");
