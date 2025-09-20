import type { InitOptions, i18n, Module, NewableModule } from "i18next";
import { createInstance } from "i18next";
import type { MiddlewareFunction, RouterContextProvider } from "react-router";
import { createContext } from "react-router";
import type { LanguageDetectorOption } from "./lib/language-detector.js";
import { LanguageDetector } from "./lib/language-detector.js";

export function createI18nextMiddleware({
	detection,
	i18next = {},
	plugins = [],
}: createI18nextMiddleware.Options): createI18nextMiddleware.ReturnType {
	let localeContext = createContext<string>();
	let i18nextContext = createContext<i18n>();
	let languageDetector = new LanguageDetector(detection);

	return [
		async function i18nextMiddleware({ request, context }, next) {
			let lng = await languageDetector.detect(request);
			context.set(localeContext, lng);

			let instance = createInstance(i18next);
			for (const plugin of plugins ?? []) instance.use(plugin);
			await instance.init({ lng });
			context.set(i18nextContext, instance);

			return await next();
		},
		(context) => context.get(localeContext),
		(context) => context.get(i18nextContext),
	];
}

export namespace createI18nextMiddleware {
	export interface Options {
		/**
		 * The i18next options used to initialize the internal i18next instance.
		 */
		i18next?: Omit<InitOptions, "detection">;
		/**
		 * The i18next plugins used to extend the internal i18next instance
		 * when creating a new TFunction.
		 */
		plugins?: NewableModule<Module>[] | Module[];
		detection: LanguageDetectorOption;
	}

	export type ReturnType = [
		MiddlewareFunction<Response>,
		(context: Readonly<RouterContextProvider>) => string,
		(context: Readonly<RouterContextProvider>) => i18n,
	];
}
