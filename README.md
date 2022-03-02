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
npm install remix-i18next i18next react-i18next
```

### Configuration

Then create a `i18n.server.ts` file somewhere in your app and add the following code:

```ts
import { RemixI18Next } from "remix-i18next";
import { FileSystemBackend } from "remix-i18next";

// You will need to provide a backend to load your translations, here we use the
// file system one and tell it where to find the translations.
let backend = new FileSystemBackend("./public/locales");

export let i18n = new RemixI18Next(backend, {
  fallbackLng: "en", // here configure your default (fallback) language
  supportedLanguages: ["es", "en"], // here configure your supported languages
});
```

### Client-side configuration

Now in your `entry.client.tsx` replace the code with this:

```tsx
import i18next from "i18next";
import { hydrate } from "react-dom";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { RemixBrowser } from "remix";

i18next
  .use(initReactI18next)
  .init({
    supportedLngs: ["es", "en"],
    defaultNS: "common",
    fallbackLng: "en",
    // I recommend you to always disable react.useSuspense for i18next
    react: { useSuspense: false },
  })
  .then(() => {
    // then hydrate your app wrapped in the RemixI18NextProvider
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
import i18next from "i18next";
import { renderToString } from "react-dom/server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import type { EntryContext } from "remix";
import { RemixServer } from "remix";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  // Here you also need to initialize i18next using initReactI18next, you should
  // use the same configuration as in your client side.
  // create an instance so every request will have a copy and don't re-use the
  // i18n object
  let i18n = createInstance();
  await i18n.use(initReactI18next).init({
    supportedLngs: ["es", "en"],
    defaultNS: "common",
    fallbackLng: "en",
    react: { useSuspense: false },
  });

  // Then you can render your app wrapped in the RemixI18NextProvider as in the
  // entry.client file
  let markup = renderToString(
    <I18nextProvider i18n={i18n}>
      <RemixServer context={remixContext} url={request.url} />
    </I18nextProvider>
  );

  responseHeaders.set("Content-Type", "text/html");

  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
```

### Usage

Now, in your `root` file create a loader if you don't have one with the following code and also run the `useRemixI18Next` hook on the Root component.

```tsx
import { json, LoaderFunction } from "remix";
import { useSetupTranslations } from "remix-i18next";

export let loader: LoaderFunction = async ({ request }) => {
  let locale = await i18n.getLocale(request);
  return json({ locale });
};

export default function Root() {
  let { locale } = useLoaderData<{ locale: string }>();
  useSetupTranslations(locale);

  return (
    <Document>
      <Outlet />
    </Document>
  );
}
```

Finally, in any route you want to translate you can do this:

```tsx
import { json, LoaderFunction } from "remix";
import i18n from "~/i18n.server.ts"; // this is the first file you created
import { useTranslation } from "react-i18next";

export let loader: LoaderFunction = async ({ request }) => {
  return json({
    i18n: await i18n.getTranslations(request, ["common", "index"]),
  });
};

export default function Component() {
  let { t } = useTranslation("index");
  return <h1>{t("title")}</h1>;
}
```

And that's it, repeat the last step for each route you want to translate, remix-i18next will automatically load the translations using the backend you configured and it will automatically inject the translations into your app.

#### Translating text inside loaders or actions

If you need to get translated texts inside a loader or action function, for example to translate the page title used later in a MetaFunction, you can use the `i18n.getFixedT` method to get the `t` function.

```ts
export let loader: LoaderFunction = async ({ request }) => {
  let t = await i18n.getFixedT(request);
  let title = t("My page title");
  return json({ title });
};

export let meta: MetaFunction = async ({ data }) => {
  return { title: data.title };
};
```

The `getFixedT` function can be called using a combination of parameters:

- `getFixedT(request)`: will use the request to get the locale and default the namespace to `common`
- `getFixedT("es")`: will use the specified locale and default the namespace to `common`
- `getFixedT(request, "namespace")` will use the request to get the locale and the specified namespace to get the translations.
- `getFixedT("es", "namespace")` will use the specified locale and the specified namespace to get the translations.
- `getFixedT(request, "common", { keySeparator: false })` will use the request to get the locale and the common namespace to get the translations, also use the options of the third argument to initialize the i18next instance.
- `getFixedT("es", "common", { keySeparator: false })` will use the specified locale and the common namespace to get the translations, also use the options of the third argument to initialize the i18next instance.

If you always need to set the same i18next options, you can pass them to RemixI18Next when creating the new instance.

```ts
export let i18n = new RemixI18Next(backend, {
  fallbackLng: "en", // here configure your default (fallback) language
  supportedLanguages: ["en", "es"], // here configure your supported languages
  i18nextOptions: { keySeparator: false },
});
```

This options will be overwritten by the options provided to `getFixedT`. Additionally, the following options will always be configured and not overwritteable:

- `supportedLngs` it will use the RemixI18Next supported languages.
- `fallbackLng` it will use the RemixI18Next fallback language.
- `fallbackNS` it will use the namespace request to `getFixedT`
- `defaultNS` it will use the namespace request to `getFixedT`

## Custom Backend

If you don't want, or can't use the FileSystemBackend to load your translations you can easily create your own backend.

> An example on when you couldn't use the FileSystemBackend is when you are deploying your app to Cloudflare Workers and you can't read from the FS.

```ts
import type { Backend } from "remix-i18next/backend";

export class FetchBackend implements Backend {
  private url: URL;

  constructor(url: string) {
    this.url = new URL(url);
  }

  async getTranslations(namespace: string, locale: string) {
    let url = new URL(`${locale}/${namespace}.json`, this.url);
    let response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
    });
    return response.json();
  }
}
```

With that, you created a simple backend that can be used with remix-i18next and load the translations from a remote server.

You could use this to load translations from specific services like Locize, Crowdin, Transifex, etc.
