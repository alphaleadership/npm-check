import { Db } from "./app-updater.ts";

const DB_PATH = "./docs/config.json";

export interface Config {
  blacklistedAuthors: string[];
}

const db = new Db<Config>(DB_PATH);

export async function getConfig(): Promise<Config> {
  try {
    const config = await db.read();
    return config[0] || { blacklistedAuthors: [] };
  } catch (error: any) {
    console.error("Error reading database:", error);
    return { blacklistedAuthors: [] };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await db.write([config]);
}
