import { api, textOf, selectNotes } from "../client/api";
afterEach(() => jest.restoreAllMocks());
test("searches rich content, title, pinned notes and colors", () => {
  const ns = [
    { title: "Trip", content: "<p>Kyoto</p>", color: "mint", pinned: true },
    { title: "Work", content: "<p>Report</p>", color: "cream", pinned: false },
  ];
  expect(selectNotes(ns, "kyoto", "all")).toHaveLength(1);
  expect(selectNotes(ns, "", "pinned")).toHaveLength(1);
  expect(selectNotes(ns, "", "cream")[0].title).toBe("Work");
  expect(selectNotes(ns, "missing", "all")).toEqual([]);
  expect(textOf("<p>A &amp; B&nbsp;</p>")).toBe("A & B");
});
test("API passes credentials and returns response data", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ notes: [] }),
    });
  expect(await api("/notes")).toEqual({ notes: [] });
  expect(fetch.mock.calls[0][1].credentials).toBe("same-origin");
});
test("API surfaces errors and handles empty responses", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Please log in" }),
    });
  await expect(api("/notes")).rejects.toMatchObject({
    status: 401,
    message: "Please log in",
  });
  fetch.mockResolvedValue({ status: 204 });
  expect(await api("/auth/logout")).toBeNull();
});
