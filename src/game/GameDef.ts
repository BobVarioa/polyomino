import { MultiKeyMap } from "../utils/MultiKeyMap";
import { WrappedGenerator, blackjack } from "./Blackjack";
import { ArrayMatrix } from "../utils/ArrayMatrix";
import { GarbageManager } from "./Garbage";

export interface GameSchema {
	pieces: Record<string, PieceDef>;
	rotation: Record<string, { "0": string; R: string; "2": string; L: string }>;
	randomizer: string;
	settings: Settings;
	garbage: GarbageSchema;
}

export interface GarbageSchema {
	lines: number[];
	b2b?: {
		spins: boolean;
		lines: number;
		bonus: Record<string, number>;
	};
	pc?: number;
	combo?: Record<string, number>;
	spin?: {
		pieces: string[];
		bonus: number[];
	};
}

export enum PieceFlags {
	Garbage = 1,
	Unclearable = 2,
}

export class Piece {
	constructor(public name: string, public matrix: ArrayMatrix<number>, public flags: number = 0) {}
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
	readonly queueLength: number;
	readonly clearType: string;
	readonly pieceType: string;
	readonly dropDelay: number;
	readonly garbageLocation: string;
	readonly garbageHoles: number;
	readonly garbageCheese: number;
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
		public readonly settings: Settings,
		public readonly colors: Map<string, string>,
		public readonly subpieces: Map<number, string>,
		public readonly garbage: GarbageManager
	) {}

	static fromJson(json: GameSchema | string) {
		if (typeof json == "string") {
			json = JSON.parse(json) as GameSchema;
		}

		const settings = json.settings;
		const canMetaPieces = settings.pieceType == "meta";

		const pieces = new Map();
		let subpieceIndex = 2;
		const subpieces = new Map<number, string>();
		const revSubpieces = new Map<string, number>();
		const colors = new Map<string, string>();

		for (const [key, value] of Object.entries(json.pieces)) {
			const data = value.def.split("/");
			const size = data[0].length;
			const matrix = new ArrayMatrix<number>(size, size);

			for (let x = 0; x < size; x++) {
				for (let y = 0; y < size; y++) {
					const c = data[y][x];
					if (canMetaPieces && pieces.has(c)) {
						if (revSubpieces.has(c)) {
							matrix.setXY(x, y, revSubpieces.get(c));
						} else {
							subpieces.set(subpieceIndex, c);
							revSubpieces.set(c, subpieceIndex);
							matrix.setXY(x, y, subpieceIndex);
							subpieceIndex++;
						}
					} else {
						matrix.setXY(x, y, parseInt(c));
					}
				}
			}

			pieces.set(key, new Piece(key, matrix));
			if (value.color) colors.set(key, value.color);
		}

		// prettier-ignore
		{
			/*
			reserved piece names:
			?: normal garbage
			!: unclearable garbage
			*/
			pieces.set("?", new Piece("?", new ArrayMatrix<number>(1, 1).fill(1), PieceFlags.Garbage));
			pieces.set("!", new Piece("!", new ArrayMatrix<number>(1, 1).fill(1), PieceFlags.Garbage | PieceFlags.Unclearable));
			colors.set("?", "#707070")
			colors.set("!", "#202020")
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

		const garbageManager = GarbageManager.fromSchema(json.garbage);

		return new GameDef(pieces, rotations, randomizer, settings, colors, subpieces, garbageManager);
	}
}
