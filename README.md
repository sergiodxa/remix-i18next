# remix-i18next

**The easiest way to translate your Remix apps.**

## Why remix-i18next?

- Easy to set up, easy to use: setup only takes a few steps, and configuration is simple.
- No other requirements: `remix-i18next` simplifies internationalisation for your Remix app without extra dependencies.
- Production ready: `remix-i18next` supports passing translations and configuration options into routes from the loader.
- Take the control: `remix-i18next` doesn't hide the configuration so you can add any plugin you want or configure as pleased.

## Setup

### Installation

The first step is to install it in your project with

```sh
npm install remix-i18next i18next react-i18next i18next-browser-languagedetector
```

You will need to configure an i18next backend and language detector, in that case you can install them too, for the rest of the setup guide we'll use the http and fs backends.

```sh
npm install i18next-http-backend i18next-fs-backend
```

### Configuration

First let's create some translation files

`public/locales/en/common.json`:

```json
{
  "greeting": "Hello"
}
```

`public/locales/es/common.json`:

```json
{
  "greeting": "Hola"
}
```

Next, set your [i18next configuration](https://www.i18next.com/overview/configuration-options).

These two files can go somewhere in your app folder.

For this example, we will create `app/i18n.ts`:

```ts
export default {
  // This is the list of languages your application supports
  supportedLngs: ["en", "es"],
  // This is the language you want to use in case
  // if the user language is not in the supportedLngs
  fallbackLng: "en",
  // The default namespace of i18next is "translation", but you can customize it here
  defaultNS: "common",
  // Disabling suspense is recommended
  react: { useSuspense: false },
};
```

And then create a file named `i18next.server.ts` with the following code:

```ts
import Backend from "i18next-fs-backend";
import { resolve } from "node:path";
import { RemixI18Next } from "remix-i18next";
import i18n from "~/i18n"; // your i18n configuration file

let i18next = new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
  },
  // This is the configuration for i18next used
  // when translating messages server-side only
  i18next: {
    ...i18n,
    backend: {
      loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json"),
    },
  },
  // The i18next plugins you want RemixI18next to use for `i18n.getFixedT` inside loaders and actions.
  // E.g. The Backend plugin for loading translations from the file system
  // Tip: You could pass `resources` to the `i18next` configuration and avoid a backend here
  plugins: [Backend],
});

export default i18next;
```

### Client-side configuration

Now in your `entry.client.tsx` replace the default code with this:

```tsx
import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import i18n from "./i18n";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { getInitialNamespaces } from "remix-i18next";

async function hydrate() {
  await i18next
    .use(initReactI18next) // Tell i18next to use the react-i18next plugin
    .use(LanguageDetector) // Setup a client-side language detector
    .use(Backend) // Setup your backend
    .init({
      ...i18n, // spread the configuration
      // This function detects the namespaces your routes rendered while SSR use
      ns: getInitialNamespaces(),
      backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
      detection: {
        // Here only enable htmlTag detection, we'll detect the language only
        // server-side with remix-i18next, by using the `<html lang>` attribute
        // we can communicate to the client the language detected server-side
        order: ["htmlTag"],
        // Because we only use htmlTag, there's no reason to cache the language
        // on the browser, so we disable it
        caches: [],
      },
    });

  startTransition(() => {
    hydrateRoot(
      document,
      <I18nextProvider i18n={i18next}>
        <StrictMode>
          <RemixBrowser />
        </StrictMode>
      </I18nextProvider>
    );
  });
}

if (window.requestIdleCallback) {
  window.requestIdleCallback(hydrate);
} else {
  // Safari doesn't support requestIdleCallback
  // https://caniuse.com/requestidlecallback
  window.setTimeout(hydrate, 1);
}
```

### Server-side configuration

And in your `entry.server.tsx` replace the code with this:

```tsx
import { PassThrough } from "stream";
import type { EntryContext } from "@remix-run/node";
import { Response } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import isbot from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { createInstance } from "i18next";
import i18next from "./i18next.server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-fs-backend";
import i18n from "./i18n"; // your i18n configuration file
import { resolve } from "node:path";

const ABORT_DELAY = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  let callbackName = isbot(request.headers.get("user-agent"))
    ? "onAllReady"
    : "onShellReady";

  let instance = createInstance();
  let lng = await i18next.getLocale(request);
  let ns = i18next.getRouteNamespaces(remixContext);

  await instance
    .use(initReactI18next) // Tell our instance to use react-i18next
    .use(Backend) // Setup our backend
    .init({
      ...i18n, // spread the configuration
      lng, // The locale we detected above
      ns, // The namespaces the routes about to render wants to use
      backend: { loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json") },
    });

  return new Promise((resolve, reject) => {
    let didError = false;

    let { pipe, abort } = renderToPipeableStream(
      <I18nextProvider i18n={instance}>
        <RemixServer context={remixContext} url={request.url} />
      </I18nextProvider>,
      {
        [callbackName]: () => {
          let body = new PassThrough();

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(body, {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          didError = true;

          console.error(error);
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
```

### Usage

Now, in your `app/root.tsx` or `app/root.jsx` file create a loader if you don't have one with the following code.

```tsx
import { useChangeLanguage } from "remix-i18next";
import { useTranslation } from "react-i18next";
import i18next from "~/i18next.server";

export async function loader({ request }: LoaderArgs) {
  let locale = await i18next.getLocale(request);
  return json({ locale });
}

export let handle = {
  // In the handle export, we can add a i18n key with namespaces our route
  // will need to load. This key can be a single string or an array of strings.
  // TIP: In most cases, you should set this to your defaultNS from your i18n config
  // or if you did not set one, set it to the i18next default namespace "translation"
  i18n: "common",
};

export default function Root() {
  // Get the locale from the loader
  let { locale } = useLoaderData<typeof loader>();

  let { i18n } = useTranslation();

  // This hook will change the i18n instance language to the current locale
  // detected by the loader, this way, when we do something to change the
  // language, this locale will change and i18next will load the correct
  // translation files
  useChangeLanguage(locale);

  return (
    <html lang={locale} dir={i18n.dir()}>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
```

> **Warning** In latest versions you may find an error with `useChangeLanguage` hook, (see [#107](https://github.com/sergiodxa/remix-i18next/issues/107)), to solve it, copy the code of `useChangeLanguage` to your own app and use it instead of the one provided by `remix-i18next`.

```ts
export function useChangeLanguage(locale: string) {
  let { i18n } = useTranslation();
  useEffect(() => {
    i18n.changeLanguage(locale);
  }, [locale, i18n]);
}
```

Finally, in any route you want to translate, you can use the `t()` function, as per the [i18next documentation](https://www.i18next.com/overview/api#t) and use translations from the default namespace.

```tsx
import { useTranslation } from "react-i18next";

export default function Component() {
  let { t } = useTranslation();
  return <h1>{t("greeting")}</h1>;
}
```

If you wish to split up your translation files, you create new translation files
like:

`public/locales/en/home.json`

```json
{
  "title": "remix-i18n is awesome"
}
```

`public/locales/es/home.json`

```json
{
  "title": "remix-i18n es increíble"
}
```

And use them in your routes:

```tsx
import { useTranslation } from "react-i18next";

// This tells remix to load the "home" namespace
export let handle = { i18n: "home" };

export default function Component() {
  let { t } = useTranslation("home");
  return <h1>{t("title")}</h1>;
}
```

And that's it, repeat the last step for each route you want to translate, remix-i18next will automatically let i18next what namespaces and language to use and this one will load the correct translation files using your configured backend.

#### Translating text inside loaders or actions

If you need to get translated texts inside a loader or action function, for example to translate the page title used later in a MetaFunction, you can use the `i18n.getFixedT` method to get a `t` function.

```ts
export async function loader({ request }: LoaderArgs) {
  let t = await i18n.getFixedT(request);
  let title = t("My page title");
  return json({ title });
}

export let meta: MetaFunction = ({ data }) => {
  return { title: data.title };
};
```

The `getFixedT` function can be called using a combination of parameters:

- `getFixedT(request)`: will use the request to get the locale and the `defaultNS` set in the config or `translation` (the [i18next default namespace](https://www.i18next.com/overview/configuration-options#languages-namespaces-resources))
- `getFixedT("es")`: will use the specified `es` locale and the `defaultNS` set in config, or `translation` (the [i18next default namespace](https://www.i18next.com/overview/configuration-options#languages-namespaces-resources))
- `getFixedT(request, "common")` will use the request to get the locale and the specified `common` namespace to get the translations.
- `getFixedT("es", "common")` will use the specified `es` locale and the specified `common` namespace to get the translations.
- `getFixedT(request, "common", { keySeparator: false })` will use the request to get the locale and the `common` namespace to get the translations, also use the options of the third argument to initialize the i18next instance.
- `getFixedT("es", "common", { keySeparator: false })` will use the specified `es` locale and the `common` namespace to get the translations, also use the options of the third argument to initialize the i18next instance.

If you always need to set the same i18next options, you can pass them to RemixI18Next when creating the new instance.

```ts
export let i18n = new RemixI18Next({
  detection: { supportedLanguages: ["es", "en"], fallbackLanguage: "en" },
  // The config here will be used for getFixedT
  i18next: {
    backend: { loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json") },
  },
  // This backend will be used by getFixedT
  backend: Backend,
});
```

This options will be overwritten by the options provided to `getFixedT`.
