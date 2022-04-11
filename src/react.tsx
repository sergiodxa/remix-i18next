import { useMatches } from "@remix-run/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function PreloadTranslations() {
  let { i18n } = useTranslation();

  let namespaces = [
    ...new Set(
      useMatches()
        .filter((route) => route.handle?.i18n !== undefined)
        .flatMap((route) => route.handle.i18n as string | string[])
    ),
  ];

  let lang = i18n.language;

  return (
    <>
      {namespaces.map((namespace) => {
        return (
          <link
            key={namespace}
            rel="preload"
            as="fetch"
            href={`/locales/${lang}/${namespace}.json`}
          />
        );
      })}
    </>
  );
}

export function useLocale(): string {
  let [rootMatch] = useMatches();
  let { locale } = rootMatch.data ?? {};
  if (!locale) throw new Error("Missing locale returned by the root loader.");
  if (typeof locale === "string") return locale;
  throw new Error("Invalid locale returned by the root loader.");
}

export function useChangeLanguage() {
  let locale = useLocale();
  let { i18n } = useTranslation();
  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [locale, i18n]);
}
