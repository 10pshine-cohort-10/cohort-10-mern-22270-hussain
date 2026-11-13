export async function api(path, options = {}) {
  const res = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    credentials: "same-origin",
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    const e = new Error(data.error || "Request failed");
    e.status = res.status;
    throw e;
  }
  return data;
}
export const textOf = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
export const selectNotes = (notes, query, filter) =>
  notes.filter(
    (n) =>
      (filter !== "pinned" || n.pinned) &&
      (!["cream", "lavender", "mint", "peach"].includes(filter) ||
        n.color === filter) &&
      `${n.title} ${textOf(n.content)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
