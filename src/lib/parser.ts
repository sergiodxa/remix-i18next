import { formatLanguageString } from "./format-language-string.js";

export interface Language {
	code: string;
	script?: string | null | undefined;
	region?: string | undefined;
	quality: number;
}

export interface PickOptions {
	loose?: boolean | undefined;
}

/**
 * Check whether a value is a string.
 */
function isString(value: unknown): value is string {
	return typeof value === "string";
}

/**
 * Parse an `Accept-Language` header into sorted language entries.
 */
export function parse(acceptLanguage?: string): Language[] {
	let languages: Language[] = [];

	for (let part of (acceptLanguage || "").split(",")) {
		let entry = part.trim();
		if (!entry) continue;

		let bits = entry.split(";");
		let languageTag = bits.shift()?.trim();
		if (!languageTag || !isLanguageTag(languageTag)) continue;

		let ietf = languageTag.split("-");
		let hasScript = ietf.length === 3;
		let quality = 1.0;

		for (let parameter of bits) {
			let parsedQuality = getQuality(parameter);
			if (parsedQuality === null) continue;
			quality = parsedQuality;
			break;
		}

		languages.push({
			code: ietf[0]!,
			script: hasScript ? ietf[1] : null,
			region: hasScript ? ietf[2] : ietf[1],
			quality,
		});
	}

	return languages.sort((a, b) => b.quality - a.quality);
}

function isLanguageTag(value: string): boolean {
	if (value === "*") return true;

	let parts = value.split("-");
	if (parts.length === 0 || parts.length > 3) return false;
	if (!/^[a-zA-Z]+$/.test(parts[0] ?? "")) return false;

	for (let index = 1; index < parts.length; index++) {
		if (!/^[a-zA-Z0-9]+$/.test(parts[index] ?? "")) return false;
	}

	return true;
}

function getQuality(value: string): number | null {
	let parameter = value.trim();
	if (!parameter.startsWith("q")) return null;

	let [key, quality] = parameter.split("=");
	if (key?.trim() !== "q" || !quality) return null;
	if (!/^[0-1](\.[0-9]+)?\s*$/.test(quality)) return null;

	return Number.parseFloat(quality);
}

/**
 * Pick the best supported language for a given `Accept-Language` value.
 */
export function pick<T extends string>(
	supportedLanguages: readonly T[],
	acceptLanguage: string | Language[],
	options: PickOptions = { loose: false },
): T | null {
	if (!supportedLanguages?.length || !acceptLanguage) {
		return null;
	}

	let parsedAcceptLanguage = isString(acceptLanguage) ? parse(acceptLanguage) : acceptLanguage;

	let supported = supportedLanguages.map((support) => {
		let bits = support.split("-");
		let hasScript = bits.length === 3;

		return {
			code: bits[0]!,
			script: hasScript ? bits[1] : null,
			region: (hasScript ? bits[2] : bits[1]) ?? undefined,
		};
	}) satisfies Array<Pick<Language, "code" | "script" | "region">>;

	for (let lang of parsedAcceptLanguage) {
		if (!lang) continue;
		let langCode = lang.code.toLowerCase();
		let langRegion = lang.region ? lang.region.toLowerCase() : lang.region;
		let langScript = lang.script ? lang.script.toLowerCase() : lang.script;

		for (let supportedLanguage of supported) {
			let supportedCode = supportedLanguage.code?.toLowerCase() ?? "";
			if (langCode !== supportedCode) continue;

			let supportedScript = supportedLanguage.script
				? supportedLanguage.script.toLowerCase()
				: supportedLanguage.script;
			let supportedRegion = supportedLanguage.region
				? supportedLanguage.region.toLowerCase()
				: supportedLanguage.region;

			if (
				langCode === supportedCode &&
				(options?.loose || !langScript || langScript === supportedScript) &&
				(options?.loose || !langRegion || langRegion === supportedRegion)
			) {
				return formatLanguageString(supportedLanguage) as T;
			}
		}
	}

	return null;
}
