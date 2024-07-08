import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { PageSelector } from "./page-selector";
import { bookmarkPage, bookmark, bookmarkTag, pageSelector } from "./db-schema";
import type { DB, Variables } from "./types";

export const Bookmark = v.object({
	page: PageSelector,
	title: v.string(),
	desc: v.string(),
});

export type Bookmark = v.InferOutput<typeof Bookmark>;

const int = v.pipe(v.number(), v.integer());

const BookmarkQuery = v.object({
	offset: v.optional(int),
	limit: v.optional(int),
});

const updateBookmark = async (
	db: DB,
	id: number,
	value: SQLiteUpdateSetSource<typeof bookmark> = {
		updatedAt: new Date(),
	},
) => {
	await db.update(bookmark).set(value).where(eq(bookmark.id, id));
};

export const bookmarksRoute = new Hono<{
	Variables: Variables;
}>()
	.basePath("/bookmarks")
	.get("/", vValidator("query", BookmarkQuery), async c => {
		const { offset, limit } = c.req.valid("query");
		const db = c.get("db");
		const groups = await db.query.bookmark.findMany({
			with: {
				pages: {
					columns: { title: true, desc: true },
					with: { page: true },
				},
				tags: true,
			},
			offset,
			limit,
		});
		const result = groups.map(group => ({
			...group,
			tags: group.tags.map(tag => tag.tag),
		}));
		return c.json(result);
	})
	.post(
		"/",
		vValidator(
			"json",
			v.object({
				name: v.optional(v.string(), "New group"),
				desc: v.optional(v.string(), ""),
			}),
		),
		async c => {
			const { name, desc } = c.req.valid("json");
			const db = c.get("db");
			const data = await db.insert(bookmark).values({ name, desc }).returning();
			return c.json({ ...data.at(0), pages: [], tags: [] });
		},
	)
	.get("/:id", async c => {
		const { id } = c.req.param();
		const db = c.get("db");
		const bookmark = await db.query.bookmark.findFirst({
			where(fields, { eq }) {
				return eq(fields.id, +id);
			},
			with: {
				pages: {
					columns: { title: true, desc: true },
					with: { page: true },
				},
				tags: true,
			},
		});
		if (bookmark == null) {
			return c.json(null, 404);
		}
		return c.json({
			...bookmark,
			tags: bookmark.tags.map(tag => tag.tag),
		});
	})
	.delete("/:id", async c => {
		const { id } = c.req.param();
		const db = c.get("db");
		await db.transaction(async tx => {
			await tx.delete(bookmark).where(eq(bookmark.id, +id));
			await tx.delete(bookmarkTag).where(eq(bookmarkTag.bookmarkId, +id));
			await tx.delete(bookmarkPage).where(eq(bookmarkPage.bookmarkId, +id));
		});
		return c.json({});
	})
	.post("/:id/page", vValidator("json", Bookmark), async c => {
		const { id } = c.req.param();
		const { page, title, desc } = c.req.valid("json");
		const db = c.get("db");
		await db.transaction(async tx => {
			const [{ pageId }] = await tx
				.insert(pageSelector)
				.values(page)
				.onConflictDoNothing()
				.returning({ pageId: pageSelector.id });
			await tx.insert(bookmarkPage).values({
				pageId,
				bookmarkId: +id,
				title,
				desc,
			});
			await updateBookmark(tx, +id);
		});
		return c.json({});
	})
	.delete("/:id/page", vValidator("json", PageSelector), async c => {
		const { id } = c.req.param();
		const page = c.req.valid("json");
		const db = c.get("db");
		await db.transaction(async tx => {
			const pageId = tx.$with("page_id").as(
				tx
					.select({ value: pageSelector.id })
					.from(pageSelector)
					.where(
						and(
							eq(pageSelector.scope, page.scope),
							eq(pageSelector.value, page.value),
						),
					)
					.limit(1),
			);
			await tx
				.with(pageId)
				.delete(bookmarkPage)
				.where(
					and(
						eq(bookmarkPage.bookmarkId, +id),
						eq(bookmarkPage.pageId, sql`${pageId}`),
					),
				);
			await updateBookmark(tx, +id);
		});
		return c.text("ok");
	})
	.post(
		"/:id/tags",
		vValidator("query", v.object({ tag: v.string() })),
		async c => {
			const { id } = c.req.param();
			const { tag } = c.req.valid("query");
			const db = c.get("db");
			await db.transaction(async tx => {
				await tx.insert(bookmarkTag).values({ bookmarkId: +id, tag });
				await updateBookmark(tx, +id);
			});
			return c.text("ok");
		},
	)
	.delete(
		"/:id/tags",
		vValidator("query", v.object({ tag: v.string() })),
		async c => {
			const { id } = c.req.param();
			const { tag } = c.req.valid("query");
			const db = c.get("db");
			await db.transaction(async tx => {
				await tx
					.delete(bookmarkTag)
					.where(
						and(eq(bookmarkTag.bookmarkId, +id), eq(bookmarkTag.tag, tag)),
					);
				await updateBookmark(tx, +id);
			});
			return c.text("ok");
		},
	);
