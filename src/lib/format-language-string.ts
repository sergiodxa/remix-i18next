import type { Language } from "./parser.js";

/**
 * Format a language object into an IETF-like locale string.
 */
export function formatLanguageString(
	language: Pick<Language, "code" | "region" | "script">,
): string {
	let parts = [language.code];
	if (language.script) parts.push(language.script);
	if (language.region) parts.push(language.region);
	return parts.join("-");
}
