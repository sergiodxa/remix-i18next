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
	let namespaces = Object.values(
		// biome-ignore lint/suspicious/noExplicitAny: not sure where hte type definition comes from
		(window as any).__reactRouterRouteModules,
	).flatMap(
		// biome-ignore lint/suspicious/noExplicitAny: making TS happy, not sure where the type definition comes from
		(route: any) => {
			if (typeof route?.handle !== "object") return [];
			if (!route.handle) return [];
			if (!("i18n" in route.handle)) return [];
			if (typeof route.handle.i18n === "string") return [route.handle.i18n];
			if (
				Array.isArray(route.handle.i18n) &&
				route.handle.i18n.every((value: unknown) => typeof value === "string")
			) {
				return route.handle.i18n as string[];
			}
			return [];
		},
	);

	return [...namespaces];
}
