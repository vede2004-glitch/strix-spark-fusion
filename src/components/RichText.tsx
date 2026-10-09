import type { ReactNode } from "react";

/**
 * A hírszövegben maradt Markdown-félkövér jelöléseket (`**szöveg**`)
 * valódi félkövérré alakítja; a többi szöveg változatlan marad.
 * Lezáratlan csillagpárt (`**valami`) érintetlenül hagy.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const re = /\*\*(.+?)\*\*/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<strong key={key++} className="font-bold">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  nodes.push(text.slice(last));
  return <span className={className}>{nodes}</span>;
}

/** Meta leíráshoz: a csillagjelek kitérve, a szöveg megmarad. */
export function plainBold(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}
