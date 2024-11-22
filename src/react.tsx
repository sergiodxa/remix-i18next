import * as React from "react";
import { useTranslation } from "react-i18next";
import { useMatches } from "react-router";

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
	let matches = useMatches();
	// biome-ignore lint/style/noNonNullAssertion: There's always a root match
	let rootMatch = matches[0]!;
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
	React.useEffect(() => {
		if (i18n.language !== locale) i18n.changeLanguage(locale);
	}, [locale, i18n]);
}
