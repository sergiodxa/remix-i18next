import type {
	Cookie,
	EntryContext,
	SessionStorage,
} from "@remix-run/server-runtime";
import {
	type BackendModule,
	type DefaultNamespace,
	type FlatNamespace,
	type InitOptions,
	type KeyPrefix,
	type Module,
	type Namespace,
	type NewableModule,
	type TFunction,
	createInstance,
} from "i18next";
import { getClientLocales } from "./lib/get-client-locales.js";
import { pick } from "./lib/parser.js";

type FallbackNs<Ns> = Ns extends undefined
	? DefaultNamespace
	: Ns extends Namespace
		? Ns
		: DefaultNamespace;

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
	 * A function that can be used to find the locale based on the request object
	 * using any custom logic you want.
	 * This can be useful to get the locale from the URL pathname, or to query it
	 * from the database or fetch it from an API.
	 * @param request The request object received by the server.
	 */
	findLocale?(request: Request): Promise<string | Array<string> | null>;
}

export interface RemixI18NextOption {
	/**
	 * The i18next options used to initialize the internal i18next instance.
	 */
	i18next?: Omit<InitOptions, "react" | "detection"> | null;
	/**
	 * @deprecated Use `plugins` instead.
	 * The i18next backend module used to load the translations when creating a
	 * new TFunction.
	 */
	backend?: NewableModule<BackendModule<unknown>> | BackendModule<unknown>;
	/**
	 * The i18next plugins used to extend the internal i18next instance
	 * when creating a new TFunction.
	 */
	plugins?: NewableModule<Module>[] | Module[];
	detection: LanguageDetectorOption;
}

export class RemixI18Next {
	private detector: LanguageDetector;

	constructor(private options: RemixI18NextOption) {
		this.detector = new LanguageDetector(this.options.detection);
	}

	/**
	 * Detect the current locale by following the order defined in the
	 * `detection.order` option.
	 * By default the order is
	 * - searchParams
	 * - cookie
	 * - session
	 * - header
	 * And finally the fallback language.
	 */
	public async getLocale(request: Request): Promise<string> {
		return this.detector.detect(request);
	}

	/**
	 * Get the namespaces required by the routes which are going to be rendered
	 * when doing SSR.
	 *
	 * @param context The EntryContext object received by `handleRequest` in entry.server
	 *
	 * @example
	 * await instance.init({
	 *   ns: i18n.getRouteNamespaces(context),
	 *   // ...more options
	 * });
	 */
	public getRouteNamespaces(context: EntryContext): string[] {
		let namespaces = Object.values(context.routeModules).flatMap((route) => {
			if (typeof route?.handle !== "object") return [];
			if (!route.handle) return [];
			if (!("i18n" in route.handle)) return [];
			if (typeof route.handle.i18n === "string") return [route.handle.i18n];
			if (
				Array.isArray(route.handle.i18n) &&
				route.handle.i18n.every((value) => typeof value === "string")
			) {
				return route.handle.i18n as string[];
			}
			return [];
		});

		return [...new Set(namespaces)];
	}

	/**
	 * Return a TFunction that can be used to translate strings server-side.
	 * This function is fixed to a specific namespace.
	 *
	 * @param requestOrLocale The request object or the locale string already detected
	 * @param namespaces The namespaces to use for the T function. (Default: `translation`).
	 * @param options The i18next init options and the key prefix to prepend to translation keys.
	 */
	async getFixedT<
		N extends
			| FlatNamespace
			| readonly [FlatNamespace, ...FlatNamespace[]] = DefaultNamespace,
		KPrefix extends KeyPrefix<FallbackNs<N>> = undefined,
	>(
		locale: string,
		namespaces?: N,
		options?: Omit<InitOptions, "react"> & { keyPrefix?: KPrefix },
	): Promise<TFunction<FallbackNs<N>, KPrefix>>;
	async getFixedT<
		N extends
			| FlatNamespace
			| readonly [FlatNamespace, ...FlatNamespace[]] = DefaultNamespace,
		KPrefix extends KeyPrefix<FallbackNs<N>> = undefined,
	>(
		request: Request,
		namespaces?: N,
		options?: Omit<InitOptions, "react"> & { keyPrefix?: KPrefix },
	): Promise<TFunction<FallbackNs<N>, KPrefix>>;
	async getFixedT<
		N extends
			| FlatNamespace
			| readonly [FlatNamespace, ...FlatNamespace[]] = DefaultNamespace,
		KPrefix extends KeyPrefix<FallbackNs<N>> = undefined,
	>(
		requestOrLocale: Request | string,
		namespaces?: N,
		options: Omit<InitOptions, "react"> & { keyPrefix?: KPrefix } = {},
	): Promise<TFunction<FallbackNs<N>, KPrefix>> {
		let [instance, locale] = await Promise.all([
			this.createInstance({ ...this.options.i18next, ...options }),
			typeof requestOrLocale === "string"
				? requestOrLocale
				: this.getLocale(requestOrLocale),
		]);

		await instance.changeLanguage(locale);

		if (namespaces) await instance.loadNamespaces(namespaces);
		else if (instance.options.defaultNS) {
			await instance.loadNamespaces(instance.options.defaultNS);
		} else await instance.loadNamespaces("translation" as DefaultNamespace);

		return instance.getFixedT<N, KPrefix, N>(
			locale,
			namespaces,
			options?.keyPrefix,
		);
	}

	private async createInstance(options: Omit<InitOptions, "react"> = {}) {
		let instance = createInstance();
		let plugins = [
			...(this.options.backend ? [this.options.backend] : []),
			...(this.options.plugins || []),
		];
		for (const plugin of plugins) instance.use(plugin);
		await instance.init(options);
		return instance;
	}
}

/**
 * The LanguageDetector contains the logic to detect the user preferred language
 * fully server-side by using a SessionStorage, Cookie, URLSearchParams, or
 * Headers.
 */
export class LanguageDetector {
	constructor(private options: LanguageDetectorOption) {
		this.isSessionOnly(options);
		this.isCookieOnly(options);
	}

	private isSessionOnly(options: LanguageDetectorOption) {
		if (
			options.order?.length === 1 &&
			options.order[0] === "session" &&
			!options.sessionStorage
		) {
			throw new Error(
				"You need a sessionStorage if you want to only get the locale from the session",
			);
		}
	}

	private isCookieOnly(options: LanguageDetectorOption) {
		if (
			options.order?.length === 1 &&
			options.order[0] === "cookie" &&
			!options.cookie
		) {
			throw new Error(
				"You need a cookie if you want to only get the locale from the cookie",
			);
		}
	}

	public async detect(request: Request): Promise<string> {
		let order = this.options.order ?? this.defaultOrder;

		for (let method of order) {
			let locale: string | null = null;

			if (method === "searchParams") {
				locale = this.fromSearchParams(request);
			}

			if (method === "cookie") {
				locale = await this.fromCookie(request);
			}

			if (method === "session") {
				locale = await this.fromSessionStorage(request);
			}

			if (method === "header") {
				locale = this.fromHeader(request);
			}

			if (method === "custom") {
				locale = await this.fromCustom(request);
			}

			if (locale) return locale;
		}

		return this.options.fallbackLanguage;
	}

	private get defaultOrder() {
		let order: Array<
			"searchParams" | "cookie" | "session" | "header" | "custom"
		> = ["searchParams", "cookie", "session", "header"];
		if (this.options.findLocale) order.unshift("custom");
		return order;
	}

	private fromSearchParams(request: Request): string | null {
		let url = new URL(request.url);
		if (!url.searchParams.has(this.options.searchParamKey ?? "lng")) {
			return null;
		}
		return this.fromSupported(
			url.searchParams.get(this.options.searchParamKey ?? "lng"),
		);
	}

	private async fromCookie(request: Request): Promise<string | null> {
		if (!this.options.cookie) return null;

		let cookie = this.options.cookie;
		let lng = await cookie.parse(request.headers.get("Cookie"));
		if (typeof lng !== "string" || !lng) return null;

		return this.fromSupported(lng);
	}

	private async fromSessionStorage(request: Request): Promise<string | null> {
		if (!this.options.sessionStorage) return null;

		let session = await this.options.sessionStorage.getSession(
			request.headers.get("Cookie"),
		);

		let lng = session.get(this.options.sessionKey ?? "lng");

		if (!lng) return null;

		return this.fromSupported(lng);
	}

	private fromHeader(request: Request): string | null {
		let locales = getClientLocales(request);
		if (!locales) return null;
		if (Array.isArray(locales)) return this.fromSupported(locales.join(","));
		return this.fromSupported(locales);
	}

	private async fromCustom(request: Request): Promise<string | null> {
		if (!this.options.findLocale) {
			throw new ReferenceError(
				"You tried to find a locale using `findLocale` but it iss not defined. Change your order to not include `custom` or provide a findLocale functions.",
			);
		}
		let locales = await this.options.findLocale(request);
		if (!locales) return null;
		if (Array.isArray(locales)) return this.fromSupported(locales.join(","));
		return this.fromSupported(locales);
	}

	private fromSupported(language: string | null) {
		return (
			pick(
				this.options.supportedLanguages,
				language ?? this.options.fallbackLanguage,
				{ loose: false },
			) ||
			pick(
				this.options.supportedLanguages,
				language ?? this.options.fallbackLanguage,
				{ loose: true },
			)
		);
	}
}
