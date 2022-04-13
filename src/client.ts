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
  let namespaces = new Set(
    Object.values(window.__remixRouteModules)
      .filter((route) => route.handle?.i18n !== undefined)
      .flatMap((route) => route.handle.i18n)
  );

  return [...namespaces];
}
