import { ArrayMatrix } from "../utils/ArrayMatrix";
import { Logic } from "./Logic";

export abstract class BaseMode {
	public logic: Logic
	
	constructor() {}

	writeBoard(board: ArrayMatrix<string>, boardStr: string[], offset: [number, number] = [0, 0]) {
		for (let y = 1; y <= boardStr.length; y++) {
			const row = boardStr[boardStr.length - y];
			for (let x = 0; x < row.length; x++) {
				board.setXY(x + offset[0], board.height - y - offset[1], row[x]);
			}
		}
	}

	doesBoardEqual(board: ArrayMatrix<string>, boardStr: string[], offset: [number, number] = [0, 0]) {
		for (let y = 1; y <= boardStr.length; y++) {
			const row = boardStr[boardStr.length - y];
			for (let x = 0; x < row.length; x++) {
				if (row[x] == " ") continue;
				if (board.atXY(x + offset[0], board.height - y - offset[1]) != row[x]) {
					return false;
				}
			}
		}
		return true;
	}

	bagInfo: string[] = [];

	bagBefore(target: string, before: string) {
		let loc = -1;

		for (let i = 0; i < this.bagInfo.length; i++) {
			if (this.bagInfo[i] == target) {
				loc = i;
			}
			if (this.bagInfo[i] == before) {
				if (loc != -1 && loc < i) {
					return true;
				}
			}
		}
		if (loc == -1) return undefined;
		return false;
	}

	hasMixedSequence(pieces: string) {
		const s = new Set(pieces);
		let counter = 0;
		for (let i = 0; i < this.bagInfo.length; i++) {
			if (s.has(this.bagInfo[i])) {
				counter++;
				if (counter == s.size) {
					return true;
				}
			} else {
				counter = 0;
			}
		}
		return false;
	}

	canSequence(pieces: string, holdPiece: string) {
		let counter = 0;
		let held = holdPiece;
		let canHold = true;
		for (let i = 0; i < this.bagInfo.length; i++) {
			if (pieces[counter] == this.bagInfo[i]) {
				canHold = true;
				counter++;
				if (counter == pieces.length) {
					return true;
				}
			} else {
				if (canHold && pieces[counter] == held) {
					held = this.bagInfo[i];
					canHold = false;
				}
				return false;
			}
		}
		return false;
	}

	replaceAll(board: ArrayMatrix<string>, predicate: (target: string) => boolean, replace: string) {
		for (let y = 0; y < board.height; y++) {
			for (let x = 0; x < board.width; x++) {
				if (predicate(board.atXY(x, y))) board.setXY(x, y, replace);
			}
		}
	}

	abstract frame(): void;
}