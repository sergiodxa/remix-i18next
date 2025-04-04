import { formatLanguageString } from "./format-language-string.js";

let REGEX =
	/[ ]*((([a-zA-Z]+(-[a-zA-Z0-9]+){0,2})|\*)(;[ ]*q=[0-1](\.[0-9]+)?[ ]*)?)*/g;

export interface Language {
	code: string;
	script?: string | null | undefined;
	region?: string | undefined;
	quality: number;
}

export interface PickOptions {
	loose?: boolean | undefined;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function parse(acceptLanguage?: string): Language[] {
	let strings = (acceptLanguage || "").match(REGEX);
	if (!strings) throw new Error("Invalid Accept-Language header");

	let languages: Language[] = [];

	for (let m of strings) {
		if (!m) continue;

		m = m.trim();

		let bits = m.split(";");
		let ietf = bits[0]?.split("-") ?? [];
		let hasScript = ietf.length === 3;

		languages.push({
			// biome-ignore lint/style/noNonNullAssertion: We know this is not null
			code: ietf[0]!,
			script: hasScript ? ietf[1] : null,
			region: hasScript ? ietf[2] : ietf[1],
			quality: bits[1]
				? // biome-ignore lint/style/noNonNullAssertion: We know this is not null
					(Number.parseFloat(bits[1]!.split("=")[1]!) ?? 1.0)
				: 1.0,
		});
	}

	return languages.sort((a, b) => b.quality - a.quality);
}

export function pick<T extends string>(
	supportedLanguages: readonly T[],
	acceptLanguage: string | Language[],
	options: PickOptions = { loose: false },
): T | null {
	if (!supportedLanguages || !supportedLanguages.length || !acceptLanguage) {
		return null;
	}

	let parsedAcceptLanguage = isString(acceptLanguage)
		? parse(acceptLanguage)
		: acceptLanguage;

	let supported = supportedLanguages.map((support) => {
		let bits = support.split("-");
		let hasScript = bits.length === 3;

		return {
			// biome-ignore lint/style/noNonNullAssertion: We know this is not null
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
