/**
 * Get the list of namespaces used by the application server-side so you could
 * set it on i18next init options.
 * @example
 * i18next.init({
 *   ns: getInitialNamespaces(), // this function
 *   // ...more options
 * })
 */
export function getInitialNamespaces(): string[] {
	let namespaces = Object.values(window.__remixRouteModules).flatMap(
		(route) => {
			if (typeof route?.handle !== "object") return [];
			if (!route.handle) return [];
			if (!("i18n" in route.handle)) return [];
			if (typeof route.handle.i18n === "string") return [route.handle.i18n];
			if (
				Array.isArray(route.handle.i18n) &&
				route.handle.i18n.every((value) => typeof value === "string")
			) {
				return route.handle.i18n as string[];
			}
			return [];
		},
	);

	return [...namespaces];
}
