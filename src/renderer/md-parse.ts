/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         MARKDOWN — HTML DÖNÜŞTÜRÜCÜ                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { escAttr } from "./utils";

/* ─────────────────── MD Metnini HTML'e Çevirir ─────────────────── */

export function mdToHtml(text: string): string {
  if (!text) return "";

  /* ── 1. Kod bloklarını ayır (işlenmez) ── */

  var codeBlocks: string[] = [];
  var html = text.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
    var idx = codeBlocks.length;
    var cls = lang ? ' class="language-' + escAttr(lang) + '"' : "";
    codeBlocks.push(
      "<pre><code" + cls + ">" + code.trim() + "</code></pre>",
    );
    return "%%CB" + idx + "%%";
  });

  /* ── 2. Satır satır işle: blok ögeler, sonra escape + inline ── */

  var lines = html.split("\n");
  var out: string[] = [];
  var buf: string[] = [];

  function flushBuf(): void {
    if (buf.length === 0) return;
    var para = buf.join("\n");
    para = para
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    para = para.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    para = para.replace(/\*(.+?)\*/g, "<em>$1</em>");
    para = para.replace(/~~(.+?)~~/g, "<s>$1</s>");
    para = para.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      function (_, t, u) {
        return (
          '<a href="' +
          escAttr(u) +
          '" target="_blank" rel="noopener noreferrer">' +
          t +
          "</a>"
        );
      },
    );
    para = para.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    out.push("<p>" + para.replace(/\n/g, "<br>") + "</p>");
    buf = [];
  }

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var trimmed = raw.trim();

    if (!trimmed) {
      flushBuf();
      continue;
    }

    /* Ayraç */
    if (/^---$/.test(trimmed)) {
      flushBuf();
      out.push("<hr>");
      continue;
    }

    /* Başlık */
    var h = trimmed.match(/^(#{1,5})\s(.*)$/);
    if (h) {
      flushBuf();
      var hContent = h[2]
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      out.push("<h" + h[1].length + ">" + hContent + "</h" + h[1].length + ">");
      continue;
    }

    /* Alıntı (tek seviye) */
    if (/^>\s/.test(trimmed)) {
      flushBuf();
      var qContent = trimmed.replace(/^>\s+/, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      out.push("<blockquote>" + qContent + "</blockquote>");
      continue;
    }

    buf.push(raw);
  }

  flushBuf();

  html = out.join("\n");
  html = html.replace(/%%CB(\d+)%%/g, function (_, idx) {
    return codeBlocks[parseInt(idx, 10)] || "";
  });

  return html;
}
