import { beforeEach, describe, expect, it, vi } from "vitest";

// Fluent Supabase mock builder
let queryResults = {};
let lastQuery = null;

function createQueryMock() {
  const query = {
    _table: "",
    _actions: [],
    select: vi.fn(function () {
      query._actions.push(["select", ...arguments]);
      return query;
    }),
    eq: vi.fn(function () {
      query._actions.push(["eq", ...arguments]);
      return query;
    }),
    neq: vi.fn(function () {
      query._actions.push(["neq", ...arguments]);
      return query;
    }),
    not: vi.fn(function () {
      query._actions.push(["not", ...arguments]);
      return query;
    }),
    order: vi.fn(function () {
      query._actions.push(["order", ...arguments]);
      return query;
    }),
    range: vi.fn(function () {
      query._actions.push(["range", ...arguments]);
      return query;
    }),
    insert: vi.fn(function () {
      query._actions.push(["insert", ...arguments]);
      return query;
    }),
    update: vi.fn(function () {
      query._actions.push(["update", ...arguments]);
      return query;
    }),
    delete: vi.fn(function () {
      query._actions.push(["delete", ...arguments]);
      return query;
    }),
    maybeSingle: vi.fn(async function () {
      const res = queryResults[query._table]?.maybeSingle ?? { data: null };
      if (res instanceof Error) throw res;
      return res;
    }),
    single: vi.fn(async function () {
      const res = queryResults[query._table]?.single ?? { data: null };
      if (res instanceof Error) throw res;
      return res;
    }),
    then: function (resolve, reject) {
      const res = queryResults[query._table]?.dataPromise ?? { data: [] };
      if (res instanceof Error) reject(res);
      else resolve(res);
    },
  };
  return query;
}

vi.mock("../../../serverboard/config/supabase.js", () => {
  return {
    supabase: {
      from: vi.fn((table) => {
        const q = createQueryMock();
        q._table = table;
        lastQuery = q;
        return q;
      }),
    },
  };
});

import { ProjectModel } from "../../../serverboard/models/Project.js";
import { supabase } from "../../../serverboard/config/supabase.js";

describe("ProjectModel (serverboard/models/Project.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = {};
    lastQuery = null;
  });

  describe("findById() and findByRenderId()", () => {
    it("returns project data when found by id", async () => {
      const mockProject = { id: "proj-1", project_name: "test-app", status: "running" };
      queryResults.projects = { maybeSingle: { data: mockProject } };

      const result = await ProjectModel.findById("proj-1");

      expect(supabase.from).toHaveBeenCalledWith("projects");
      expect(lastQuery.select).toHaveBeenCalledWith("*");
      expect(lastQuery.eq).toHaveBeenCalledWith("id", "proj-1");
      expect(result).toEqual(mockProject);
    });

    it("returns null when project is missing by id", async () => {
      queryResults.projects = { maybeSingle: { data: null } };

      const result = await ProjectModel.findById("missing-id");
      expect(result).toBeNull();
    });

    it("returns project data when found by renderId", async () => {
      const mockProject = { id: "proj-1", render_id: "rnd-123", status: "deploying" };
      queryResults.projects = { maybeSingle: { data: mockProject } };

      const result = await ProjectModel.findByRenderId("rnd-123");

      expect(supabase.from).toHaveBeenCalledWith("projects");
      expect(lastQuery.eq).toHaveBeenCalledWith("render_id", "rnd-123");
      expect(result).toEqual(mockProject);
    });
  });

  describe("listByUser()", () => {
    it("lists non-deleted projects for user by default, ordered by created_at desc", async () => {
      const mockList = [
        { id: "p1", user_id: "user-1", status: "running" },
        { id: "p2", user_id: "user-1", status: "deploying" },
      ];
      queryResults.projects = { dataPromise: { data: mockList } };

      const result = await ProjectModel.listByUser("user-1");

      expect(supabase.from).toHaveBeenCalledWith("projects");
      expect(lastQuery.select).toHaveBeenCalledWith("*");
      expect(lastQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(lastQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(lastQuery.neq).toHaveBeenCalledWith("status", "deleted");
      expect(result).toEqual(mockList);
    });

    it("filters by status when status parameter is supplied", async () => {
      queryResults.projects = { dataPromise: { data: [] } };

      await ProjectModel.listByUser("user-1", { status: "deploying" });

      expect(lastQuery.eq).toHaveBeenCalledWith("status", "deploying");
      expect(lastQuery.neq).not.toHaveBeenCalled();
    });

    it("includes deleted projects when includeDeleted=true", async () => {
      queryResults.projects = { dataPromise: { data: [] } };

      await ProjectModel.listByUser("user-1", { includeDeleted: true });

      expect(lastQuery.neq).not.toHaveBeenCalled();
    });

    it("applies range pagination when limit is provided", async () => {
      queryResults.projects = { dataPromise: { data: [] } };

      await ProjectModel.listByUser("user-1", { limit: 10, offset: 20 });

      expect(lastQuery.range).toHaveBeenCalledWith(20, 29);
    });

    it("defaults offset to 0 when limit is set without offset", async () => {
      queryResults.projects = { dataPromise: { data: [] } };

      await ProjectModel.listByUser("user-1", { limit: 5 });

      expect(lastQuery.range).toHaveBeenCalledWith(0, 4);
    });

    it("returns empty array when query resolves with data: null", async () => {
      queryResults.projects = { dataPromise: { data: null } };

      const result = await ProjectModel.listByUser("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("countByUser()", () => {
    it("counts non-terminal projects for user", async () => {
      queryResults.projects = { dataPromise: { count: 3 } };

      const count = await ProjectModel.countByUser("user-1");

      expect(supabase.from).toHaveBeenCalledWith("projects");
      expect(lastQuery.select).toHaveBeenCalledWith("*", { count: "exact", head: true });
      expect(lastQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(lastQuery.not).toHaveBeenCalledWith("status", "in", '("deleted","deleting")');
      expect(count).toBe(3);
    });

    it("returns 0 when count is undefined or null", async () => {
      queryResults.projects = { dataPromise: { count: null } };

      const count = await ProjectModel.countByUser("user-1");
      expect(count).toBe(0);
    });
  });

  describe("create()", () => {
    it("successfully creates project when user has remaining quota", async () => {
      queryResults.users = { maybeSingle: { data: { project_limit: 5 } } };
      queryResults.projects = {
        dataPromise: { count: 2 },
        single: { data: { id: "new-proj", project_name: "test-app", agent_limit: 3 }, error: null },
      };

      const result = await ProjectModel.create({
        userId: "user-1",
        projectName: "  test-app  ",
        agentLimit: 3,
      });

      expect(lastQuery.insert).toHaveBeenCalledWith([
        {
          user_id: "user-1",
          project_name: "test-app",
          status: "pending",
          agent_limit: 3,
        },
      ]);
      expect(result).toEqual({ id: "new-proj", project_name: "test-app", agent_limit: 3 });
    });

    it("creates project when user has no explicit project_limit (unbounded / null)", async () => {
      queryResults.users = { maybeSingle: { data: { project_limit: null } } };
      queryResults.projects = {
        single: { data: { id: "p-unlimited", project_name: "open-app" }, error: null },
      };

      const result = await ProjectModel.create({
        userId: "user-1",
        projectName: "open-app",
      });

      expect(result.id).toBe("p-unlimited");
    });

    it("throws error when project limit is reached", async () => {
      queryResults.users = { maybeSingle: { data: { project_limit: 3 } } };
      queryResults.projects = { dataPromise: { count: 3 } };

      await expect(
        ProjectModel.create({
          userId: "user-1",
          projectName: "overflow-app",
        })
      ).rejects.toThrow("Project limit reached (3/3)");
    });

    it("throws error when database insert returns an error", async () => {
      queryResults.users = { maybeSingle: { data: { project_limit: 10 } } };
      const dbError = new Error("Unique constraint violation");
      queryResults.projects = {
        dataPromise: { count: 1 },
        single: { data: null, error: dbError },
      };

      await expect(
        ProjectModel.create({
          userId: "user-1",
          projectName: "app",
        })
      ).rejects.toThrow("Unique constraint violation");
    });

    it("defaults agentLimit to 7 when omitted or non-numeric", async () => {
      queryResults.users = { maybeSingle: { data: null } };
      queryResults.projects = {
        single: { data: { id: "p-default" }, error: null },
      };

      await ProjectModel.create({
        userId: "user-1",
        projectName: "app",
        agentLimit: "bad",
      });

      expect(lastQuery.insert).toHaveBeenCalledWith([
        expect.objectContaining({ agent_limit: 7 }),
      ]);
    });
  });

  describe("update()", () => {
    it("successfully updates project and returns updated record", async () => {
      const updatedData = { id: "proj-1", branch: "staging", status: "running" };
      queryResults.projects = { single: { data: updatedData, error: null } };

      const res = await ProjectModel.update("proj-1", { branch: "staging" });

      expect(lastQuery.update).toHaveBeenCalledWith({ branch: "staging" });
      expect(lastQuery.eq).toHaveBeenCalledWith("id", "proj-1");
      expect(res).toEqual(updatedData);
    });

    it("throws error when database update fails", async () => {
      const dbError = new Error("Connection lost");
      queryResults.projects = { single: { data: null, error: dbError } };

      await expect(ProjectModel.update("proj-1", { branch: "staging" })).rejects.toThrow("Connection lost");
    });
  });

  describe("delete()", () => {
    it("successfully deletes project by id", async () => {
      queryResults.projects = { dataPromise: { error: null } };

      const res = await ProjectModel.delete("proj-1");

      expect(lastQuery.delete).toHaveBeenCalled();
      expect(lastQuery.eq).toHaveBeenCalledWith("id", "proj-1");
      expect(res).toBe(true);
    });

    it("throws error when delete fails", async () => {
      const dbError = new Error("Foreign key violation");
      queryResults.projects = { dataPromise: { error: dbError } };

      await expect(ProjectModel.delete("proj-1")).rejects.toThrow("Foreign key violation");
    });
  });
});

