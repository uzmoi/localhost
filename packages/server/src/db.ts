import { Database } from "bun:sqlite";
import { BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./db-schema";

export const openDB = (): BunSQLiteDatabase<typeof schema> => {
	const sqliteDB = new Database(":memory:");
	return drizzle(sqliteDB, { schema });
};
