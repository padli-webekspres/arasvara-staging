import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  MIGRATED_FROM_EDITOR_ACTIVITIES,
  mapEditorActivityToAuditLog,
} from "./editor-activities-to-audit-log";

describe("mapEditorActivityToAuditLog", () => {
  const sourceId = new ObjectId();
  const actorId = new ObjectId();
  const articleId = new ObjectId();
  const createdAt = new Date("2025-06-01T10:00:00.000Z");

  it("maps valid editor activity to audit_log shape", () => {
    const result = mapEditorActivityToAuditLog({
      _id: sourceId,
      actor: {
        _id: actorId,
        name: "Editor A",
        email: "editor@example.com",
      },
      action: "PUBLISH",
      statusFrom: "PENDING_REVIEW",
      statusTo: "PUBLISHED",
      article: {
        _id: articleId,
        title: "Judul Artikel",
      },
      timestamp: createdAt,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.sourceId).toBe(sourceId.toHexString());
    expect(result.data.auditDoc.entity).toBe("articles");
    expect(result.data.auditDoc.entityId).toEqual(articleId);
    expect(result.data.auditDoc.createdAt).toEqual(createdAt);
    expect(result.data.auditDoc.details).toBe(
      "Perubahan status PENDING_REVIEW → PUBLISHED",
    );
    expect(result.data.auditDoc.meta).toEqual({
      originalId: sourceId.toHexString(),
      migratedFrom: MIGRATED_FROM_EDITOR_ACTIVITIES,
      statusFrom: "PENDING_REVIEW",
      statusTo: "PUBLISHED",
      articleTitle: "Judul Artikel",
    });
  });

  it("includes reason in details and meta", () => {
    const result = mapEditorActivityToAuditLog({
      _id: sourceId,
      actor: {
        _id: actorId,
        name: "Editor A",
        email: "editor@example.com",
      },
      action: "REJECT",
      statusFrom: "PENDING_REVIEW",
      statusTo: "REJECTED",
      reason: "Kurang lengkap",
      article: {
        _id: articleId,
        title: "Draft",
      },
      timestamp: createdAt,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.auditDoc.details).toBe(
      "Perubahan status PENDING_REVIEW → REJECTED. Alasan: Kurang lengkap",
    );
    expect(
      (result.data.auditDoc.meta as { reason?: string }).reason,
    ).toBe("Kurang lengkap");
  });

  it("fails when article id is missing", () => {
    const result = mapEditorActivityToAuditLog({
      _id: sourceId,
      actor: {
        _id: actorId,
        name: "Editor A",
        email: "editor@example.com",
      },
      action: "CREATE",
      statusTo: "DRAFT",
      article: { title: "Tanpa ID" },
      timestamp: createdAt,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.reason).toContain("article._id");
  });
});
