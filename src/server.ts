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
import type { EntryContext } from "react-router";
import {
	LanguageDetector,
	type LanguageDetectorOption,
} from "./lib/language-detector.js";

type FallbackNs<Ns> = Ns extends undefined
	? DefaultNamespace
	: Ns extends Namespace
		? Ns
		: DefaultNamespace;

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

export { LanguageDetector };
export type { LanguageDetectorOption };
