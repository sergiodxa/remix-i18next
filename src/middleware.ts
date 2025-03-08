import { Namespace, TFunction } from "i18next";
import {
	type unstable_MiddlewareFunction,
	type unstable_RouterContextProvider,
	unstable_createContext,
} from "react-router";
import { RemixI18Next } from "./server.js";

export type unstable_GetFixedTFunction<
	Ns extends Namespace = "translation",
	KPrefix = undefined,
> = (
	context: unstable_RouterContextProvider,
	namespaces?: Ns,
	keyPrefix?: KPrefix,
) => Promise<TFunction<Ns, KPrefix>>;

export type unstable_GetLocaleFunction = (
	context: unstable_RouterContextProvider,
) => string;

export type unstable_createI18nextMiddlewareReturnType<
	Ns extends Namespace = "translation",
	KPrefix = undefined,
> = [
	unstable_MiddlewareFunction<Response>,
	unstable_GetFixedTFunction<Ns, KPrefix>,
	unstable_GetLocaleFunction,
];

export function unstable_createI18nextMiddleware(
	i18n: RemixI18Next,
): unstable_createI18nextMiddlewareReturnType {
	const localeContext = unstable_createContext<string>();
	return [
		async function i18nextMiddleware({ request, context }, next) {
			let locale = await i18n.getLocale(request);
			context.set(localeContext, locale);
			return await next();
		},

		async function getFixedT(context, ns, keyPrefix) {
			return i18n.getFixedT(context.get(localeContext), ns, { keyPrefix });
		},

		function getLocale(context) {
			return context.get(localeContext);
		},
	];
}
