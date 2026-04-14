"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PIS_PRODUCTS } from "@/lib/pis/types";
import type { PisProduct, PisInitiative } from "@/lib/pis/types";

export function InitiativeForm({
  initiative,
}: {
  initiative?: PisInitiative;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initiative?.title || "");
  const [description, setDescription] = useState(initiative?.description || "");
  const [hypothesis, setHypothesis] = useState(initiative?.hypothesis || "");
  const [products, setProducts] = useState<PisProduct[]>(
    initiative?.products || []
  );
  const [author, setAuthor] = useState(initiative?.author || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!initiative;

  function toggleProduct(p: PisProduct) {
    setProducts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title || !description || !hypothesis || !products.length || !author) {
      setError("Todos los campos son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/pis/initiatives/${initiative.id}`
        : "/api/pis/initiatives";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, hypothesis, products, author }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar");
      }

      const data = await res.json();
      router.push(`/pis/${isEdit ? initiative.id : data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {error && (
        <div className="bg-negative-muted text-negative text-sm px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
          Título
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre corto de la iniciativa"
          className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
          Descripción
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="¿Qué hace esta iniciativa? ¿Qué problema resuelve?"
          rows={4}
          className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent resize-y"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
          Hipótesis
        </label>
        <textarea
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="Si implementamos X, entonces Y mejorará porque Z..."
          rows={3}
          className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent resize-y"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1.5">
          Productos
        </label>
        <div className="flex flex-wrap gap-2">
          {PIS_PRODUCTS.map((p) => {
            const selected = products.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggleProduct(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  selected
                    ? "bg-accent/15 border-accent/40 text-accent-light"
                    : "bg-surface border-border text-text-muted hover:border-border-light"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-dim mb-1">
          Autor
        </label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Nombre del autor"
          className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : isEdit ? "Actualizar" : "Crear iniciativa"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 bg-surface border border-border text-sm font-medium text-text-muted rounded-md hover:bg-surface-2 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
