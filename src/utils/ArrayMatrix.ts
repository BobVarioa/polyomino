export class ArrayMatrix<T> extends Array<T> {
	constructor(public width: number, public height: number) {
		super(width * height);
	}

	static create<T>(width: number, height: number, fill: T): ArrayMatrix<T> {
		return new ArrayMatrix<T>(width, height).fill(fill);
	}

	copy() {
		const arr = new ArrayMatrix<T>(this.width, this.height)

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				arr.setXY(x, y, this.atXY(x, y)!);
			}
		}

		return arr;
	}

	/**
	 *
	 * @returns a copy of the matrix rotated counter clockwise
	 */
	rotate90degcc() {
		if (this.width != this.height) throw new TypeError("Skew matrixes cannot be rotated");
		const result = new ArrayMatrix<T>(this.height, this.width);

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				result.setXY(x, y, this.atXY(this.height - y - 1, x)!);
			}
		}

		return result;
	}

	/**
	 *
	 * @returns a copy of the matrix rotated clockwise
	 */
	rotate90deg() {
		if (this.width != this.height) throw new TypeError("Skew matrixes cannot be rotated");
		const result = new ArrayMatrix<T>(this.height, this.width);

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				result.setXY(x, y, this.atXY(y, this.width - x - 1)!);
			}
		}

		return result;
	}

	atXY(x: number, y: number): T | undefined {
		if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
		return this[x + this.width * y];
	}

	setXY(x: number, y: number, value: T) {
		if (x < 0 || y < 0 || x >= this.width || y >= this.height) throw new RangeError("Out of bounds");
		this[x + this.width * y] = value;
	}

	shiftUp(n: number, emptyVal: T) {
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				this.setXY(x,y, this.atXY(x, y + n) ?? emptyVal)
			}
		}

	}

	toString() {
		let str = "";
		for (let y = 0; y < this.height; y++) {
			if (y == 0) str += "⎡ ";
			else if (y == this.height - 1) str += "⎣ ";
			else str += "| ";
			for (let x = 0; x < this.width; x++) {
				str += this.atXY(x, y);
				str += " ";
			}
			if (y == 0) str += "⎤\n";
			else if (y == this.height - 1) str += "⎦\n";
			else str += "|\n";
		}
		return str;
	}
}
