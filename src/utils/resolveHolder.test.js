import resolveHolder from "./resolveHolder";

const roster = [
  { id:"1", name:"Alice",   email:"alice@seoulrobotics.org",   managerId:"3" },
  { id:"2", name:"Bob",     email:"bob@seoulrobotics.org",     managerId:"3" },
  { id:"3", name:"Charlie", email:"charlie@seoulrobotics.org", managerId:""  },
];

const quotas = {
  ceoEmail: "ceo@seoulrobotics.org",
  assignees: {
    business_card: ["alice@seoulrobotics.org", "bob@seoulrobotics.org"],
    domestic_trip: [],
  },
};

describe("resolveHolder", () => {
  describe("role: assignee", () => {
    it("returns comma-separated names when assignees exist", () => {
      expect(resolveHolder("assignee", "business_card", "1", roster, quotas))
        .toBe("Alice, Bob");
    });

    it("returns '담당자 미지정' when no assignees", () => {
      expect(resolveHolder("assignee", "domestic_trip", "1", roster, quotas))
        .toBe("담당자 미지정");
    });

    it("returns email prefix if not in roster", () => {
      const q = { assignees: { x: ["unknown@seoulrobotics.org"] } };
      expect(resolveHolder("assignee", "x", "1", roster, q))
        .toBe("unknown");
    });
  });

  describe("role: manager", () => {
    it("returns manager name for applicant", () => {
      // Alice (id:1) managerId:3 → Charlie
      expect(resolveHolder("manager", "domestic_trip", "1", roster, quotas))
        .toBe("Charlie");
    });

    it("returns '매니저 미지정' when manager not found", () => {
      // Charlie (id:3) has no manager
      expect(resolveHolder("manager", "domestic_trip", "3", roster, quotas))
        .toBe("매니저 미지정");
    });

    it("returns '매니저 미지정' when applicant not in roster", () => {
      expect(resolveHolder("manager", "domestic_trip", "999", roster, quotas))
        .toBe("매니저 미지정");
    });
  });

  describe("role: ceo", () => {
    it("returns CEO name when email matches", () => {
      const r = [...roster, { id:"4", name:"CEO Kim", email:"ceo@seoulrobotics.org", managerId:"" }];
      expect(resolveHolder("ceo", "overseas_trip", "1", r, quotas))
        .toBe("CEO Kim");
    });

    it("returns 'CEO' when no matching roster entry", () => {
      expect(resolveHolder("ceo", "overseas_trip", "1", roster, quotas))
        .toBe("CEO");
    });
  });

  it("returns role as-is for unknown roles", () => {
    expect(resolveHolder("unknown_role", "x", "1", roster, quotas))
      .toBe("unknown_role");
  });
});
