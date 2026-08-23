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
	None = 0,
	Normal = 1,
	Garbage = 2,
	Unclearable = 4,
	L = 8,
	U = 16,
	R = 32,
	D = 64,
}

export class Piece {
	readonly mirror: number = 0;

	constructor(
		public readonly name: string,
		public readonly index: number,
		public readonly data: ArrayMatrix<number>,
		public readonly flags: ArrayMatrix<number>,
		public readonly color: string,
		public readonly uv: [number, number],
	) {}
}

export interface PieceDef {
	readonly def: string;
	readonly color: string;
	readonly uv: [number, number];
	readonly parent?: boolean;
}

export interface SimplePieceGenerator {
	readonly type: "simple"
}

export interface SubpieceGenerator {
	readonly type: "subpiece"
	readonly template: string;
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
	readonly specialRotation: "flip" | "cycle" | "none";
	readonly rotation: boolean;
	readonly gravityType: "naive" | "linear" | "cascade" | "sticky";
	readonly queueLength: number;
	readonly clearType: "line" | "color" | "match3";
	readonly pieceType: "normal" | "meta";
	readonly dropDelay: number;
	readonly garbageLocation: "top" | "bottom";
	readonly garbageHoles: number;
	readonly garbageCheese: number;
	readonly pieceGeneration: SimplePieceGenerator | SubpieceGenerator;
}

export interface KickTable {
	"0": [number, number][];
	R: [number, number][];
	"2": [number, number][];
	L: [number, number][];
}

export class GameDef {
	private readonly pieces: Map<number, Piece> = new Map();
	private readonly pieceRegistry: Map<string, number> = new Map();
	pieceIndex: number = 1;

	readonly topLeftMap: Map<number, [number, number]> = new Map();
	readonly widthHeightMap: Map<number, [number, number]> = new Map();
	readonly rotations: MultiKeyMap<number, KickTable> = new MultiKeyMap();
	readonly settings: Settings;
	readonly garbage: GarbageManager;
	readonly randomizer!: WrappedGenerator<number>;

	readonly maxPieceWidth!: number;
	readonly maxPieceHeight!: number;

	constructor(settings: Settings, garbage: GarbageManager) {
		this.settings = settings;
		this.garbage = garbage;
	}

	getPiece(idx: number): Piece {
		return this.pieces.get(idx)!;
	}

	getPieceIdx(name: string): number {
		return this.pieceRegistry.get(name)!;
	}

	setPiece(name: string, data: ArrayMatrix<number>, flags: ArrayMatrix<number>, color: string, uv: [number, number]) {
		const piece = new Piece(name, this.pieceIndex, data, flags, color, uv);
		this.pieces.set(this.pieceIndex, piece);
		this.pieceRegistry.set(name, this.pieceIndex);
		this.pieceIndex++;
	}

	private defToMatrix(def: string): [ArrayMatrix<number>, ArrayMatrix<number>] {
		const data = def.split("/");
		const size = data[0].length;
		const matrix = ArrayMatrix.create(size, size, 0);
		const flags = ArrayMatrix.create(size, size, PieceFlags.None);

		for (let x = 0; x < size; x++) {
			for (let y = 0; y < size; y++) {
				const c = data[y][x];

				if (c == "0") continue;

				if (c != "1") {
					if (!this.pieceRegistry.has(c)) {
						throw new RangeError(`Unknown piece type "${c}" in matrix definition.`);
					}
					matrix.setXY(x, y, this.pieceRegistry.get(c)!);
				} else {
					matrix.setXY(x, y, this.pieceIndex);
				}
			}
		}

		for (let x = 0; x < size; x++) {
			for (let y = 0; y < size; y++) {
				const p = matrix.atXY(x, y);
				if (p == 0) continue;

				let v = PieceFlags.Normal;

				if (p == matrix.atXY(x - 1, y)) {
					v |= PieceFlags.L;
				}
				if (p == matrix.atXY(x + 1, y)) {
					v |= PieceFlags.R;
				}
				if (p == matrix.atXY(x, y - 1)) {
					v |= PieceFlags.U;
				}
				if (p == matrix.atXY(x, y + 1)) {
					v |= PieceFlags.D;
				}

				flags.setXY(x, y, v);
			}
		}

		return [matrix, flags];
	}

	static fromJson(json: GameSchema | string) {
		if (typeof json == "string") {
			json = JSON.parse(json) as GameSchema;
		}

		const settings = json.settings;
		const garbageManager = GarbageManager.fromSchema(json.garbage);

		const gamedef = new GameDef(settings, garbageManager);

		const canMetaPieces = settings.pieceType == "meta";

		const pieces = Object.entries(json.pieces);

		if (canMetaPieces) {
			for (const [name, piece] of pieces) {
				if (!piece.parent) continue;

				const [data, flags] = gamedef.defToMatrix(piece.def);
				gamedef.setPiece(name, data, flags, piece.color, piece.uv);
			}

			for (const [name, piece] of pieces) {
				if (piece.parent) continue;

				const [data, flags] = gamedef.defToMatrix(piece.def);
				gamedef.setPiece(name, data, flags, piece.color, piece.uv);
			}
		} else {
			for (const [name, piece] of pieces) {
				if (piece.parent) continue;

				const [data, flags] = gamedef.defToMatrix(piece.def);
				gamedef.setPiece(name, data, flags, piece.color, piece.uv);
			}
		}

		if (settings.specialRotation == "flip") {
			for (let i = 1; i < gamedef.pieceIndex; i++) {
				const p = gamedef.getPiece(i);

				if (p.name.endsWith("'")) {
					const mirrorName = p.name.slice(0, -1);
					if (gamedef.pieceRegistry.has(mirrorName)) {
						// @ts-expect-error basically constructor
						p.mirror = gamedef.pieceRegistry.get(mirrorName);
					}
				} else {
					const mirrorName = p.name + "'";
					if (gamedef.pieceRegistry.has(mirrorName)) {
						// @ts-expect-error basically constructor
						p.mirror = gamedef.pieceRegistry.get(mirrorName);
					}
				}
			}
		}

		// prettier-ignore
		{
			/*
			reserved piece names:
			?: normal garbage
			!: unclearable garbage
			*/
			gamedef.setPiece(
				"?", 
				ArrayMatrix.create(1, 1, 1),
				ArrayMatrix.create(1, 1, PieceFlags.Normal | PieceFlags.Garbage),
				"#707070",
				[0, 3]
			);
			gamedef.setPiece(
				"!", 
				ArrayMatrix.create(1, 1, 1),
				ArrayMatrix.create(1, 1, PieceFlags.Normal | PieceFlags.Garbage | PieceFlags.Unclearable),
				"#202020",
				[1, 3]
			);
		}

		let maxW = 0;
		let maxH = 0;
		for (let i = 1; i < gamedef.pieceIndex; i++) {
			const p = gamedef.getPiece(i);

			let topLeftPoint: [number, number] = [0, 0];
			let realWidth = 0;
			let realHeight = 0;
			// NOTE: you probably don't need two loops here but pieces are so small, and this only happens once, so this really shouldn't be a big deal
			column: for (let x = 0; x < p.data.width; x++) {
				for (let y = 0; y < p.data.height; y++) {
					if (p.data.atXY(x, y) != 0) {
						if (realWidth == 0) {
							topLeftPoint[0] = x;
						}
						realWidth++;
						continue column;
					}
				}
			}

			row: for (let y = 0; y < p.data.height; y++) {
				for (let x = 0; x < p.data.width; x++) {
					if (p.data.atXY(x, y) != 0) {
						if (realHeight == 0) {
							topLeftPoint[1] = y;
						}
						realHeight++;
						continue row;
					}
				}
			}

			gamedef.topLeftMap.set(i, topLeftPoint);
			gamedef.widthHeightMap.set(i, [realWidth, realHeight]);

			maxW = Math.max(realWidth, maxW);
			maxH = Math.max(realHeight, maxH);
		}

		// @ts-expect-error this is basically a constructor, so this is fine
		gamedef.maxPieceHeight = maxH;
		// @ts-expect-error this is basically a constructor, so this is fine
		gamedef.maxPieceWidth = maxW;

		const randomizer = blackjack(json.randomizer, gamedef.pieceRegistry);
		// @ts-expect-error this is basically a constructor, so this is fine
		gamedef.randomizer = randomizer;

		for (const [key, value] of Object.entries(json.rotation)) {
			const keys = key.split(",").map((v) => gamedef.pieceRegistry.get(v)!);

			const kickTable: any = {};

			for (const validKey of ["0", "R", "2", "L"] as const) {
				const str = value[validKey];

				kickTable[validKey] = str.split(";").map((v) => {
					const [x, y] = v.split(",");
					return [parseInt(x), parseInt(y)];
				});
			}

			gamedef.rotations.set(keys, kickTable);
		}

		return gamedef;
	}
}
