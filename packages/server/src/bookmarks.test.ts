import { Hono } from "hono";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { bookmark, bookmarkPage, bookmarkTag, pageSelector } from "./db-schema";
import { bookmarksRoute } from "./bookmarks";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	setSystemTime,
	test,
} from "bun:test";
import { openDB } from "./db";
import type { Variables } from "./types";

const app = new Hono<{
	Variables: Variables;
	Bindings: Variables;
}>();

app.use("/*", async (c, next) => {
	c.set("db", c.env.db);
	await next();
});

app.route("/", bookmarksRoute);

const mockEnv: Variables = {
	db: undefined as never,
};

const now = new Date("2024-01-01T00:00:00.000Z");

const initMockDB = async () => {
	const { db } = mockEnv;
	await db.insert(bookmark).values({
		name: "Group name",
		desc: "description.",
	});
	await db.insert(bookmarkTag).values({
		bookmarkId: 1,
		tag: "hoge",
	});
	await db.insert(pageSelector).values({
		scope: "url",
		value: "https://example.test/",
	});
	await db.insert(bookmarkPage).values({
		bookmarkId: 1,
		pageId: 1,
		title: "Example site title",
		desc: "Site description.",
	});
};

describe("Bookmark", () => {
	beforeAll(() => {
		setSystemTime(now);
	});
	beforeEach(() => {
		mockEnv.db = openDB();
		migrate(mockEnv.db, {
			// cwd == packages/server/
			migrationsFolder: "./drizzle",
		});
	});
	afterEach(() => {
		mockEnv.db;
	});
	test("GET /bookmarks", async () => {
		await initMockDB();
		const res = await app.request("/bookmarks", undefined, mockEnv);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([
			{
				id: 1,
				name: "Group name",
				desc: "description.",
				createdAt: now.toISOString(),
				updatedAt: now.toISOString(),
				tags: ["hoge"],
				pages: [
					{
						desc: "Site description.",
						page: {
							id: 1,
							scope: "url",
							value: "https://example.test/",
						},
						title: "Example site title",
					},
				],
			},
		]);
	});
	test("POST /bookmarks", async () => {
		const res = await app.request(
			"/bookmarks",
			{
				method: "POST",
				body: JSON.stringify({ name: "Group name", desc: "description." }),
				headers: new Headers({ "Content-Type": "application/json" }),
			},
			mockEnv,
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: 1,
			name: "Group name",
			desc: "description.",
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
			tags: [],
			pages: [],
		});
	});
	test("GET /bookmarks/:id", async () => {
		await initMockDB();
		const res = await app.request("/bookmarks/1", undefined, mockEnv);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: 1,
			name: "Group name",
			desc: "description.",
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
			tags: ["hoge"],
			pages: [
				{
					desc: "Site description.",
					page: {
						id: 1,
						scope: "url",
						value: "https://example.test/",
					},
					title: "Example site title",
				},
			],
		});
	});
	test("GET /bookmarks/:id (404)", async () => {
		const res = await app.request("/bookmarks/1", undefined, mockEnv);
		expect(res.status).toBe(404);
	});
	test("DELETE /bookmarks/:id", async () => {
		await initMockDB();
		const res = await app.request(
			"/bookmarks/1",
			{ method: "DELETE" },
			mockEnv,
		);
		expect(res.status).toBe(200);
		const bookmarks = await mockEnv.db.select().from(bookmark);
		expect(bookmarks).toEqual([]);
		const bookmarkPages = await mockEnv.db.select().from(bookmarkPage);
		expect(bookmarkPages).toEqual([]);
		const bookmarkTags = await mockEnv.db.select().from(bookmarkTag);
		expect(bookmarkTags).toEqual([]);
	});
	test("POST /bookmarks/:id/page", async () => {
		await initMockDB();
		const res = await app.request(
			"/bookmarks/1/page",
			{
				method: "POST",
				body: JSON.stringify({
					title: "Example 2",
					desc: "desc",
					page: { scope: "url", value: "https://example2.test/" },
				}),
				headers: new Headers({ "Content-Type": "application/json" }),
			},
			mockEnv,
		);
		expect(res.status).toBe(200);
		const bookmarkPages = await mockEnv.db.select().from(bookmarkPage);
		expect(bookmarkPages).toEqual([
			{
				bookmarkId: 1,
				pageId: 1,
				title: "Example site title",
				desc: "Site description.",
			},
			{ bookmarkId: 1, pageId: 2, title: "Example 2", desc: "desc" },
		]);
	});
	test("DELETE /bookmarks/:id/page", async () => {
		await initMockDB();
		const res = await app.request(
			"/bookmarks/1/page",
			{
				method: "DELETE",
				body: JSON.stringify({ scope: "url", value: "https://example.test/" }),
				headers: new Headers({ "Content-Type": "application/json" }),
			},
			mockEnv,
		);
		expect(res.status).toBe(200);
		const bookmarkPages = await mockEnv.db.select().from(bookmarkPage);
		expect(bookmarkPages).toEqual([]);
	});
	test("POST /bookmarks/:id/tags", async () => {
		await initMockDB();
		const res = await app.request(
			"/bookmarks/1/tags?tag=fuga",
			{ method: "POST" },
			mockEnv,
		);
		expect(res.status).toBe(200);
		const tags = await mockEnv.db.select().from(bookmarkTag);
		expect(tags).toEqual([
			{ id: 1, bookmarkId: 1, tag: "hoge" },
			{ id: 2, bookmarkId: 1, tag: "fuga" },
		]);
	});
	test("DELETE /bookmarks/:id/tags", async () => {
		await initMockDB();
		const res = await app.request(
			"/bookmarks/1/tags?tag=hoge",
			{ method: "DELETE" },
			mockEnv,
		);
		expect(res.status).toBe(200);
		const tags = await mockEnv.db.select().from(bookmarkTag);
		expect(tags).toEqual([]);
	});
});
