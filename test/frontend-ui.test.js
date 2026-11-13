import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { App, Editor } from "../client/main";
import { api } from "../client/api";
jest.mock("../client/api", () => ({
  ...jest.requireActual("../client/api"),
  api: jest.fn(),
}));
jest.mock("socket.io-client", () => ({
  io: () => ({ on: jest.fn(), disconnect: jest.fn() }),
}));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = clearTimeout;
let container, root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.mockReset();
});
test("rich editor preserves formatting when saving", async () => {
  const onSave = jest.fn();
  await act(async () =>
    root.render(
      <Editor
        note={{
          title: "Rich note",
          content:
            "<h2>Ideas</h2><p><strong>Keep this bold</strong></p><ul><li><p>A list item</p></li></ul>",
          color: "mint",
          pinned: false,
        }}
        busy={false}
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    ),
  );
  expect(
    container.querySelector('[aria-label="Note content"] strong').textContent,
  ).toBe("Keep this bold");
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent === "Save note")
      .click(),
  );
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Rich note",
      color: "mint",
      content: expect.stringContaining("<strong>Keep this bold</strong>"),
    }),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
test("shows login and switches to registration with required name field", async () => {
  api.mockRejectedValue(
    Object.assign(new Error("Unauthorized"), { status: 401 }),
  );
  await act(async () => root.render(<App />));
  expect(container.textContent).toContain("Welcome back.");
  expect(container.querySelector('input[name="name"]')).toBeNull();
  const signup = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Create an account",
  );
  await act(async () => signup.click());
  expect(container.querySelector('input[name="name"]').required).toBe(true);
  expect(container.querySelector('input[name="password"]').minLength).toBe(10);
});
test("loads only server-returned notes and asks before deletion", async () => {
  api.mockImplementation((path) =>
    Promise.resolve(
      path === "/auth/me"
        ? { user: { id: "u", name: "Alex", email: "alex@example.com" } }
        : {
            notes: [
              {
                id: "n",
                title: "A real thought",
                content: "<p>Content</p>",
                color: "mint",
                pinned: false,
                updated_at: "2026-11-10 12:00:00.000",
              },
            ],
          },
    ),
  );
  await act(async () => root.render(<App />));
  expect(container.textContent).toContain("A real thought");
  await act(async () =>
    container.querySelector('[aria-label="Delete A real thought"]').click(),
  );
  expect(container.querySelector('[role="alertdialog"]').textContent).toContain(
    "permanently deleted",
  );
  expect(
    api.mock.calls.filter(([p, o]) => o?.method === "DELETE"),
  ).toHaveLength(0);
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent === "Keep note")
      .click(),
  );
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();
});
