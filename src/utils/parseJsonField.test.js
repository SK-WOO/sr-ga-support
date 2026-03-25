import parseJsonField from "./parseJsonField";

describe("parseJsonField", () => {
  it("returns array as-is", () => {
    expect(parseJsonField([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("parses valid JSON string", () => {
    expect(parseJsonField('[{"url":"http://a.com","name":"file.pdf"}]'))
      .toEqual([{ url: "http://a.com", name: "file.pdf" }]);
  });

  it("returns empty array for null/undefined/empty", () => {
    expect(parseJsonField(null)).toEqual([]);
    expect(parseJsonField(undefined)).toEqual([]);
    expect(parseJsonField("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseJsonField("{invalid}")).toEqual([]);
    expect(parseJsonField("not json at all")).toEqual([]);
  });

  it("parses empty array string", () => {
    expect(parseJsonField("[]")).toEqual([]);
  });
});
