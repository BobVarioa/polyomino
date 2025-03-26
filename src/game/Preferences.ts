import { camelToSnake } from "../utils/camelToSnake";

export enum Prefs {
	Arr,
	Das,
	Sdf,
	Sound,
	Music,
	Length,
}

const namesToPrefs = camelToSnake(Prefs, "prefs.");

export class Preferences {
	#data: number[] = [2, 10, 1, 100, 50];

	backgroundColor: string = "#000";
	gridColor: string = "#505050";

	constructor() {}

	set(key: Prefs, value: number) {
		this.#data[key] = value;
	}

	get(key: Prefs) {
		return this.#data[key];
	}

	getByName(key: string) {
		return this.get(namesToPrefs[key]);
	}

	setByName(key: string, value: number) {
		this.set(namesToPrefs[key], value);
	}
}
