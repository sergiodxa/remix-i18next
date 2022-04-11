export function getNamespaces(): string[] {
  let namespaces = new Set(
    Object.values(window.__remixRouteModules)
      .filter((route) => route.handle?.i18n !== undefined)
      .flatMap((route) => route.handle.i18n)
  );

  return [...namespaces];
}
