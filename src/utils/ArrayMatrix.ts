export class ArrayMatrix<T> extends Array<T> {
	constructor(public width: number, public height: number) {
		super(width * height);
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
				result.setXY(x, y, this.atXY(this.height - y - 1, x));
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
				result.setXY(x, y, this.atXY(y, this.width - x - 1));
			}
		}

		return result;
	}

	atXY(x: number, y: number): T {
		if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
		return this[x + this.width * y];
	}

	setXY(x: number, y: number, value: T) {
		if (x < 0 || y < 0 || x >= this.width || y >= this.height) throw new RangeError("Out of bounds");
		this[x + this.width * y] = value;
	}

	detectSectors(isEqual: (a: T, b: T) => boolean): [number, number][][] {
		const sectors: [number, number][][] = [];
		const visited = new ArrayMatrix<boolean>(this.width, this.height).fill(false);

		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				if (!visited.atXY(x, y)) {
					const value = this.atXY(x, y);
					const sector: [number, number][] = [];
					let queue = [[x, y]];
					let item;

					while ((item = queue.pop())) {
						const [xx, yy] = item;
						if (yy < 0 || yy >= this.height || xx < 0 || xx >= this.width) {
							continue;
						}

						if (visited.atXY(xx, yy) || !isEqual(this.atXY(xx, yy), value)) {
							continue;
						}

						visited.setXY(xx, yy, true);
						sector.push([xx, yy]);

						// Explore neighbors
						queue.push([xx + 0, yy + 1], [xx + 0, yy - 1], [xx + 1, yy + 0], [xx - 1, yy + 0]);
					}
					if (sector.length > 0) sectors.push(sector);
				}
			}
		}

		return sectors;
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
