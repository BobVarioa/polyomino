import lang from "../data/lang/en.json";

export const l = (key: string): string => {
	// @ts-expect-error indexing string set with string
	return lang[key];
};
