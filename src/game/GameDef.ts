import { MultiKeyMap } from "../utils/MultiKeyMap";
import { WrappedGenerator, blackjack } from "./Blackjack";
import { ArrayMatrix } from "../utils/ArrayMatrix";

export interface GameSchema {
	pieces: Record<string, PieceDef>;
	rotation: Record<string, { "0": string; R: string; "2": string; L: string }>;
	randomizer: string;
	settings: Settings;
}

export class Piece {
	constructor(public name: string, public matrix: ArrayMatrix<number>, public color: string) {}
}

export interface PieceDef {
	readonly def: string;
	readonly color: string;
}

export interface Settings {
	readonly boardSize: [number, number];
	readonly screenSize: [number, number];
	readonly are: number;
	readonly gravity: number;
	readonly lockDelay: number;
	readonly hold: boolean;
	readonly holdDelay: number;
	readonly lineClearDelay: number;
	readonly specialRotation: string;
	readonly rotation: boolean;
	readonly gravityType: string;
}

export interface KickTable {
	"0": [number, number][];
	R: [number, number][];
	"2": [number, number][];
	L: [number, number][];
}

export class GameDef {
	constructor(
		public readonly pieces: Map<string, Piece>,
		public readonly rotations: MultiKeyMap<string, KickTable>,
		public readonly randomizer: WrappedGenerator<string>,
		public readonly settings: Settings
	) { }

	static fromJson(json: GameSchema | string) {
		if (typeof json == "string") {
			json = JSON.parse(json) as GameSchema;
		}

		const pieces = new Map();

		for (const [key, value] of Object.entries(json.pieces)) {
			const data = value.def.split("/");
			const size = data[0].length;
			const matrix = new ArrayMatrix<number>(size, size);

			for (let x = 0; x < size; x++) {
				for (let y = 0; y < size; y++) {
					matrix.setXY(x, y, data[y][x] === "0" ? 0 : 1);
				}
			}

			pieces.set(key, new Piece(key, matrix, value.color));
		}

		pieces.set("?", new Piece("?", new ArrayMatrix<number>(1,1).fill(1), "gray"))

		const rotations = new MultiKeyMap<string, KickTable>();

		for (const [key, value] of Object.entries(json.rotation)) {
			const keys = key.split(",");

			const kickTable: any = {};

			for (const validKey of ["0", "R", "2", "L"] as const) {
				const str = value[validKey];

				kickTable[validKey] = str.split(";").map((v) => {
					const [x, y] = v.split(",");
					return [parseInt(x), parseInt(y)];
				});
			}

			rotations.set(keys, kickTable);
		}

		const randomizer = blackjack(json.randomizer);

		const settings = json.settings;

		return new GameDef(pieces, rotations, randomizer, settings);
	}
}
