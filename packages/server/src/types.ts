import { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./db-schema";

export type DB = BunSQLiteDatabase<typeof schema>;

export type Variables = {
	db: DB;
};
