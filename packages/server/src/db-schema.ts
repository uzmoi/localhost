import {
	int,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const pageSelector = sqliteTable(
	"page_selector",
	{
		id: int("id").primaryKey({ autoIncrement: true }),
		scope: text("scope").notNull(),
		value: text("value").notNull(),
	},
	table => ({
		selector: uniqueIndex("selector_index").on(table.scope, table.value),
	}),
);

export const pageSelectorRelations = relations(pageSelector, ({ one }) => ({
	bookmark: one(bookmarkPage),
}));

export const bookmarkPage = sqliteTable(
	"bookmark_page",
	{
		pageId: int("page_id").notNull(),
		bookmarkId: int("bookmark_id").notNull(),
		title: text("title").notNull(),
		desc: text("description").notNull(),
	},
	table => ({
		pk: primaryKey({ columns: [table.pageId, table.bookmarkId] }),
	}),
);

export const bookmarkPageRelations = relations(bookmarkPage, ({ one }) => ({
	page: one(pageSelector, {
		fields: [bookmarkPage.pageId],
		references: [pageSelector.id],
	}),
	bookmark: one(bookmark, {
		fields: [bookmarkPage.bookmarkId],
		references: [bookmark.id],
	}),
}));

export const bookmark = sqliteTable("bookmark", {
	id: int("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	desc: text("description").notNull(),
	createdAt: int("created_at", { mode: "timestamp" })
		.notNull()
		.$default(() => new Date()),
	updatedAt: int("updated_at", { mode: "timestamp" })
		.notNull()
		.$onUpdate(() => new Date()),
});

export const bookmarkRelations = relations(bookmark, ({ many }) => ({
	pages: many(bookmarkPage),
	tags: many(bookmarkTag),
}));

export const bookmarkTag = sqliteTable(
	"bookmark_tag",
	{
		id: int("id").primaryKey({ autoIncrement: true }),
		bookmarkId: int("bookmark_id").notNull(),
		tag: text("tag").notNull(),
	},
	table => ({
		index: uniqueIndex("tag_index").on(table.bookmarkId, table.tag),
	}),
);

export const bookmarkTagRelations = relations(bookmarkTag, ({ one }) => ({
	bookmark: one(bookmark, {
		fields: [bookmarkTag.bookmarkId],
		references: [bookmark.id],
	}),
}));
