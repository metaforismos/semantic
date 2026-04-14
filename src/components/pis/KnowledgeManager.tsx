"use client";

import { useState, useEffect } from "react";
import { KNOWLEDGE_CATEGORIES } from "@/lib/pis/types";
import type { KnowledgeEntry, KnowledgeCategory } from "@/lib/pis/types";

export function KnowledgeManager() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Form state
  const [category, setCategory] = useState<KnowledgeCategory>("Online");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    setLoading(true);
    try {
      const res = await fetch("/api/pis/knowledge");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setCategory("Online");
    setTitle("");
    setContent("");
    setAuthor("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(entry: KnowledgeEntry) {
    setCategory(entry.category);
    setTitle(entry.title);
    setContent(entry.content);
    setAuthor(entry.author);
    setEditingId(entry.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !content) return;

    setSaving(true);
    try {
      const url = editingId
        ? `/api/pis/knowledge/${editingId}`
        : "/api/pis/knowledge";
      const method = editingId ? "PUT" : "POST";

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title, content, author }),
      });

      resetForm();
      fetchEntries();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta entrada de conocimiento?")) return;
    await fetch(`/api/pis/knowledge/${id}`, { method: "DELETE" });
    fetchEntries();
  }

  // Group by category
  const grouped: Record<string, KnowledgeEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }

  const filteredGroups =
    activeCategory === "all"
      ? grouped
      : { [activeCategory]: grouped[activeCategory] || [] };

  const categoryCounts = KNOWLEDGE_CATEGORIES.map((cat) => ({
    cat,
    count: (grouped[cat] || []).length,
  }));

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            activeCategory === "all"
              ? "bg-accent/15 text-accent-light"
              : "text-text-dim hover:text-text-muted hover:bg-surface-2"
          }`}
        >
          Todas ({entries.length})
        </button>
        {categoryCounts.map(({ cat, count }) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeCategory === cat
                ? "bg-accent/15 text-accent-light"
                : "text-text-dim hover:text-text-muted hover:bg-surface-2"
            }`}
          >
            {cat} {count > 0 && `(${count})`}
          </button>
        ))}
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-light transition-colors"
        >
          + Agregar conocimiento
        </button>
      )}

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-lg p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as KnowledgeCategory)
                }
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text focus:outline-none focus:border-accent"
              >
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
                Título
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nombre del concepto o dato"
                className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
              Contenido
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descripción, contexto, datos relevantes..."
              rows={3}
              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent resize-y"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
              Autor
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Nombre"
              className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !title || !content}
              className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-50"
            >
              {saving
                ? "Guardando..."
                : editingId
                  ? "Actualizar"
                  : "Guardar"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 bg-surface border border-border text-xs font-medium text-text-muted rounded-md hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Entries grouped by category */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-text-dim text-sm">
          No hay entradas en la base de conocimiento. Agrega información sobre los productos de myHotel para mejorar la evaluación de iniciativas.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(filteredGroups).map(([cat, catEntries]) =>
            catEntries && catEntries.length > 0 ? (
              <div key={cat}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
                  {cat}
                </div>
                <div className="space-y-1.5">
                  {catEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-surface border border-border rounded-lg px-3 py-2.5 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-text">
                            {entry.title}
                          </span>
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                            {entry.content}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => startEdit(entry)}
                            className="px-2 py-1 text-[10px] text-text-dim hover:text-accent rounded"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="px-2 py-1 text-[10px] text-text-dim hover:text-negative rounded"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
