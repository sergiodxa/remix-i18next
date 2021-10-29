import fs from "fs/promises";
import path from "path";

type Value = string | Language;
type Key = string;
export type Language = { [key: Key]: Value };

export interface Backend<Messages extends Language = Language> {
  getTranslations(namespace: string, locale: string): Promise<Messages>;
}

export class FileSystemBackend implements Backend {
  constructor(private basePath: string = "./public/locales") {}

  async getTranslations(namespace: string, locale: string) {
    const data = await fs.readFile(
      path.resolve(path.join(this.basePath, locale, `${namespace}.json`)),
      "utf-8"
    );
    return JSON.parse(data);
  }
}
