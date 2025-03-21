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
> If you're using Remix with Vite, check https://github.com/sergiodxa/remix-vite-i18next for an example application, if you have an issue compare your setup with the example.

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
};
```

And then create a file named `i18next.server.ts` with the following code:

```ts
import Backend from "i18next-fs-backend";
import { resolve } from "node:path";
import { RemixI18Next } from "remix-i18next/server";
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
import { getInitialNamespaces } from "remix-i18next/client";

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
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
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
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
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
import { useChangeLanguage } from "remix-i18next/react";
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

#### Using the `keyPrefix` option with `getFixedT`

The `getFixedT` function now supports a `keyPrefix` option, allowing you to prepend a prefix to your translation keys. This is particularly useful when you want to namespace your translations without having to specify the full key path every time.

Here's how you can use it:

```ts
export async function loader({ request }: LoaderArgs) {
  // Assuming "greetings" namespace and "welcome" keyPrefix
  let t = await i18n.getFixedT(request, "greetings", { keyPrefix: "welcome" });
  let message = t("user"); // This will look for the "welcome.user" key in your "greetings" namespace
  return json({ message });
}
```

This feature simplifies working with deeply nested translation keys and enhances the organization of your translation files.

#### Finding the locale from the request URL pathname

If you want to keep the user locale on the pathname, you have two possible options.

First option is to pass the param from the loader/action params to `getFixedT`. This way you will stop using the language detection features of remix-i18next.

Second options is to pass a `findLocale` function to the detection options in RemixI18Next.

```ts
export let i18n = new RemixI18Next({
  detection: {
    supportedLanguages: ["es", "en"],
    fallbackLanguage: "en",
    async findLocale(request) {
      let locale = request.url.pathname.split("/").at(1);
      return locale;
    },
  },
});
```

The locale returned by `findLocale` will be validated against the list of supported locales, in case it's not valid the fallback locale will be used.

#### Querying the locale from the database

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

Note that every call to `getLocale` and `getFixedT` will call `findLocale` so it's important to keep it as fast as possible.

If you need both the locale and the `t` function, you can call `getLocale`, and pass the result to `getFixedT`.

## Middleware (unstable)

> [!CAUTION]
> This depends on `react-router@7.3.0` or later, and it's considered unstable until React Router middleware feature itself is considered stable. Breaking changes may happen in minor versions.

Since React Router v7.3.0 you can use middlewares to run code before and after the routes loaders and actions. In remix-i18next a (unstable) middleware is provided to help you with using `getLocale` and `getFixedT`.

To use the middleware you need to create a middleware instance and pass it to the `RemixI18Next` instance.

```tsx
import { unstable_createI18nextMiddleware } from "remix-i18next/middleware";
import { i18n } from "~/i18next.server";

export const [i18nextMiddleware, getFixedT, getLocal] =
  unstable_createI18nextMiddleware(i18n);
```

Then in your root add the middleware.

```tsx
import { i18nextMiddleware } from "~/middlewares/i18next";
export const unstable_middleware = [i18nextMiddleware];
```

And in the root loader also return the locale.

```tsx
export async function loader({ context }: Route.LoaderArgs) {
  return { locale: getLocale(context) };
}
```

From now, you can call `getLocale` or `getFixedT` in your loaders and actions.

```tsx
// a random route loader
export async function loader({ context }: Route.LoaderArgs) {
  // namespace and keyPrefix are both optional
  let t = await getFixedT(context, namespace, keyPrefix);
  let title = t("My page title");
  return { title };
}
```
