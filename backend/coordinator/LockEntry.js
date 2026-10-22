"use strict";

const crypto = require("crypto");

const MAX_ANNOTATION_LEN = 140;

/**
 * Structural In-Memory Lock Object for Latch.
 *
 * Guarantees schema consistency for every lock stored in the coordinator's RAM.
 */
class LockEntry {
  constructor({
    filePath,
    workspaceId,
    agentId,
    mode = "write",
    claimedAt = Date.now(),
    lastHeartbeat = Date.now(),
    ttlMs = 15000,
    holder = null,
    source = "coordinator",
    ownershipToken = null,
    fencingToken = 1,
    annotation = "",
    readers = null,
    escalated = false,
    keepAliveUntil = 0,
    releasedAt = null,
  }) {
    this.filePath = String(filePath || "");
    this.workspaceId = String(workspaceId || "");
    this.agentId = String(agentId || "");
    this.mode = mode === "read" ? "read" : "write";
    this.claimedAt = Number(claimedAt) || Date.now();
    this.lastHeartbeat = Number(lastHeartbeat) || this.claimedAt;
    this.ttlMs = Number(ttlMs) || 15000;
    this.holder = holder && typeof holder === "object" ? holder : null;
    this.source = String(source || "coordinator");
    this.ownershipToken = ownershipToken || crypto.randomUUID();
    this.fencingToken = Number.isSafeInteger(Number(fencingToken)) ? Number(fencingToken) : 1;
    this.annotation = LockEntry.sanitizeAnnotation(annotation);
    this.readers = readers instanceof Set ? readers : new Set(Array.isArray(readers) ? readers : []);
    this.escalated = Boolean(escalated);
    this.keepAliveUntil = Number(keepAliveUntil) || 0;
    this.releasedAt = releasedAt ? Number(releasedAt) : null;
  }

  static sanitizeAnnotation(val) {
    if (!val || typeof val !== "string") return "";
    return val
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_ANNOTATION_LEN);
  }

  isAlive(now = Date.now()) {
    if (this.mode === "read") return true;
    const base = this.lastHeartbeat || this.claimedAt;
    return now - base < this.ttlMs;
  }

  expiresAt() {
    return (this.lastHeartbeat || this.claimedAt) + this.ttlMs;
  }

  expiresInMs(now = Date.now()) {
    return Math.max(0, this.expiresAt() - now);
  }

  touch({ now = Date.now(), ttlMs, keepAlive, annotation } = {}) {
    this.lastHeartbeat = now;
    if (ttlMs) this.ttlMs = ttlMs;
    if (keepAlive !== undefined) {
      this.keepAliveUntil = keepAlive ? now + 5 * 60_000 : 0;
    }
    if (annotation !== undefined) {
      const clean = LockEntry.sanitizeAnnotation(annotation);
      if (clean) this.annotation = clean;
    }
  }

  toPublic(includeLease = false) {
    const res = {
      filePath: this.filePath,
      agentId: this.agentId,
      mode: this.mode,
      claimedAt: this.claimedAt,
      lastHeartbeat: this.lastHeartbeat,
      ttlMs: this.ttlMs,
      expiresAt: this.expiresAt(),
      workspaceId: this.workspaceId || null,
      source: this.source,
      holder: this.holder,
      annotation: this.annotation || null,
      readers: [...this.readers],
      escalated: this.escalated,
      fencingToken: this.fencingToken,
    };
    if (includeLease) res.ownershipToken = this.ownershipToken;
    if (this.releasedAt) {
      res.released = true;
      res.releasedAt = this.releasedAt;
    }
    return res;
  }

  toSerializable() {
    return {
      filePath: this.filePath,
      workspaceId: this.workspaceId,
      agentId: this.agentId,
      mode: this.mode,
      claimedAt: this.claimedAt,
      lastHeartbeat: this.lastHeartbeat,
      ttlMs: this.ttlMs,
      holder: this.holder,
      source: this.source,
      ownershipToken: this.ownershipToken,
      fencingToken: this.fencingToken,
      annotation: this.annotation,
      readers: [...this.readers],
      escalated: this.escalated,
      keepAliveUntil: this.keepAliveUntil,
      releasedAt: this.releasedAt,
    };
  }
}

module.exports = { LockEntry, MAX_ANNOTATION_LEN };
