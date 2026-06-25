# remix-i18next

**Translate React Router framework mode apps with server-side i18next.**

> [!IMPORTANT]
> If you're on Remix v2, use [v6](https://github.com/sergiodxa/remix-i18next/tree/v6.4.1).
> If you're on React Router v7, use [v7](https://github.com/sergiodxa/remix-i18next/releases/tag/v7.5.0).
> v8 is for React Router v8.

> [!NOTE]
> For React Router SPA Mode, use `react-i18next` directly.

## Quick Start

> [!TIP]
> See https://github.com/sergiodxa/react-router-i18next-example for a full example.

### Install

Install the packages that handle translation state, React bindings, and language detection first.

```sh
npm install remix-i18next i18next react-i18next i18next-browser-languagedetector
```

If you want the browser to load translation files on demand, you also need an i18next backend. The example below uses the fetch backend because it works well with a route that serves locale data.

```sh
npm install i18next-fetch-backend
```

### Add locales

Start by defining a default locale and at least one additional locale. Keep the default locale as the source of truth so TypeScript can help you keep the rest of the translations aligned.

First define the default locale.

```ts
// app/locales/en/translation.ts
export default {
	title: "remix-i18next (en)",
	description: "A React Router + remix-i18next example",
};

// app/locales/en/index.ts
import type { ResourceLanguage } from "i18next";
import translation from "./translation";

export default { translation } satisfies ResourceLanguage;
```

Then add the translated locale and keep it structurally aligned with the default one.

```ts
// app/locales/es/translation.ts
export default {
	title: "remix-i18next (es)",
	description: "Un ejemplo de React Router + remix-i18next",
} satisfies typeof import("~/locales/en/translation").default;

// app/locales/es/index.ts
import type { ResourceLanguage } from "i18next";
import translation from "./translation";

export default { translation } satisfies ResourceLanguage;
```

Finally, re-export all locales from a single entry point.

```ts
// app/locales/index.ts
import type { Resource } from "i18next";
import en from "./en";
import es from "./es";

export default { en, es } satisfies Resource;
```

### Configure middleware

Next, create a middleware module that registers your resources, detection strategy, and the React i18next plugin. This is the shared i18next instance that the server, loaders, and React tree will all use.

Start by defining the middleware and wiring your locale resources into it.

```ts
// app/middleware/i18next.ts
import "i18next";
import { initReactI18next } from "react-i18next";
import { createI18nextMiddleware } from "remix-i18next";
import resources from "~/locales";

export const [i18nextMiddleware, getLocale, getInstance] = createI18nextMiddleware({
	detection: {
		supportedLanguages: ["es", "en"],
		fallbackLanguage: "en",
	},
	i18next: { resources },
	plugins: [initReactI18next],
});

declare module "i18next" {
	interface CustomTypeOptions {
		defaultNS: "translation";
		resources: typeof resources.en;
	}
}
```

Then register the middleware in the root route.

```ts
// app/root.tsx
import { i18nextMiddleware } from "~/middleware/i18next";

export const middleware = [i18nextMiddleware];
```

### Use it in loaders

Once the middleware is in place, loaders and actions can read the active locale from the router context and use the same configured i18next instance for translated strings.

```ts
import { getLocale, getInstance } from "~/middleware/i18next";

export async function loader({ context }: Route.LoaderArgs) {
	let locale = getLocale(context);
	let i18next = getInstance(context);

	return { locale, title: i18next.t("title") };
}
```

### Wire React

React needs the detected locale too, so the root route should return it, set the `<html>` attributes, and keep the client i18next instance in sync when navigation changes the locale.

```tsx
// app/root.tsx
import { useEffect } from "react";
import { data, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/root";
import { getLocale, i18nextMiddleware } from "./middleware/i18next";

export const middleware = [i18nextMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
	let locale = getLocale(context);
	return data({ locale });
}

export function Layout({ children }: { children: React.ReactNode }) {
	let { i18n } = useTranslation();

	return (
		<html lang={i18n.language} dir={i18n.dir(i18n.language)}>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App({ loaderData: { locale } }: Route.ComponentProps) {
	let { i18n } = useTranslation();

	useEffect(() => {
		if (i18n.language !== locale) i18n.changeLanguage(locale);
	}, [locale, i18n]);

	return <Outlet />;
}
```

### Hydrate on the client

The browser should hydrate with the same language the server picked. Use the `<html lang>` attribute as the client-side source of truth, then load translations from the route that serves locale data.

```tsx
import Fetch from "i18next-fetch-backend";
import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { HydratedRouter } from "react-router/dom";

async function main() {
	await i18next
		.use(initReactI18next)
		.use(Fetch)
		.use(I18nextBrowserLanguageDetector)
		.init({
			fallbackLng: "en",
			detection: { order: ["htmlTag"], caches: [] },
			backend: { loadPath: "/api/locales/{{lng}}/{{ns}}" },
		});

	startTransition(() => {
		hydrateRoot(
			document,
			<I18nextProvider i18n={i18next}>
				<StrictMode>
					<HydratedRouter />
				</StrictMode>
			</I18nextProvider>,
		);
	});
}

main().catch(console.error);
```

### Serve locales

This route serves translation JSON to the browser backend. Validating the language and namespace keeps bad requests from leaking through, and cache headers make locale assets cheap to serve in production.

```ts
import { data } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { z } from "zod";
import resources from "~/locales";
import type { Route } from "./+types/locales";

export async function loader({ params }: Route.LoaderArgs) {
	const lng = z.enum(Object.keys(resources) as Array<keyof typeof resources>).safeParse(params.lng);
	if (lng.error) return data({ error: lng.error }, { status: 400 });

	const namespaces = resources[lng.data];
	const ns = z.enum(Object.keys(namespaces) as Array<keyof typeof namespaces>).safeParse(params.ns);
	if (ns.error) return data({ error: ns.error }, { status: 400 });

	const headers = new Headers();
	if (process.env.NODE_ENV === "production") {
		headers.set(
			"Cache-Control",
			cacheHeader({ maxAge: "5m", sMaxage: "1d", staleWhileRevalidate: "7d", staleIfError: "7d" }),
		);
	}

	return data(namespaces[ns.data], { headers });
}
```

Add `/api/locales/:lng/:ns` to your routes, and keep `backend.loadPath` in sync.

### Server entry

In `entry.server.tsx`, keep using your existing server rendering code, but wrap the router with `I18nextProvider` and pass `getInstance(routerContext)` into it. The important part is that the server uses the same i18next instance created by the middleware, so the language stays in sync during SSR.

This is the minimal change needed to make translated components work during server rendering without creating a second i18next instance.

```tsx
<I18nextProvider i18n={getInstance(routerContext)}>
	<ServerRouter context={routerContext} url={request.url} />
</I18nextProvider>
```

## Advanced

### Locale from the URL

If your app keeps the locale in the pathname, you can teach the middleware how to read it directly from the request URL. The middleware still validates the value against your supported languages and falls back when it is invalid.

```ts
export const [i18nextMiddleware, getLocale, getInstance] = createI18nextMiddleware({
	detection: {
		supportedLanguages: ["es", "en"],
		fallbackLanguage: "en",
		findLocale({ request }) {
			return new URL(request.url).pathname.split("/").at(1);
		},
	},
});
```

### Locale from the database

If the locale lives in user data, resolve it in `findLocale` before the middleware sets the request context. This lets loaders and actions keep using `getLocale(context)` without knowing where the preference came from.

```ts
export const [i18nextMiddleware, getLocale] = createI18nextMiddleware({
	detection: {
		supportedLanguages: ["es", "en"],
		fallbackLanguage: "en",
		async findLocale({ request }) {
			let user = await db.getUser(request);
			return user.locale;
		},
	},
});
```

### Locale in a cookie or session

Use `createCookie` or `createCookieSessionStorage` when you want the user preference to survive across requests. Pass the cookie or session storage to the middleware, then write the detected locale back in your loader or action so future requests can reuse it.

The cookie version is lighter when you just need a preference flag, while session storage is useful when the locale is part of a larger signed session payload.

Start with a cookie if all you need is a persisted language choice.

```ts
import { createCookie } from "react-router";

export const localeCookie = createCookie("lng", {
	path: "/",
	sameSite: "lax",
	secure: process.env.NODE_ENV === "production",
	httpOnly: true,
});
```

Use session storage when the locale should live with the rest of the user session data.

```ts
import { createCookieSessionStorage } from "react-router";

export const sessionStorage = createCookieSessionStorage({
	cookie: {
		name: "session",
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		httpOnly: true,
	},
});
```

Pass whichever storage you chose into the middleware.

```ts
import { createI18nextMiddleware } from "remix-i18next";
import { localeCookie } from "~/cookies";
import { sessionStorage } from "~/session";

export const [i18nextMiddleware, getLocale, getInstance] = createI18nextMiddleware({
	detection: {
		supportedLanguages: ["es", "en"],
		fallbackLanguage: "en",
		cookie: localeCookie,
		sessionStorage,
	},
});
```

Then persist the resolved locale in your loader or action.

```ts
import { data } from "react-router";
import { getLocale } from "~/middleware/i18next";
import { localeCookie } from "~/cookies";

export async function loader({ context }: Route.LoaderArgs) {
	let locale = getLocale(context);
	return data({ locale }, { headers: { "Set-Cookie": await localeCookie.serialize(locale) } });
}
```

If you use session storage instead of a cookie, commit the session in the same place after storing the locale.

```ts
import { data } from "react-router";
import { getLocale } from "~/middleware/i18next";
import { sessionStorage } from "~/session";

export async function loader({ request, context }: Route.LoaderArgs) {
	let locale = getLocale(context);
	let session = await sessionStorage.getSession(request.headers.get("Cookie"));
	session.set("lng", locale);

	return data(
		{ locale },
		{ headers: { "Set-Cookie": await sessionStorage.commitSession(session) } },
	);
}
```

### Custom 404 page

Create a `*` route, return `404`, and render a translated fallback page. This matters because unmatched requests do not hit the root route loader, so without a dedicated 404 route the server may not have the i18next instance ready and your error page can fail to render. With `fs-routes`, use `app/routes/$.tsx`; otherwise add a manual `route("*", ...)` entry.

This also keeps your localized error UI consistent with the rest of the app instead of falling back to an unstyled or untranslated default error page.

```tsx
import { useTranslation } from "react-i18next";
import { data, href, Link } from "react-router";

export async function loader() {
	return data(null, { status: 404 });
}

export default function Component() {
	let { t } = useTranslation("notFound");

	return (
		<div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
			<h1>{t("title")}</h1>
			<p>{t("description")}</p>
			<Link to={href("/")}>{t("backToHome")}</Link>
		</div>
	);
}
```

### Middleware Troubleshooting

The most common runtime error is `No value found for context`. It usually means the middleware was not registered, the route is not running through the root loader, or the server entry is not using the router context that the middleware populated.

Make sure the middleware is exported from the root route.

```ts
import { i18nextMiddleware } from "~/middleware/i18next";

export const middleware = [i18nextMiddleware];
```

Then make sure routes that need i18next data actually run through the root route. A custom 404 route is important here because unmatched requests can skip the normal root loader flow.

The app needs a custom server entry so the server can render with the same i18next instance created by the middleware.

```tsx
<I18nextProvider i18n={getInstance(routerContext)}>
	<ServerRouter context={routerContext} url={request.url} />
</I18nextProvider>
```

### Namespace Loading

As apps grow, it is common to split translations by feature or route instead of keeping everything in one namespace. That keeps locale files smaller and makes it easier to load only the translations each route needs.

One simple pattern is to group namespaces by route and load only the namespaces that route needs. This is useful when the loader itself needs translated strings.

```ts
import { data } from "react-router";
import { getInstance } from "~/middleware/i18next";

export async function loader({ context }: Route.LoaderArgs) {
	let i18next = getInstance(context);

	await i18next.loadNamespaces(["dashboard", "common"]);

	return data({
		pageTitle: i18next.t("dashboard:title"),
	});
}
```

If you want to keep route namespaces in sync with your route tree, use a helper that maps route IDs to namespaces and call `loadNamespaces` in the root loader before rendering children.

If you need those namespaces in React, call `useTranslation(namespace)` in the component. i18next will load the namespace and suspend the component until it is ready.

### Language Switching

Users often want to change language without manually editing cookies or sessions. The usual pattern is to make the switcher update the chosen locale in the URL or a form submission, then let your loader or action persist it.

If you keep locale in a cookie, the switcher can submit the new locale and let the loader serialize it back.

```tsx
import { Form } from "react-router";

export function LanguageSwitcher() {
	return (
		<Form method="post">
			<button type="submit" name="lng" value="en">English</button>
			<button type="submit" name="lng" value="es">Espanol</button>
		</Form>
	);
}
```

If you keep locale in the pathname, switching languages usually means navigating to the same route with a different locale prefix.

```tsx
import { Link } from "react-router";

export function LanguageSwitcher() {
	return (
		<nav>
			<Link to="/en">English</Link>
			<Link to="/es">Espanol</Link>
		</nav>
	);
}
```

### SSR and Deployment

The server runtime should be able to read the translation source of truth for your app. That can mean reading files from disk, fetching translation JSON from a URL, or loading resources from memory through the `resources` option in i18next.

When you deploy to a platform with edge or serverless rendering, keep these rules in mind:

1. Make sure the server runtime can access the translations it needs.
2. Keep the client `loadPath` in sync with the source you use on the server.
3. Use the server to resolve locale, then let the browser read `<html lang>` during hydration.

If you cache translation responses, cache them by locale and namespace so the browser and CDN can reuse them safely.

### Error Pages

Translated error pages are worth documenting because they often need to work when the rest of the route tree does not. A custom 404 or error boundary should still be able to read the locale and render translated content.

The root `ErrorBoundary` is a special case: if the root loader failed, you may not know the user locale anymore. In that case, treat it like a 500-level failure and fall back to a safe default locale. Ideally this boundary never renders.

```tsx
import { useTranslation } from "react-i18next";

export function ErrorBoundary() {
	let { t } = useTranslation("errors");

	return <h1>{t("unexpected")}</h1>;
}
```

### Meta

If your titles and descriptions are localized, return the translated values from the loader and read them from `loaderData` inside `meta`.

```ts
import { data } from "react-router";
import { getInstance } from "~/middleware/i18next";
import type { Route } from "./+types/root";

export async function loader({ context }: Route.LoaderArgs) {
	let i18next = getInstance(context);
	return data({
		title: i18next.t("title"),
		description: i18next.t("description"),
	});
}

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{ title: loaderData?.title },
		{ name: "description", content: loaderData?.description },
	];
}
```

## Related examples

- [with Locize](https://github.com/locize/locize-react-router-example) - Use remix-i18next with Locize as backend.
