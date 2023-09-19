import { useMatches } from "@remix-run/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export interface PreloadTranslationsProps {
  loadPath: string;
}

/**
 * Preload the translations files for the current language and the namespaces
 * required by the routes.
 *
 * It receives a single `loadPath` prop with the path to the translation files.
 *
 * @example
 * <PreloadTranslations loadPath="/locales/{{lng}}/{{ns}}.json" />
 *
 */
export function PreloadTranslations({ loadPath }: PreloadTranslationsProps) {
  let { i18n } = useTranslation();

  let namespaces = [
    ...new Set(
      useMatches()
        .filter(
          (route) =>
            (route.handle as { i18n?: string | string[] })?.i18n !== undefined
        )
        .flatMap((route) => (route.handle as { i18n: string | string[] }).i18n)
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
            href={loadPath
              .replace("{{lng}}", lang)
              .replace("{{ns}}", namespace)}
          />
        );
      })}
    </>
  );
}

/**
 * Get the locale returned by the root route loader under the `locale` key.
 * @example
 * let locale = useLocale()
 * let formattedDate = date.toLocaleDateString(locale);
 * @example
 * let locale = useLocale("language")
 * let formattedDate = date.toLocaleDateString(locale);
 */
export function useLocale(localeKey = "locale"): string {
  let [rootMatch] = useMatches();
  let { [localeKey]: locale } =
    (rootMatch.data as Record<string, string>) ?? {};
  if (!locale) throw new Error("Missing locale returned by the root loader.");
  if (typeof locale === "string") return locale;
  throw new Error("Invalid locale returned by the root loader.");
}

/**
 * Detect when the locale returned by the root route loader changes and call
 * `i18n.changeLanguage` with the new locale.
 * This will ensure translations are loaded automatically.
 */
export function useChangeLanguage(locale: string) {
  let { i18n } = useTranslation();
  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [locale, i18n]);
}
