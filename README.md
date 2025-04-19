# remix-i18next

**The easiest way to translate your React Router framework mode apps.**

> [!IMPORTANT]
> If you're still on Remix v2, keep using [remix-i18next v6](https://github.com/sergiodxa/remix-i18next/tree/v6.4.1) as the v7 is only compatible with React Router v7.

## Why remix-i18next?

- Easy to set up, easy to use: setup only takes a few steps, and configuration is simple.
- No other requirements: `remix-i18next` simplifies internationalisation for your React Router app without extra dependencies.
- Production ready: `remix-i18next` supports passing translations and configuration options into routes from the loader.
- Take the control: `remix-i18next` doesn't hide the configuration so you can add any plugin you want or configure as pleased.

## Setup

> [!TIP]
> Check https://github.com/sergiodxa/react-router-i18next-example for an example application, if you have an issue compare your setup with the example.

### Installation

The first step is to install it in your project with

```sh
npm install remix-i18next i18next react-i18next i18next-browser-languagedetector
```

You will need to configure an i18next backend and language detector, in that case you can install them too, for the rest of the setup guide we'll use the fetch backend.

```sh
npm install i18next-fetch-backend
```

### Localization files

First let's create some translation files in `app/locales`:

```ts
// app/locales/en.ts
export default {
  title: "remix-i18next (en)",
  description: "A Remix + Vite + remix-i18next example",
};
```

```ts
// app/locales/es.ts
import type en from "./en";

export default {
  title: "remix-i18next (es)",
  description: "Un ejemplo de Remix + Vite + remix-i18next",
} satisfies typeof en;
```

The type import and the `satisfies` are optional, but it will help us ensure that if we add or remove a key from the `en` locale (our default one) we will get a type error in the `es` locale so we can keep them in sync.

### Setup the Middleware

Create a file named `app/middleware/i18next.ts` with the following code:

> [!CAUTION]
> This depends on `react-router@7.3.0` or later, and it's considered unstable until React Router middleware feature itself is considered stable. Breaking changes may happen in minor versions.
> Check older versions of the README for a guide on how to use RemixI18next class instead if you are using an older version of React Router or don't want to use the middleware.

```ts
import { unstable_createI18nextMiddleware } from "remix-i18next/middleware";
import en from "~/locales/en";
import es from "~/locales/es";

export const [i18nextMiddleware, getLocale, getInstance] =
  unstable_createI18nextMiddleware({
    detection: {
      supportedLanguages: ["en", "es"],
      fallbackLanguage: "en",
    },
    i18next: {
      resources: { en: { translation: en }, es: { translation: es } },
      // Other i18next options are available here
    },
  });
```

Then in your `app/root.tsx` setup the middleware:

```ts
import { i18nextMiddleware } from "~/middleware/i18next";

export const unstable_middleware = [i18nextMiddleware];
```

With this, on every request, the middleware will run, detect the language and set it in the router context.

You can access the language in your loaders and actions using `getLocale(context)` function.

If you need access to the underlying i18next instance, you can use `getInstance(context)`. This is useful if you want to call the `t` function or any other i18next method.

### Get the locale

From this point, you can go to any loader and get the locale using the `getLocale` function.

```ts
import { getLocale } from "~/middleware/i18next";

export async function loader({ context }: Route.LoaderArgs) {
  let locale = getLocale(context);
  let date = new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return { date };
}
```

### Send translated text to the UI

To send translated text to the UI, you can use the `t` function from i18next. You can get it from the context using `getInstance(context)`.

```ts
import { getInstance } from "~/middleware/i18next";

export async function loader({ context }: Route.LoaderArgs) {
  let i18next = getInstance(context);
  return { title: i18next.t("title"), description: i18next.t("description") };
}
```

The `TFunction` accessible from the i18next instance is already configured with the locale detected by the middleware.

If you want to use a different locale, you can use the `i18next.getFixedT` method.

```ts
import { getInstance } from "~/middleware/i18next";

export async function loader({ context }: Route.LoaderArgs) {
  let i18next = getInstance(context);
  let t = i18next.getFixedT("es");
  return { title: t("title"), description: t("description") };
}
```

This will return a new `TFunction` instance with the locale set to `es`.

### Usage with react-i18next

So far this has configured the i18next instance to inside React Router loaders and actions, but in many cases we will need to use it directly in our React components.

To do this, we need to setup react-i18next.

Let's start by updating the `entry.client.tsx` and `entry.server.tsx` files to use the i18next instance created in the middleware.

> [!TIP]
> If you don't have these files, run `npx react-router reveal` to generate them. They are hidden by default.

### Update the root route

First of all, we want to send the locale detected serevr-side by the middleware to the UI. To do this, we will return the locale from the `app/root.tsx` route.

```tsx
import {
  data,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useChangeLanguage } from "remix-i18next/react";
import type { Route } from "./+types/root";
import {
  getLocale,
  i18nextMiddleware,
  localeCookie,
} from "./middleware/i18next";
import { useTranslation } from "react-i18next";

export const unstable_middleware = [i18nextMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  let locale = getLocale(context);
  return data(
    { locale },
    { headers: { "Set-Cookie": await localeCookie.serialize(locale) } }
  );
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

export default function App({ loaderData }: Route.ComponentProps) {
  useChangeLanguage(loaderData.locale);
  return <Outlet />;
}
```

We made a few changes here:

1. We added a `loader` that gets the locale from the context (set by the middleware) and returns it to the UI.
2. In the root Layout component, we use the `useTranslation` hook to get the i18n instance and set the `lang` attribute of the `<html>` tag, along the `dir` attribute.
3. We added the `useChangeLanguage` hook to set the language in the i18next instance, this will keep the language in sync with the locale detected by the middleware after a refresh of the loader data.

#### Client-side configuration

Now in your `entry.client.tsx` replace the default code with this:

```tsx
import Fetch from "i18next-fetch-backend";
import i18next from "i18next";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { HydratedRouter } from "react-router/dom";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { getInitialNamespaces } from "remix-i18next/client";

async function main() {
  await i18next
    .use(initReactI18next)
    .use(Fetch)
    .use(I18nextBrowserLanguageDetector)
    .init({
      fallbackLng: "en",
      ns: getInitialNamespaces(),
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
      </I18nextProvider>
    );
  });
}

main().catch((error) => console.error(error));
```

The `getInitialNamespaces` function from `remix-i18next/client` will return the namespaces that were used in the server-side rendering. This way, we can load them on the client-side before rendering the app.

We're also configuring `i18next-browser-languagedetector` to detect the language based on the `lang` attribute of the `<html>` tag. This way, we can use the same language detected by the middleware server-side.

### API for locales

The `app/entry.client.tsx` has the i18next backend configured to load the locales from the path `/api/locales/{{lng}}/{{ns}}`. Feel free to customize this but for this guide we will use that path.

Now we need to create a route to serve the locales. So let's create a file `app/routes/locales.ts` and add the following code:

```ts
import { data } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { z } from "zod";
import enTranslation from "~/locales/en";
import esTranslation from "~/locales/es";
import type { Route } from "./+types/locales";

const resources = {
  en: { translation: enTranslation },
  es: { translation: esTranslation },
};

export async function loader({ params }: Route.LoaderArgs) {
  const lng = z
    .string()
    .refine((lng): lng is keyof typeof resources =>
      Object.keys(resources).includes(lng)
    )
    .safeParse(params.lng);

  if (lng.error) return data({ error: lng.error }, { status: 400 });

  const namespaces = resources[lng.data];

  const ns = z
    .string()
    .refine((ns): ns is keyof typeof namespaces => {
      return Object.keys(resources[lng.data]).includes(ns);
    })
    .safeParse(params.ns);

  if (ns.error) return data({ error: ns.error }, { status: 400 });

  const headers = new Headers();

  // On production, we want to add cache headers to the response
  if (process.env.NODE_ENV === "production") {
    headers.set(
      "Cache-Control",
      cacheHeader({
        maxAge: "5m", // Cache in the browser for 5 minutes
        sMaxage: "1d", // Cache in the CDN for 1 day
        // Serve stale content while revalidating for 7 days
        staleWhileRevalidate: "7d",
        // Serve stale content if there's an error for 7 days
        staleIfError: "7d",
      })
    );
  }

  return data(namespaces[ns.data], { headers });
}
```

This file introduces two dependencies

1. [Zod](https://zod.dev/) for validating the parameters passed to the route.
2. [pretty-cache-header](https://npm.im/pretty-cache-header) for generating cache headers.

They are not hard requirements, but they are useful for our example, feel free to change them or remove them.

### Server-side configuration

Now in your `entry.server.tsx` replace the default code with this:

```tsx
import { PassThrough } from "node:stream";

import type {
  EntryContext,
  unstable_RouterContextProvider,
} from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { getInstance } from "./middleware/i18next";

export const streamTimeout = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  entryContext: EntryContext,
  routerContext: unstable_RouterContextProvider
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");

    let readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || entryContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";

    let { pipe, abort } = renderToPipeableStream(
      <I18nextProvider i18n={getInstance(routerContext)}>
        <ServerRouter context={entryContext} url={request.url} />
      </I18nextProvider>,
      {
        [readyOption]() {
          shellRendered = true;
          let body = new PassThrough();
          let stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) console.error(error);
        },
      }
    );

    setTimeout(abort, streamTimeout + 1000);
  });
}
```

Here we are using the `getInstance` function from the middleware to get the i18next instance.

This way, we can re-use the instance created in the middleware and avoid creating a new one. And since the instance is already configured with the language we detected, we can use it directly in the `I18nextProvider`.

## Finding the locale from the request URL pathname

If you want to keep the user locale on the pathname, you have two possible options.

First option is to ignore the locale detected by the middleware and manually grab the locale from the URL pathname.

Second options is to pass a `findLocale` function to the detection options in the middleware.

```ts
import { unstable_createI18nextMiddleware } from "remix-i18next/middleware";

export const [i18nextMiddleware, getLocale, getInstance] =
  unstable_createI18nextMiddleware({
    detection: {
      supportedLanguages: ["es", "en"],
      fallbackLanguage: "en",
      findLocale(request) {
        let locale = request.url.pathname.split("/").at(1);
        return locale;
      },
    },
    i18next: {
      resources: { en: { translation: en }, es: { translation: es } },
    },
  });
```

The locale returned by `findLocale` will be validated against the list of supported locales, in case it's not valid the fallback locale will be used.

## Querying the locale from the database

If your application stores the user locale in the database, you can use `findLocale` function to query the database and return the locale.

```ts
export let i18n = new RemixI18Next({
  detection: {
    supportedLanguages: ["es", "en"],
    fallbackLanguage: "en",
    async findLocale(request) {
      let user = await db.getUser(request);
      return user.locale;
    },
  },
});
```

## Store the locale in a cookie

If you want to store the locale in a cookie, you can create a cookie using `createCookie` helper from React Router and pass the Cookie object to the middleware.

```ts
import { createCookie } from "react-router";

export const localeCookie = createCookie("lng", {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
});
```

Then you can pass the cookie to the middleware:

```ts
import { unstable_createI18nextMiddleware } from "remix-i18next/middleware";
import { localeCookie } from "~/cookies";

export const [i18nextMiddleware, getLocale, getInstance] =
  unstable_createI18nextMiddleware({
    detection: {
      supportedLanguages: ["es", "en"],
      fallbackLanguage: "en",
      cookie: localeCookie,
    },
    i18next: {
      resources: { en: { translation: en }, es: { translation: es } },
    },
  });
```

now the middleware will read the locale from the cookie, if it exists, and set it in the context. If the cookie doesn't exist, it will use the Accept-Language header or the fallback language.

Then in your routes, you can use this cookie to save the user preference, a simple way is to navigate the user to the same URL with `?lng=es` (replacing `es` with the desired language) and then in the `app/root.tsx` route set the cookie with the new value.

```ts
import { data } from "react-router";
import { localeCookie } from "~/cookies";
import { getLocale } from "~/middleware/i18next";

export async function loader({ context }: Route.LoaderArgs) {
  let locale = getLocale(context);
  return data(
    { locale },
    { headers: { "Set-Cookie": await localeCookie.serialize(locale) } }
  );
}
```

## Store the locale in the session

Similarly to the cookie, you can store the locale in the session. To do this, you can create a session using `createSessionStorage` helpers from React Router and pass the SessionStorage object to the middleware.

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

Then you can pass the session to the middleware:

```ts
import { unstable_createI18nextMiddleware } from "remix-i18next/middleware";
import { sessionStorage } from "~/session";

export const [i18nextMiddleware, getLocale, getInstance] =
  unstable_createI18nextMiddleware({
    detection: {
      supportedLanguages: ["es", "en"],
      fallbackLanguage: "en",
      sessionStorage,
    },
    i18next: {
      resources: { en: { translation: en }, es: { translation: es } },
    },
  });
```

Now the middleware will read the locale from the session, if it exists, and set it in the context. If the session doesn't exist, it will use the Accept-Language header or the fallback language.

Then in your routes, you can use this session to save the user preference, a simple way is to navigate the user to the same URL with `?lng=es` (replacing `es` with the desired language) and then in the `app/root.tsx` route set the session with the new value.

```ts
import { data } from "react-router";
import { sessionStorage } from "~/session";
import { getLocale } from "~/middleware/i18next";

export async function loader({ request, context }: Route.LoaderArgs) {
  let locale = getLocale(context);

  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  session.set("lng", locale);

  return data(
    { locale },
    { headers: { "Set-Cookie": await sessionStorage.commitSession(session) } }
  );
}
```
