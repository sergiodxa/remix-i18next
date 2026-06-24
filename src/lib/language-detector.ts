import type { Cookie, SessionStorage } from "react-router";
import { getClientLocales } from "./get-client-locales.js";
import { pick } from "./parser.js";
import type { MiddlewareFunction } from "react-router";

type MiddlewareArgs = Parameters<MiddlewareFunction<Response>>[0];

export interface LanguageDetectorArgs extends MiddlewareArgs {}

export interface LanguageDetectorOption {
	/**
	 * Define the list of supported languages, this is used to determine if one of
	 * the languages requested by the user is supported by the application.
	 * This should be be same as the supportedLngs in the i18next options.
	 */
	supportedLanguages: string[];
	/**
	 * Define the fallback language that it's going to be used in the case user
	 * expected language is not supported.
	 * This should be be same as the fallbackLng in the i18next options.
	 */
	fallbackLanguage: string;
	/**
	 * If you want to use a cookie to store the user preferred language, you can
	 * pass the Cookie object here.
	 */
	cookie?: Cookie;
	/**
	 * If you want to use a session to store the user preferred language, you can
	 * pass the SessionStorage object here.
	 * When this is not defined, getting the locale will ignore the session.
	 */
	sessionStorage?: SessionStorage;
	/**
	 * If defined a sessionStorage and want to change the default key used to
	 * store the user preferred language, you can pass the key here.
	 * @default "lng"
	 */
	sessionKey?: string;
	/**
	 * If you want to use search parameters for language detection and want to
	 * change the default key used to for the parameter name,
	 * you can pass the key here.
	 * @default "lng"
	 */
	searchParamKey?: string;
	/**
	 * The order the library will use to detect the user preferred language.
	 * By default the order is
	 * - searchParams
	 * - cookie
	 * - session
	 * - header
	 * If customized, a an extra `custom` option can be added to the order.
	 * And finally the fallback language.
	 */
	order?: Array<"searchParams" | "cookie" | "session" | "header" | "custom">;
	/**
	 * A function that can be used to find the locale using the full route args.
	 * This can be useful to get the locale from the URL pathname, or to query it
	 * from the database or fetch it from an API.
	 */
	findLocale?(args: LanguageDetectorArgs): Promise<string | Array<string> | null>;
}

/**
 * The LanguageDetector contains the logic to detect the user preferred language
 * fully server-side by using a SessionStorage, Cookie, URLSearchParams, or
 * Headers.
 */
export class LanguageDetector {
	/**
	 * Create a language detector with the provided detection options.
	 */
	constructor(private options: LanguageDetectorOption) {
		this.isSessionOnly(options);
		this.isCookieOnly(options);
	}

	/**
	 * Ensure session-only mode has a session storage configured.
	 */
	private isSessionOnly(options: LanguageDetectorOption) {
		if (options.order?.length === 1 && options.order[0] === "session" && !options.sessionStorage) {
			throw new Error(
				"You need a sessionStorage if you want to only get the locale from the session",
			);
		}
	}

	/**
	 * Ensure cookie-only mode has a cookie configured.
	 */
	private isCookieOnly(options: LanguageDetectorOption) {
		if (options.order?.length === 1 && options.order[0] === "cookie" && !options.cookie) {
			throw new Error("You need a cookie if you want to only get the locale from the cookie");
		}
	}

	/**
	 * Detect the best language for the current request.
	 */
	public async detect(args: LanguageDetectorArgs): Promise<string> {
		let order = this.options.order ?? this.defaultOrder;

		for (let method of order) {
			let locale: string | null = null;

			if (method === "searchParams") {
				locale = this.fromSearchParams(args.request);
			}

			if (method === "cookie") {
				locale = await this.fromCookie(args.request);
			}

			if (method === "session") {
				locale = await this.fromSessionStorage(args.request);
			}

			if (method === "header") {
				locale = this.fromHeader(args.request);
			}

			if (method === "custom") {
				locale = await this.fromCustom(args);
			}

			if (locale) return locale;
		}

		return this.options.fallbackLanguage;
	}

	/**
	 * Build the default detection order.
	 */
	private get defaultOrder() {
		let order: Array<"searchParams" | "cookie" | "session" | "header" | "custom"> = [
			"searchParams",
			"cookie",
			"session",
			"header",
		];
		if (this.options.findLocale) order.unshift("custom");
		return order;
	}

	/**
	 * Read the locale from the URL search params.
	 */
	private fromSearchParams(request: Request): string | null {
		let url = new URL(request.url);
		if (!url.searchParams.has(this.options.searchParamKey ?? "lng")) {
			return null;
		}
		return this.fromSupported(url.searchParams.get(this.options.searchParamKey ?? "lng"));
	}

	/**
	 * Read the locale from a cookie.
	 */
	private async fromCookie(request: Request): Promise<string | null> {
		if (!this.options.cookie) return null;

		let cookie = this.options.cookie;
		let lng = await cookie.parse(request.headers.get("Cookie"));
		if (typeof lng !== "string" || !lng) return null;

		return this.fromSupported(lng);
	}

	/**
	 * Read the locale from session storage.
	 */
	private async fromSessionStorage(request: Request): Promise<string | null> {
		if (!this.options.sessionStorage) return null;

		let session = await this.options.sessionStorage.getSession(request.headers.get("Cookie"));

		let lng = session.get(this.options.sessionKey ?? "lng");

		if (!lng) return null;

		return this.fromSupported(lng);
	}

	/**
	 * Read the locale from the `Accept-Language` header.
	 */
	private fromHeader(request: Request): string | null {
		let locales = getClientLocales(request);
		if (!locales) return null;
		if (Array.isArray(locales)) return this.fromSupported(locales.join(","));
		return this.fromSupported(locales);
	}

	/**
	 * Read the locale from the custom locale finder.
	 */
	private async fromCustom(args: LanguageDetectorArgs): Promise<string | null> {
		if (!this.options.findLocale) {
			throw new ReferenceError(
				"You tried to find a locale using `findLocale` but it is not defined. Change your order to not include `custom` or provide a findLocale functions.",
			);
		}
		let locales = await this.options.findLocale(args);
		if (!locales) return null;
		if (Array.isArray(locales)) return this.fromSupported(locales.join(","));
		return this.fromSupported(locales);
	}

	/**
	 * Match a locale against the configured supported languages.
	 */
	private fromSupported(language: string | null) {
		return (
			pick(this.options.supportedLanguages, language ?? this.options.fallbackLanguage, {
				loose: false,
			}) ||
			pick(this.options.supportedLanguages, language ?? this.options.fallbackLanguage, {
				loose: true,
			})
		);
	}
}
