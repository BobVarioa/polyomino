export class MultiKeyMap<K, V>  {
	#keys: Set<K>[] = [];
	#values: V[] = [];
	readonly size: number = 0;

	constructor() {}

	set(keys: K[], value: V) {
		let index = -1;
		let keyset: Set<K>
		for (let i = 0; i < this.#keys.length; i++) {
			keyset = this.#keys[i];
			if (this.#values[i] == value) {
				index = i;
				break;
			}
			for (const k of keys) {
				if (keyset.has(k)) {
					index = i;
					break;
				}
			}
		}
		if (index != -1) {
			for (const k of keys) {
				keyset.add(k);
			}
			this.#values[index] = value;
		} else {
			let set = new Set<K>();
			for (const k of keys) {
				set.add(k);
			}
			const len = this.#keys.push(set);
			this.#values[len - 1] = value;
			this.size = len;
		}
	}

	get(key: K): V {
		for (let i = 0; i < this.#keys.length; i++) {
			const keyset = this.#keys[i];

			if (keyset.has(key)) {
				return this.#values[i]
			}
		}
		return undefined;
	}

	deleteKey(key: K): boolean {
		for (let i = 0; i < this.#keys.length; i++) {
			const keyset = this.#keys[i];

			if (keyset.has(key)) {
				return keyset.delete(key);
			}
		}
		return false;
	}

	clear() {
		this.#keys = [];
		this.#values = [];
	}

	has(key: K): boolean {
		for (let i = 0; i < this.#keys.length; i++) {
			const keyset = this.#keys[i];

			if (keyset.has(key)) {
				return true;
			}
		}
		return false;
	}

	keys(): K[] {
		return this.#keys.flatMap(v => [...v.values()])
	}
}
