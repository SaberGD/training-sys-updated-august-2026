import React from 'react';

// Renders trainer-written briefs (graduation project details, requirements, rules)
// with a light Markdown/WhatsApp-style syntax:
//   # / ## / ### heading      --- divider
//   - item / • item / * item  bullet list       1. item / 1) item  numbered list
//   **bold** or *bold*        _italic_          `code`             links are auto-detected
// Output is built from React elements only (no raw HTML), so pasted text can't inject markup.

// Invisible characters that WhatsApp/Telegram copy-paste leaves around bullets.
const INVISIBLE = /[​-‏⁠⁦-⁩﻿]/g;

const BULLET = /^\s*(?:[-*•·◦▪●]|•)\s+(.*)$/;
const NUMBERED = /^\s*([0-9٠-٩]+)[.)\-]\s+(.*)$/;
const HEADING = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/;
const DIVIDER = /^\s*(?:-{3,}|\*{3,}|_{3,}|—{2,})\s*$/;

// Any Arabic letter makes the block right-to-left, even if it starts with a Latin brand name.
const dirOf = (text: string): 'rtl' | 'ltr' => (/[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr');

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|https?:\/\/[^\s<]+)/g;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const parts = text.split(INLINE);
  return parts.filter(p => p !== '').map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key} className="font-black text-white">{renderInline(part.slice(2, -2), key)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <strong key={key} className="font-black text-white">{part.slice(1, -1)}</strong>;
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key} className="px-1.5 py-0.5 rounded-md bg-white/10 font-mono text-[0.95em]" dir="ltr">{part.slice(1, -1)}</code>;
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={key} href={part} target="_blank" rel="noreferrer" dir="ltr" className="text-[#ff9b47] underline underline-offset-2 break-all hover:text-white">
          {part}
        </a>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
};

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'divider' }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; lines: string[] };

const parseBlocks = (source: string): Block[] => {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').replace(INVISIBLE, '').split('\n');
  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ');
    const last = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ type: 'p', lines: [] }); // paragraph break marker
      continue;
    }
    let m: RegExpMatchArray | null;
    if (DIVIDER.test(line)) {
      blocks.push({ type: 'divider' });
    } else if ((m = line.match(HEADING))) {
      blocks.push({ type: 'heading', level: m[1].length, text: m[2] });
    } else if ((m = line.match(BULLET))) {
      if (last && last.type === 'ul') last.items.push(m[1]);
      else blocks.push({ type: 'ul', items: [m[1]] });
    } else if ((m = line.match(NUMBERED))) {
      if (last && last.type === 'ol') last.items.push(m[2]);
      else blocks.push({ type: 'ol', items: [m[2]] });
    } else if (last && last.type === 'p' && last.lines.length) {
      last.lines.push(line.trim());
    } else {
      blocks.push({ type: 'p', lines: [line.trim()] });
    }
  }
  return blocks.filter(b => b.type !== 'p' || b.lines.length > 0);
};

/** Plain-text version for short previews (strips the formatting marks). */
export const briefToPlainText = (source: string): string =>
  parseBlocks(source || '')
    .map(b => {
      if (b.type === 'heading') return b.text;
      if (b.type === 'ul' || b.type === 'ol') return b.items.join('، ');
      if (b.type === 'p') return b.lines.join(' ');
      return '';
    })
    .filter(Boolean)
    .join(' • ')
    .replace(/\*\*?|`|(^|\s)_|_(\s|$)/g, '$1$2');

const BriefText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const blocks = parseBlocks(text || '');
  return (
    <div className={`sg-brief space-y-2.5 leading-relaxed ${className}`}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.type) {
          case 'heading': {
            const size = block.level <= 1 ? 'text-base' : block.level === 2 ? 'text-[15px]' : 'text-sm';
            return (
              <h4 key={key} dir={dirOf(block.text)} className={`${size} font-black text-white flex items-center gap-2 pt-1.5 first:pt-0`}>
                <span className="w-1 self-stretch min-h-[1em] rounded-full bg-gradient-to-b from-[#ff8a1f] to-[#d83b25] shrink-0" />
                <span>{renderInline(block.text, key)}</span>
              </h4>
            );
          }
          case 'divider':
            return <hr key={key} className="border-0 h-px bg-white/10 my-1" />;
          case 'ul':
            return (
              <ul key={key} className="space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} dir={dirOf(item)} className="flex items-start gap-2">
                    <span className="mt-[0.55em] w-1.5 h-1.5 rounded-full bg-[#ff8a1f] shrink-0" />
                    <span>{renderInline(item, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} dir={dirOf(item)} className="flex items-start gap-2">
                    <span className="min-w-[1.4rem] h-[1.4rem] mt-px rounded-md bg-[#d83b25]/15 border border-[#d83b25]/30 text-[#ff9b47] text-[10px] font-black flex items-center justify-center shrink-0">{j + 1}</span>
                    <span>{renderInline(item, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={key} dir={dirOf(block.lines.join(' '))}>
                {block.lines.map((l, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    {renderInline(l, `${key}-${j}`)}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
};

/** Inline-only formatting (bold, italic, code, links) for single-line items such as rules. */
export const BriefInline: React.FC<{ text: string }> = ({ text }) => (
  <>{renderInline((text || '').replace(INVISIBLE, ''), 'i')}</>
);

export default BriefText;
