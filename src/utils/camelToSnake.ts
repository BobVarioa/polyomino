export const camelToSnake = <T>(obj: T, prefix: string) => Object.fromEntries(
	(Object.entries(obj) as [string, T[keyof T]][]).map((v) => {
		let snake = "";
		const camel = v[0];
		for (let i = 0; i < camel.length; i++) {
			const letter = camel[i];
			const c = letter.charCodeAt(0);
			if (c >= 65 && c <= 90) {
				// A-Z
				if (i != 0) snake += "_";
				snake += String.fromCharCode(c + 32); // toLowerCase for ascii alpha stuff
			} else {
				snake += letter;
			}
		}

		return [prefix + snake, v[1]];
	})
);
