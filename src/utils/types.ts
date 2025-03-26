export const hasOwn = <K extends PropertyKey>(object: any, property: K): object is Record<K, unknown> => {
	return Object.hasOwn(object, property);
}