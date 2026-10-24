import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "#app";
import { prisma } from "#lib/prisma";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";

function asUser(user: TestUser) {
  return {
    get: (url: string) =>
      request(app).get(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
    post: (url: string) =>
      request(app).post(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
    patch: (url: string) =>
      request(app).patch(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
    delete: (url: string) =>
      request(app).delete(url).set("Origin", STUDIO_ORIGIN).set("Cookie", user.cookie),
  };
}

describe("document lifecycle through the real stack", () => {
  it("rejects an unauthenticated create from a first-party origin", async () => {
    const response = await request(app)
      .post("/api/v1/documents")
      .set("Origin", STUDIO_ORIGIN)
      .send({ type: "RESUME", title: "Nope" });

    expect(response.status).toBe(401);
  });

  it("creates, lists, updates with optimistic concurrency, and soft-deletes a document", async () => {
    const user = await createUserWithSession();
    const api = asUser(user);

    const created = await api
      .post("/api/v1/documents")
      .send({ type: "RESUME", title: "My resume", content: { basics: { name: "Test" } } });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    const documentId: string = created.body.data.id;
    const revision: number = created.body.data.revision;
    expect(documentId).toBeTruthy();
    expect(revision).toBe(1);

    const listed = await api.get("/api/v1/documents");
    expect(listed.status).toBe(200);
    expect(listed.body.data.map((d: { id: string }) => d.id)).toEqual([documentId]);

    const updated = await api
      .patch(`/api/v1/documents/${documentId}`)
      .send({ title: "Renamed", revision });
    expect(updated.status).toBe(200);
    expect(updated.body.data.revision).toBe(revision + 1);
    expect(updated.body.data.title).toBe("Renamed");

    // The same stale revision again: a lost update must be refused, not silently applied.
    const stale = await api
      .patch(`/api/v1/documents/${documentId}`)
      .send({ title: "Stale write", revision });
    expect(stale.status).toBe(409);

    // The list is cached in Redis; the update must have invalidated it.
    const relisted = await api.get("/api/v1/documents");
    expect(relisted.body.data[0].title).toBe("Renamed");

    const deleted = await api.delete(`/api/v1/documents/${documentId}`);
    expect(deleted.status).toBe(200);

    const gone = await api.get(`/api/v1/documents/${documentId}`);
    expect(gone.status).toBe(404);

    const emptyList = await api.get("/api/v1/documents");
    expect(emptyList.body.data).toEqual([]);

    const row = await prisma.document.findUnique({ where: { id: documentId } });
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it("scopes documents to their owner", async () => {
    const owner = await createUserWithSession();
    const other = await createUserWithSession();

    const created = await asUser(owner)
      .post("/api/v1/documents")
      .send({ type: "RESUME", title: "Private" });
    expect(created.status).toBe(201);

    const asOther = await asUser(other).get(`/api/v1/documents/${created.body.data.id}`);
    expect(asOther.status).toBe(404);
  });
});
