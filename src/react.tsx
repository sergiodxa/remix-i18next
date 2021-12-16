import { useMatches } from "@remix-run/react";
import { i18n } from "i18next";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { I18nextProvider } from "react-i18next";
import useConsistentValue from "use-consistent-value";
import { Language } from "./backend";

let context = createContext<i18n | null>(null);

function useI18NextInstance() {
  let value = useContext(context);
  if (!value) throw new Error("Missing I18Next instance");
  return value;
}

export function useRemixI18Next(locale: string) {
  if (!locale) throw new Error("Missing locale");

  let i18next = useI18NextInstance();

  let namespaces = useConsistentValue(
    useMatches()
      .flatMap((match) => (match.data?.i18n ?? {}) as Record<string, Language>)
      // eslint-disable-next-line unicorn/no-array-reduce
      .reduce(
        (messages, routeMessages) => ({ ...messages, ...routeMessages }),
        {}
      )
  );

  const handleLocaleUpdate = useCallback(() => {
    i18next.changeLanguage(locale);
    for (let [namespace, messages] of Object.entries(namespaces)) {
      i18next.addResourceBundle(locale, namespace, messages);
    }
  }, [i18next, namespaces, locale]);

  useMemo(() => {
    handleLocaleUpdate();
  }, []);

  useEffect(() => {
    handleLocaleUpdate();
  }, [handleLocaleUpdate]);
}

interface RemixI18NextProvider {
  children: ReactNode;
  i18n: i18n;
}

export function RemixI18NextProvider({ children, i18n }: RemixI18NextProvider) {
  return (
    <context.Provider value={i18n}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </context.Provider>
  );
}
