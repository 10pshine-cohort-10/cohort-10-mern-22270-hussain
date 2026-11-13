import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { io } from "socket.io-client";
import {
  Plus,
  Search,
  ArrowUpRight,
  FileText,
  Pin,
  Trash2,
  LogOut,
  Download,
  Upload,
  X,
  ArrowLeft,
  Check,
  NotebookPen,
  LayoutGrid,
  User,
} from "lucide-react";
import { api, textOf, selectNotes } from "./api";
import "./style.css";
export function App() {
  const [user, setUser] = useState(null),
    [boot, setBoot] = useState(true),
    [notes, setNotes] = useState([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [view, setView] = useState("all"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [register, setRegister] = useState(false),
    [deleting, setDeleting] = useState(null);
  const upload = useRef();
  const fail = (e) => {
    setError(e.message);
    if (e.status === 401) setUser(null);
  };
  async function refresh() {
    try {
      setNotes((await api("/notes")).notes);
    } catch (e) {
      fail(e);
    }
  }
  useEffect(() => {
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    refresh();
    const s = io();
    s.on("notes:changed", refresh);
    s.on("session:revoked", () => {
      setUser(null);
      setNotes([]);
      setEditing(null);
    });
    return () => s.disconnect();
  }, [user?.id]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  async function auth(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setUser(
        (
          await api("/auth/" + (register ? "register" : "login"), {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
          })
        ).user,
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setNotes([]);
      setEditing(null);
    } catch (e) {
      fail(e);
    }
  }
  async function save(n, close = true) {
    setBusy(true);
    setError("");
    try {
      await api("/notes" + (n.id ? "/" + n.id : ""), {
        method: n.id ? "PUT" : "POST",
        body: JSON.stringify({ ...n, pinned: Boolean(n.pinned) }),
      });
      if (close) setEditing(null);
      await refresh();
      setNotice("Your note is saved.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api("/notes/" + deleting.id, { method: "DELETE" });
      setDeleting(null);
      await refresh();
      setNotice("Note deleted.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportNotes() {
    try {
      const data = await api("/notes/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "folio-notes.json";
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Notes exported.");
    } catch (e) {
      fail(e);
    }
  }
  async function importNotes(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 12000000) {
      setError("Choose a JSON file smaller than 12 MB.");
      return;
    }
    setBusy(true);
    try {
      const d = JSON.parse(await file.text());
      const r = await api("/notes/import", {
        method: "POST",
        body: JSON.stringify(d),
      });
      await refresh();
      setNotice(`${r.count} notes imported.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  const fresh = () => {
    setError("");
    setEditing({ title: "", content: "", color: "cream", pinned: false });
  };
  if (boot) return <div className="loading">Opening your notebook…</div>;
  if (!user)
    return (
      <main className="auth">
        <section className="auth-story">
          <div className="brand">
            <NotebookPen /> folio<span>®</span>
          </div>
          <div>
            <span className="eyebrow">
              A LITTLE SPACE. A LOT OF POSSIBILITY.
            </span>
            <h1>
              Good ideas
              <br />
              deserve a home.
            </h1>
            <p>
              Gather your thoughts, make a little room,
              <br />
              and see where your ideas take you.
            </p>
            <div className="paper">
              <span>NOTE TO SELF</span>
              <h2>
                Start somewhere.
                <br />
                Make it yours.
              </h2>
              <hr />
              <p>Your next great idea starts with a note. ✦</p>
            </div>
          </div>
          <small>YOUR THOUGHTS. YOUR SPACE.</small>
        </section>
        <section className="auth-form">
          <div>
            <span className="eyebrow">WELCOME TO FOLIO</span>
            <h2>{register ? "A fresh page awaits." : "Welcome back."}</h2>
            <p>
              {register
                ? "Create your own little corner of the internet."
                : "Pick up where your thoughts left off."}
            </p>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <form onSubmit={auth}>
              {register && (
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    maxLength={80}
                    required
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={10}
                  maxLength={72}
                  required
                  placeholder="At least 10 characters"
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Please wait…" : register ? "Create account" : "Log in"}
                <ArrowUpRight size={18} />
              </button>
            </form>
            <p>
              {register ? "Already have an account?" : "New around here?"}{" "}
              <button
                className="text-button"
                onClick={() => {
                  setRegister(!register);
                  setError("");
                }}
              >
                {register ? "Log in" : "Create an account"}
              </button>
            </p>
            <small>Private by design. Only you can access your notes.</small>
          </div>
        </section>
      </main>
    );
  const shown = selectNotes(notes, query, view);
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#" onClick={() => setView("all")}>
          <NotebookPen /> folio<span>®</span>
        </a>
        <button className="primary new-button" onClick={fresh}>
          <Plus size={18} /> Create a note
        </button>
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav>
          <button
            className={view === "all" ? "active" : ""}
            onClick={() => setView("all")}
          >
            <LayoutGrid size={18} />
            All notes<span>{notes.length}</span>
          </button>
          <button
            className={view === "pinned" ? "active" : ""}
            onClick={() => setView("pinned")}
          >
            <Pin size={18} />
            Pinned notes<span>{notes.filter((n) => n.pinned).length}</span>
          </button>
          <button
            className={view === "profile" ? "active" : ""}
            onClick={() => setView("profile")}
          >
            <User size={18} />
            Your profile
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="thought">
            A place for the things
            <br />
            you don't want to forget.<span>Make room for your ideas. ↗</span>
          </div>
          <button className="profile-link" onClick={() => setView("profile")}>
            <div className="avatar">{user.name[0].toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <small>Personal workspace</small>
            </div>
          </button>
          <button className="logout" onClick={logout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header>
          <span>
            Personal workspace{" "}
            <span className="crumb">
              / {view === "profile" ? "Profile" : "Notes"}
            </span>
          </span>
          <span className="private-label">● Just for you</span>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {view === "profile" ? (
          <section className="profile-page">
            <span className="eyebrow">YOUR ACCOUNT</span>
            <h1>Your own little space.</h1>
            <div className="profile-card">
              <div className="avatar large">{user.name[0].toUpperCase()}</div>
              <h2>{user.name}</h2>
              <p>{user.email}</p>
              <p>{notes.length} notes in your notebook</p>
              <button className="secondary" onClick={logout}>
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="page-heading">
              <div>
                <span className="eyebrow">
                  THOUGHTS, IDEAS & EVERYTHING BETWEEN
                </span>
                <h1>
                  {view === "pinned"
                    ? "Keep it close."
                    : "Your mind, a little clearer."}
                </h1>
                <p>
                  A home for your ideas. A little space to make them happen.
                </p>
              </div>
              <button className="primary" onClick={fresh}>
                <Plus size={18} />
                New note
              </button>
            </section>
            <section className="note-tools">
              <div className="tabs">
                <button
                  className={view === "all" ? "selected" : ""}
                  onClick={() => setView("all")}
                >
                  All notes <span>{notes.length}</span>
                </button>
                <button
                  className={view === "pinned" ? "selected" : ""}
                  onClick={() => setView("pinned")}
                >
                  Pinned
                </button>
              </div>
              <div className="tools">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Search notes"
                    placeholder="Search your notes…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter by color"
                  value={
                    ["cream", "lavender", "mint", "peach"].includes(view)
                      ? view
                      : ""
                  }
                  onChange={(e) => setView(e.target.value || "all")}
                >
                  <option value="">All colors</option>
                  {["cream", "lavender", "mint", "peach"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </section>
            <div className="collection-label">
              <span>
                {shown.length} {shown.length === 1 ? "NOTE" : "NOTES"} IN YOUR
                COLLECTION
              </span>
              <div>
                <button onClick={exportNotes} disabled={busy}>
                  <Download size={14} />
                  Export
                </button>
                <button onClick={() => upload.current.click()} disabled={busy}>
                  <Upload size={14} />
                  Import
                </button>
                <input
                  ref={upload}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={importNotes}
                />
              </div>
            </div>
            <section className="notes-grid">
              {shown.map((n) => (
                <article key={n.id} className={"note " + n.color}>
                  <div className="note-top">
                    <span>
                      <FileText size={14} /> NOTE
                    </span>
                    <div>
                      <button
                        aria-label={(n.pinned ? "Unpin " : "Pin ") + n.title}
                        className={n.pinned ? "is-pinned" : ""}
                        onClick={() => save({ ...n, pinned: !n.pinned }, false)}
                        disabled={busy}
                      >
                        <Pin size={16} />
                      </button>
                      <button
                        aria-label={"Delete " + n.title}
                        onClick={() => setDeleting(n)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <button className="note-body" onClick={() => setEditing(n)}>
                    <h2>{n.title}</h2>
                    <p>
                      {textOf(n.content) || "A little room for a new idea…"}
                    </p>
                  </button>
                  <footer>
                    <span>
                      {new Date(
                        n.updated_at.replace(" ", "T") + "Z",
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <button
                      aria-label={"Edit " + n.title}
                      onClick={() => setEditing(n)}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </footer>
                </article>
              ))}
              <button className="add-card" onClick={fresh}>
                <span>
                  <Plus size={24} />
                </span>
                <strong>A fresh page</strong>
                <small>What’s on your mind?</small>
              </button>
            </section>
            {!shown.length && (
              <p className="empty">
                {query
                  ? "No notes match your search. Try another word."
                  : view === "all"
                    ? "Your notebook starts here. Create your first note."
                    : "No notes in this collection yet."}
              </p>
            )}
            <footer className="page-footer">
              A little more organized. A little more inspired.
              <span>MADE FOR YOUR MIND ✦</span>
            </footer>
          </>
        )}
      </main>
      {editing && (
        <Editor
          note={editing}
          busy={busy}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
      {deleting && (
        <div className="overlay">
          <section
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete this note?</h2>
            <p>“{deleting.title}” will be permanently deleted.</p>
            <div className="dialog-actions">
              <button
                autoFocus
                className="secondary"
                onClick={() => setDeleting(null)}
              >
                Keep note
              </button>
              <button className="danger" disabled={busy} onClick={remove}>
                {busy ? "Deleting…" : "Delete note"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
export function Editor({ note, busy, onSave, onCancel }) {
  const [title, setTitle] = useState(note.title),
    [color, setColor] = useState(note.color),
    [discard, setDiscard] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false, underline: false })],
    shouldRerenderOnTransaction: true,
    content: note.content,
    editorProps: {
      attributes: { "aria-label": "Note content", class: "rich-content" },
    },
  });
  const dirty = () =>
    title !== note.title ||
    color !== note.color ||
    (editor?.getHTML() || "") !== (note.content || "<p></p>");
  const close = () => {
    if (dirty()) setDiscard(true);
    else onCancel();
  };
  useEffect(() => {
    const handler = (e) => {
      if (dirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [title, color, editor]);
  return (
    <div className="overlay">
      <section
        className="editor-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-heading"
      >
        <div className="editor-header">
          <button onClick={close} className="text-button">
            <ArrowLeft size={16} />
            Back to notes
          </button>
          <span id="editor-heading">
            {note.id ? "EDIT NOTE" : "A FRESH PAGE"}
          </span>
          <button aria-label="Close editor" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <input
          autoFocus
          className="title-input"
          aria-label="Note title"
          placeholder="Give your idea a title…"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="editor-toolbar">
          {[
            [
              "Bold",
              "B",
              () => editor.chain().focus().toggleBold().run(),
              "bold",
            ],
            [
              "Italic",
              "I",
              () => editor.chain().focus().toggleItalic().run(),
              "italic",
            ],
            [
              "Heading",
              "H2",
              () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
              "heading",
            ],
            [
              "Bullet list",
              "• List",
              () => editor.chain().focus().toggleBulletList().run(),
              "bulletList",
            ],
            [
              "Numbered list",
              "1. List",
              () => editor.chain().focus().toggleOrderedList().run(),
              "orderedList",
            ],
            [
              "Quote",
              "“ ”",
              () => editor.chain().focus().toggleBlockquote().run(),
              "blockquote",
            ],
            ["Undo", "↶", () => editor.chain().focus().undo().run()],
            ["Redo", "↷", () => editor.chain().focus().redo().run()],
          ].map(([label, text, action, type]) => (
            <button
              key={label}
              aria-label={label}
              aria-pressed={type ? Boolean(editor?.isActive(type)) : undefined}
              onClick={action}
              disabled={!editor}
            >
              {text}
            </button>
          ))}
        </div>
        <EditorContent editor={editor} />
        <div className="editor-footer">
          <fieldset>
            <legend>Note color</legend>
            {["cream", "lavender", "mint", "peach"].map((c) => (
              <button
                key={c}
                aria-label={c}
                aria-pressed={color === c}
                className={"swatch " + c}
                onClick={() => setColor(c)}
              >
                {color === c && <Check size={14} />}
              </button>
            ))}
          </fieldset>
          <div>
            <button className="secondary" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || !title.trim() || !editor}
              onClick={() =>
                onSave({ ...note, title, color, content: editor.getHTML() })
              }
            >
              <Check size={16} />
              {busy ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
        {discard && (
          <div
            className="discard"
            role="alertdialog"
            aria-label="Discard changes"
          >
            <p>Leave without saving your changes?</p>
            <button className="secondary" onClick={() => setDiscard(false)}>
              Keep editing
            </button>
            <button className="danger" onClick={onCancel}>
              Discard changes
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
