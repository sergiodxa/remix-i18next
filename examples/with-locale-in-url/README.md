# With locale in the URL

You need to follow the architecture of the app like this

```sh
-- app/
   | - routes/
       | - $locale/
           | - your app here
   | - entry.client.tsx
   | - entry.server.tsx
   | - i18n.config.ts
   | - i18n.server.ts
   | - root.tsx
   | - public/
       | - locales/
           | - en/
               | - common.json
```

Inside the `i18n.server.ts` you should add the property `order` to force the behaviour of the module.

```ts
import { FileSystemBackend, RemixI18Next } from "remix-i18next";

const backend = new FileSystemBackend("./public/locales");

export const i18n = new RemixI18Next(backend, {
  fallbackLng: "en",
  supportedLanguages: ["en", "fr"],
  order: ["urlPath"],
});
```

---

You should export an async function from `root.tsx`. This function called `loader` and type of `LoaderFunction` will handle the `locale` if this one is not supported (and redirect the visitor).

```ts
export const loader: LoaderFunction = async ({ request }) => {
  const currentPath = new URL(request.url).pathname;
  const detect = new RegExp("([a-zA-Z])([^/]*)");
  const localeInPath = currentPath.match(detect);
  const locale = await i18n.getLocale(request);

  if (
    currentPath === "/" ||
    localeInPath === null ||
    localeInPath[0] !== locale
  ) {
    return redirect(`/${locale}`);
  }

  // The i18n export here will allow the i18n to be loaded for the entire app and you don't need to add it on each route
  return json({
    locale,
    i18n: await i18n.getTranslations(request, ["common"]),
  });
};
```
