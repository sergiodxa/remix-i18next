import { useMatches } from "@remix-run/react";
import { useSSR } from "react-i18next";
import useConsistentValue from "use-consistent-value";
import { Language } from "./backend";

/**
 * Get the translations from the i18n key returned by the loaders and pass them
 * to i18next to be used by the components.
 * @param locale The locale to use.
 */
export function useSetupTranslations(locale: string) {
  let namespaces = useNamespaces(locale);
  useSSR(namespaces, locale);
}

/**
 * Get the namespaces from the loaders data.
 * Returns them as expected by useSSR from React i18next.
 * @param locale The locale to use.
 */
export function useNamespaces(locale: string) {
  if (!locale) throw new Error("Missing locale");

  let matches = useMatches();
  let data = matches.map(
    (match) => (match.data?.i18n ?? {}) as Record<string, Language>
  );
  let namespaces: Record<string, Language> = {};
  for (let item of data) {
    namespaces = { ...namespaces, ...item };
  }

  return useConsistentValue({ [locale]: namespaces });
}
