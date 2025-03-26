import lang from "../data/lang/en.json";

export const l = (key: string) => {
	return lang[key];
};
