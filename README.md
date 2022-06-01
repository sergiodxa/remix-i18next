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
npm install remix-i18next i18next react-i18next i18next-http-backend i18next-fs-backend i18next-browser-languagedetector
```

If you're going to use TypeScript it is recommended to install `@types/i18next-fs-backend` as well:

```sh
npm install --save-dev @types/i18next-fs-backend
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
    supportedLngs: ['en', 'es'],
    // This is the language you want to use in case
    // if the user language is not in the supportedLngs
    fallbackLng: 'en',
    // The default namespace of i18next is "translation", but you can customize it here
    defaultNS: 'common',
    // Disabling suspense is recommended
    react: {useSuspense: false},
};
```

And then create a file named `i18next.server.ts` with the following code:

```ts
import Backend from 'i18next-fs-backend';
import { resolve } from 'node:path';
import { RemixI18Next } from 'remix-i18next';
import i18n from '~/i18n'; // your i18n configuration file

let i18next = new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
  },
  // This is the configuration for i18next used
  // when translating messages server-side only
  i18next: {
    backend: {
      loadPath: resolve('./public/locales/{{lng}}/{{ns}}.json'),
    },
  },
  // The backend you want to use to load the translations
  // Tip: You could pass `resources` to the `i18next` configuration and avoid
  // a backend here
  backend: Backend,
});

export default i18next;
```

### Client-side configuration

Now in your `entry.client.tsx` replace the default code with this:

```tsx
import { RemixBrowser } from '@remix-run/react';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { hydrate } from 'react-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { getInitialNamespaces } from 'remix-i18next';
import i18n from './i18n'; // your i18n configuration file

i18next
  .use(initReactI18next) // Tell i18next to use the react-i18next plugin
  .use(LanguageDetector) // Setup a client-side language detector
  .use(Backend) // Setup your backend
  .init({
    ...i18n, // spread the configuration
    // This function detects the namespaces your routes rendered while SSR use
    ns: getInitialNamespaces(),
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      // Here only enable htmlTag detection, we'll detect the language only
      // server-side with remix-i18next, by using the `<html lang>` attribute
      // we can communicate to the client the language detected server-side
      order: ["htmlTag"],
      // Because we only use htmlTag, there's no reason to cache the language
      // on the browser, so we disable it
      caches: [],
    },
  })
  .then(() => {
    // After i18next has been initialized, we can hydrate the app
    // We need to wait to ensure translations are loaded before the hydration
    // Here wrap RemixBrowser in I18nextProvider from react-i18next
    return hydrate(
      <I18nextProvider i18n={i18next}>
        <RemixBrowser />
      </I18nextProvider>,
      document
    );
  });
```

### Server-side configuration

And in your `entry.server.tsx` replace the code with this:

```tsx
import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/server-runtime";
import { createInstance } from "i18next";
import Backend from "i18next-fs-backend";
import { resolve } from "node:path";
import { renderToString } from "react-dom/server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18next from "./i18next.server";
import i18n from './i18n'; // your i18n configuration file

export default async function handleRequest(
  request: Request,
  statusCode: number,
  headers: Headers,
  context: EntryContext
) {
  // First, we create a new instance of i18next so every request will have a
  // completely unique instance and not share any state
  let instance = createInstance();

  // Then we could detect locale from the request
  let lng = await i18next.getLocale(request);
  // And here we detect what namespaces the routes about to render want to use
  let ns = i18next.getRouteNamespaces(context);

  await instance
    .use(initReactI18next) // Tell our instance to use react-i18next
    .use(Backend) // Setup our backend
    .init({
      ...i18n, // spread the configuration
      lng, // The locale we detected above
      ns, // The namespaces the routes about to render wants to use
      backend: {
        loadPath: resolve("./public/locales/{{lng}}/{{ns}}.json"),
      },
    });

  // Then you can render your app wrapped in the I18nextProvider as in the
  // entry.client file
  let markup = renderToString(
    <I18nextProvider i18n={instance}>
      <RemixServer context={context} url={request.url} />
    </I18nextProvider>
  );

  headers.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: statusCode,
    headers: headers,
  });
}
```

### Usage

Now, in your `app/root.tsx` file create a loader if you don't have one with the following code.

```tsx
import { json, LoaderFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  Outlet,
} from "@remix-run/react";
import { useChangeLanguage } from "remix-i18next";
import { useTranslation } from "react-i18next";
import i18next from "~/i18next.server";

type LoaderData = { locale: string };

export let loader: LoaderFunction = async ({ request }) => {
  let locale = await i18next.getLocale(request);
  return json<LoaderData>({ locale });
};

export let handle = {
  // In the handle export, we can add a i18n key with namespaces our route
  // will need to load. This key can be a single string or an array of strings.
  // TIP: In most cases, you should set this to your defaultNS from your i18n config
  // or if you did not set one, set it to the i18next default namespace "translation"
  i18n: "common",
};

export default function Root() {
  // Get the locale from the loader
  let { locale } = useLoaderData<LoaderData>();

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

and use them in your routes:

```tsx
import { useTranslation } from "react-i18next";

// This tells remix to load the "home" namespace
export let handle = {
  i18n: "home",
};

export default function Component() {
  let { t } = useTranslation("home");
  return <h1>{t("title")}</h1>;
}
```

And that's it, repeat the last step for each route you want to translate, remix-i18next will automatically let i18next what namespaces and language to use and this one will load the correct translation files using your configured backend.

#### Translating text inside loaders or actions

If you need to get translated texts inside a loader or action function, for example to translate the page title used later in a MetaFunction, you can use the `i18n.getFixedT` method to get a `t` function.

```ts
export let loader: LoaderFunction = async ({ request }) => {
  let t = await i18n.getFixedT(request);
  let title = t("My page title");
  return json({ title });
};

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
