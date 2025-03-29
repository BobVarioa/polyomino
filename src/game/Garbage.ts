import { GarbageSchema } from "./GameDef";

export class GarbageManager {
	private constructor(
		private obj: GarbageSchema,
		private b2bTable: [number, number][],
		private comboTable: [number, number][],
		private spinPieceSet: Set<string>
	) {}

	static fromSchema(obj: GarbageSchema): GarbageManager {
		const b2bTable = [];
		if (obj.b2b) {
			for (const [k, v] of Object.entries(obj.b2b.bonus)) {
				b2bTable.push([parseInt(k), v]);
			}
		}
		const comboTable = [];
		if (obj.combo) {
			for (const [k, v] of Object.entries(obj.combo)) {
				comboTable.push([parseInt(k), v]);
			}
		}
		const spinPieceSet = new Set<string>();
		if (obj.spin) {
			for (const piece of obj.spin.pieces) {
				spinPieceSet.add(piece);
			}
		}

		return new GarbageManager(obj, b2bTable, comboTable, spinPieceSet);
	}

	isB2B(lines: number, spin: boolean): boolean {
		if (this.b2bTable.length == 0) return false;
		if (lines >= this.obj.b2b.lines || (this.obj.b2b.spins && spin)) {
			return true;
		}

		return false;
	}

	isSpin(piece: string): boolean {
		if (this.obj.spin) {
			if (this.spinPieceSet.size == 0) return true;
			return this.spinPieceSet.has(piece);
		}
		return false;
	}

	clear(lines: number, combo: number, b2b: number, spin: boolean, pc: boolean): number {
		let garbage = 0;

		if (lines > 0) {
			const linesBonus = this.obj.lines;
			if (lines - 1 >= linesBonus.length) {
				garbage += linesBonus.at(-1) + (linesBonus.length - lines);
			} else {
				garbage += linesBonus[lines - 1];
			}
		}

		let comboBonus = 0;
		for (const [required, bonus] of this.comboTable) {
			if (combo >= required) comboBonus = bonus;
		}
		garbage += comboBonus;

		let b2bBonus = 0;
		for (const [required, bonus] of this.b2bTable) {
			if (b2b >= required) b2bBonus = bonus;
		}
		garbage += b2bBonus;

		if (spin && lines > 0) {
			const spinBonus = this.obj.spin.bonus;
			if (lines - 1 >= spinBonus.length) {
				garbage += spinBonus.at(-1) + (spinBonus.length - lines);
			} else {
				garbage += spinBonus[lines - 1];
			}
		}

		if (pc && this.obj.pc) {
			garbage += this.obj.pc;
		}

		return garbage;
	}
}
