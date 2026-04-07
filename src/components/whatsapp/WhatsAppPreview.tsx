"use client";

import type { TemplateContent } from "@/lib/whatsapp/types";

interface Props {
  content: TemplateContent;
}

export default function WhatsAppPreview({ content }: Props) {
  function renderText(text: string) {
    // Highlight {{named}} and {{n}} variables
    const parts = text.split(/(\{\{\w+\}\})/g);
    return parts.map((part, i) =>
      /\{\{\w+\}\}/.test(part) ? (
        <span key={i} className="text-accent font-mono text-xs bg-accent/10 px-0.5 rounded">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }

  return (
    <div className="bg-[#0b141a] rounded-xl p-4 max-w-sm">
      {/* WhatsApp header bar */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
        <div className="w-8 h-8 rounded-full bg-[#25d366]/20 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25d366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.121 1.521 5.857L0 24l6.335-1.652A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.97 0-3.837-.517-5.456-1.42l-.39-.232-3.758.982.999-3.648-.254-.403A9.72 9.72 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
          </svg>
        </div>
        <div>
          <div className="text-white/90 text-xs font-medium">Hotel</div>
          <div className="text-white/40 text-[10px]">Business Account</div>
        </div>
      </div>

      {/* Message bubble */}
      <div className="bg-[#005c4b] rounded-lg rounded-tl-none p-3 max-w-[280px] ml-0">
        {content.header && (
          <div className="text-white/95 text-sm font-semibold mb-1">
            {renderText(content.header)}
          </div>
        )}
        <div className="text-white/90 text-[13px] leading-relaxed whitespace-pre-wrap">
          {renderText(content.body)}
        </div>
        {content.footer && (
          <div className="text-white/50 text-[11px] mt-2">
            {renderText(content.footer)}
          </div>
        )}
        <div className="text-white/30 text-[10px] text-right mt-1">12:00</div>
      </div>

      {/* Buttons */}
      {content.buttons && content.buttons.length > 0 && (
        <div className="mt-1 max-w-[280px] space-y-0.5">
          {content.buttons.map((btn, i) => (
            <div
              key={i}
              className="bg-[#005c4b]/50 rounded-lg py-2 text-center text-[#53bdeb] text-sm font-medium"
            >
              {btn.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
