import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const nodes = sqliteTable('nodes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
});

export const lines = sqliteTable('lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  node1Id: integer('node1_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
  node2Id: integer('node2_id')
    .notNull()
    .references(() => nodes.id, { onDelete: 'cascade' }),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  nodes: many(nodes),
  lines: many(lines),
}));

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  project: one(projects, {
    fields: [nodes.projectId],
    references: [projects.id],
  }),
  linesAsNode1: many(lines, { relationName: 'node1' }),
  linesAsNode2: many(lines, { relationName: 'node2' }),
}));

export const linesRelations = relations(lines, ({ one }) => ({
  project: one(projects, {
    fields: [lines.projectId],
    references: [projects.id],
  }),
  node1: one(nodes, {
    fields: [lines.node1Id],
    references: [nodes.id],
    relationName: 'node1',
  }),
  node2: one(nodes, {
    fields: [lines.node2Id],
    references: [nodes.id],
    relationName: 'node2',
  }),
}));
