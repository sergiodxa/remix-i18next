import type { InitOptions, i18n, Module, NewableModule } from "i18next";
import { createInstance } from "i18next";
import type {
	unstable_MiddlewareFunction,
	unstable_RouterContextProvider,
} from "react-router";
import { unstable_createContext } from "react-router";
import type { LanguageDetectorOption } from "./lib/language-detector.js";
import { LanguageDetector } from "./lib/language-detector.js";

export function unstable_createI18nextMiddleware({
	detection,
	i18next = {},
	plugins = [],
}: unstable_createI18nextMiddleware.Options): unstable_createI18nextMiddleware.ReturnType {
	let localeContext = unstable_createContext<string>();
	let i18nextContext = unstable_createContext<i18n>();
	let languageDetector = new LanguageDetector(detection);

	return [
		async function i18nextMiddleware({ request, context }, next) {
			let lng = await languageDetector.detect(request);
			context.set(localeContext, lng);

			let options = typeof i18next === "function" ? await i18next() : i18next;
			let instance = createInstance(options);
			for (const plugin of plugins ?? []) instance.use(plugin);
			await instance.init({ lng });
			context.set(i18nextContext, instance);

			return await next();
		},
		(context) => context.get(localeContext),
		(context) => context.get(i18nextContext),
	];
}

export namespace unstable_createI18nextMiddleware {
	export interface Options {
		/**
		 * The i18next options used to initialize the internal i18next instance.
		 * Can be an object or an async function that returns the options.
		 */
		i18next?:
			| Omit<InitOptions, "detection">
			| (() => Promise<Omit<InitOptions, "detection">>);
		/**
		 * The i18next plugins used to extend the internal i18next instance
		 * when creating a new TFunction.
		 */
		plugins?: NewableModule<Module>[] | Module[];
		detection: LanguageDetectorOption;
	}

	export type ReturnType = [
		unstable_MiddlewareFunction<Response>,
		(context: unstable_RouterContextProvider) => string,
		(context: unstable_RouterContextProvider) => i18n,
	];
}
