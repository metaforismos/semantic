"use client";

import { SUGGESTED_EVENTS } from "@/lib/whatsapp/constants";

interface Props {
  event: string;
  setEvent: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  hotelName: string;
  setHotelName: (v: string) => void;
  includeButton: boolean;
  setIncludeButton: (v: boolean) => void;
  buttonText: string;
  setButtonText: (v: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export default function TemplateRequestForm({
  event,
  setEvent,
  description,
  setDescription,
  hotelName,
  setHotelName,
  includeButton,
  setIncludeButton,
  buttonText,
  setButtonText,
  onGenerate,
  isGenerating,
}: Props) {
  const canGenerate = event.trim() && description.trim() && !isGenerating;

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
      {/* Event input */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim block mb-1.5">
          Evento
        </label>
        <input
          type="text"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="Ej: Confirmacion de reserva, Encuesta post-estadia..."
          className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
        />
        {/* Suggested chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {SUGGESTED_EVENTS.map((e) => (
            <button
              key={e}
              onClick={() => setEvent(e)}
              className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                event === e
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-surface-2 text-text-dim hover:text-text hover:bg-surface-3"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Hotel name */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim block mb-1.5">
          Nombre del hotel <span className="opacity-50">(opcional)</span>
        </label>
        <input
          type="text"
          value={hotelName}
          onChange={(e) => setHotelName(e.target.value)}
          placeholder="Ej: Hotel Central"
          className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
        />
      </div>

      {/* Button toggle */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim">
            Incluir boton
          </label>
          <button
            onClick={() => setIncludeButton(!includeButton)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              includeButton ? "bg-accent" : "bg-surface-3"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                includeButton ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {includeButton && (
          <input
            type="text"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Ej: Ver reserva, Descargar comprobante..."
            className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors animate-fade-in"
          />
        )}
      </div>

      {/* Description textarea */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-dim block mb-1.5">
          Descripcion
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe que informacion debe contener el template. Ej: Enviar al huesped una confirmacion con fechas de estadia, tipo de habitacion y numero de referencia."
          className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-md text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-y"
        />
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generando templates...
          </span>
        ) : (
          "Generar Templates"
        )}
      </button>
    </div>
  );
}
