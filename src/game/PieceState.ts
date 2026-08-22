import { ArrayMatrix } from "../utils/ArrayMatrix";
import { Piece, PieceFlags } from "./GameDef";
import { Logic } from "./Logic";

export class RotState {
	static Initial = new RotState(0);
	static Left = new RotState(1);
	static Twice = new RotState(2);
	static Right = new RotState(3);

	constructor(public value: number) {}

	equals(other: RotState) {
		return this.value === other.value;
	}

	left() {
		let value = this.value + 1;
		if (value > 3) value = 0;
		return new RotState(value);
	}

	right() {
		let value = this.value - 1;
		if (value < 0) value = 3;
		return new RotState(value);
	}

	twice() {
		return this.left().left();
	}

	name(): "0" | "L" | "2" | "R" {
		switch (this.value) {
			case 0:
				return "0";
			case 1:
				return "L";
			case 2:
				return "2";
			case 3:
				return "R";
		}
		throw new RangeError("Invalid state of this.value.");
	}
}

export class PieceState {
	public data: ArrayMatrix<number>;
	public flags: ArrayMatrix<number>;
	public invalid = false;

	// note: this is special, its fine if everything is null here
	static none = new PieceState(undefined!, undefined!, RotState.Initial, 0, 0).invalidate();

	constructor(
		public parent: Logic,
		public piece: Piece,
		public rot: RotState,
		public x: number,
		public y: number,
	) {
		this.data = piece?.data;
		this.flags = piece?.flags;
	}

	invalidate() {
		this.invalid = true;
		return this;
	}

	moveLeft() {
		this.x -= 1;
		if (this.parent.pieceIntersecting(this)) {
			this.x += 1;
		}
		return this;
	}

	moveRight() {
		this.x += 1;
		if (this.parent.pieceIntersecting(this)) {
			this.x -= 1;
		}
		return this;
	}

	softDrop() {
		this.y += 1;
		if (this.parent.pieceIntersecting(this)) {
			this.y -= 1;
		}
		return this;
	}

	hardDrop() {
		// this just straight up shouldn't affect performance, but a few ideas on how to make this faster
		// 1. keep track of top empty row whenever piece is set
		// 2. count from bottom instead of top since typically that's more empty, unless stack is > half tall
		while (true) {
			this.y += 1;
			if (this.parent.pieceIntersecting(this)) {
				this.y -= 1;
				break;
			}
		}
		return this;
	}

	rotate90deg() {
		this.data = this.data.rotate90deg();
		this.flags = this.flags.rotate90deg();
		for (let i = 0; i < this.flags.length; i++) {
			const p = this.flags[i];
			if (p == 0) continue;

			let v = PieceFlags.Normal;
			
			if ((p & PieceFlags.L) !== 0) {
				v |= PieceFlags.U;
			}
			if ((p & PieceFlags.U) !== 0) {
				v |= PieceFlags.R;
			}
			if ((p & PieceFlags.R) !== 0) {
				v |= PieceFlags.D;
			}
			if ((p & PieceFlags.D) !== 0) {
				v |= PieceFlags.L;
			}

			this.flags[i] = v;
		}

		this.rot = this.rot.right();
		return this;
	}

	rotate90degcc() {
		this.data = this.data.rotate90degcc();
		this.flags = this.flags.rotate90degcc();
		for (let i = 0; i < this.flags.length; i++) {
			const f = this.flags[i];
			if (f == 0) continue;

			let v = PieceFlags.Normal;
			
			if ((f & PieceFlags.L) !== 0) {
				v |= PieceFlags.D;
			}
			if ((f & PieceFlags.D) !== 0) {
				v |= PieceFlags.R;
			}
			if ((f & PieceFlags.R) !== 0) {
				v |= PieceFlags.U;
			}
			if ((f & PieceFlags.U) !== 0) {
				v |= PieceFlags.L;
			}

			this.flags[i] = v;
		}
		
		this.rot = this.rot.left();
		return this;
	}

	private rotate(piece: PieceState, rot: RotState) {
		let newRot = piece.rot;
		let kicks = piece.parent.calculateKicks(piece.piece, rot, newRot);

		for (const [xK, yK] of kicks) {
			// yK is negated as negative values mean up for us
			const translated = piece.relative(xK, -yK);
			if (!this.parent.pieceIntersecting(translated)) {
				return translated;
			}
		}

		return undefined;
	}

	rotateLeft() {
		let piece = this.copy();
		let rot = piece.rot;
		piece.rotate90degcc();
		return this.rotate(piece, rot);
	}

	rotateRight() {
		let piece = this.copy();

		let rot = piece.rot;
		piece.rotate90deg();
		return this.rotate(piece, rot);
	}

	rotate180() {
		let piece = this.copy();
		let rot = piece.rot;
		piece.rotate90deg().rotate90deg();
		return this.rotate(piece, rot);
	}

	copy() {
		let piece = new PieceState(this.parent, this.piece, this.rot, this.x, this.y);
		piece.data = this.data.copy();
		piece.flags = this.flags.copy();
		return piece;
	}

	at(x: number, y: number) {
		let piece = this.copy();
		piece.x = x;
		piece.y = y;
		return piece;
	}

	relative(x: number, y: number) {
		return this.at(this.x + x, this.y + y);
	}

	/**
	 * writes piece to gameboard then invalidates self
	 */
	write() {
		for (let y = 0; y < this.data.height; y++) {
			for (let x = 0; x < this.data.width; x++) {
				const v = this.data.atXY(x, y)!;
				if (v != 0) {
					this.parent.gameboard.setXY(this.x + x, this.y + y, v, this.flags.atXY(x, y)!);
				}
			}
		}

		this.invalidate();
	}
}
