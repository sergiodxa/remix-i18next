import { useMatches } from "@remix-run/react";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useConsistentValue from "use-consistent-value";
import { Language } from "./backend";

/**
 * Get the translations from the i18n key returned by the loaders and pass them
 * to i18next to be used by the components.
 * @param locale The locale to use.
 */
export function useSetupTranslations(locale: string) {
  if (!locale) throw new Error("Missing locale");

  let { i18n } = useTranslation();

  let namespaces = useConsistentValue(
    useMatches()
      .flatMap((match) => (match.data?.i18n ?? {}) as Record<string, Language>)
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce(
        (messages, routeMessages) => ({ ...messages, ...routeMessages }),
        {}
      )
  );

  let handleLocaleUpdate = useCallback(() => {
    void i18n.changeLanguage(locale);
    for (let [namespace, messages] of Object.entries(namespaces)) {
      i18n.addResourceBundle(locale, namespace, messages);
    }
  }, [i18n, namespaces, locale]);

  useMemo(() => {
    handleLocaleUpdate();
  }, []);

  useEffect(() => {
    handleLocaleUpdate();
  }, [handleLocaleUpdate]);
}
