import { MultiKeyMap } from "../utils/MultiKeyMap";
import { WrappedGenerator, blackjack } from "./blackjack";
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
	def: string;
	color: string;
}

export interface Settings {
	boardSize: [number, number];
	screenSize: [number, number];
	are: number;
	gravity: number;
	lockDelay: number;
	hold: boolean;
	holdDelay: number;
	lineClearDelay: number;
}

export interface KickTable {
	"0": [number, number][];
	R: [number, number][];
	"2": [number, number][];
	L: [number, number][];
}

export class GameDef {
	constructor(
		public pieces: Map<string, Piece>,
		public rotations: MultiKeyMap<string, KickTable>,
		public randomizer: WrappedGenerator<string>,
		public settings: Settings
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
