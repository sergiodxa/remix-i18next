import fs from "fs/promises";
import path from "path";
import { Backend } from "../backend";

export class FileSystemBackend implements Backend {
  constructor(private basePath: string = "./public/locales") {}

  async getTranslations(namespace: string, locale: string) {
    const data = await fs.readFile(
      path.resolve(path.join(this.basePath, locale, `${namespace}.json`))
    );
    return JSON.parse(data.toString("utf8"));
  }
}
