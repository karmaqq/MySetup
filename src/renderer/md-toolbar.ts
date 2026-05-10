/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          MD ARAÇ ÇUBUĞU                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

import { escAttr, escHtml } from "./utils";

/* ─────────────────── Buton SVG'leri ─────────────────── */

var SVGS: Record<string, string> = {
  heading:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="4" x2="12" y2="20"/><line x1="5" y1="4" x2="19" y2="4"/><line x1="5" y1="20" x2="19" y2="20"/></svg>',
  bold:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>',
  italic:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="14" y1="4" x2="10" y2="20"/><line x1="10" y1="4" x2="18" y2="4"/><line x1="6" y1="20" x2="14" y2="20"/></svg>',
  link:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  code:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  quote:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2c1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>',
  hr:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>',
};

/* ─────────────────── Buton Tanımları ─────────────────── */

interface MdToolBtn {
  id: string;
  action: string;
  title: string;
  svg: string;
}

var FULL_BTNS: MdToolBtn[] = [
  { id: "md-heading", action: "heading", title: "Başlık", svg: SVGS.heading },
  { id: "md-bold", action: "bold", title: "Kalın", svg: SVGS.bold },
  { id: "md-italic", action: "italic", title: "İtalik", svg: SVGS.italic },
  { id: "md-link", action: "link", title: "Bağlantı", svg: SVGS.link },
  { id: "md-code", action: "code", title: "Kod", svg: SVGS.code },
  { id: "md-quote", action: "quote", title: "Alıntı", svg: SVGS.quote },
  { id: "md-hr", action: "hr", title: "Ayraç", svg: SVGS.hr },
];

var MINI_BTNS: MdToolBtn[] = [
  { id: "md-bold", action: "bold", title: "Kalın", svg: SVGS.bold },
  { id: "md-italic", action: "italic", title: "İtalik", svg: SVGS.italic },
  { id: "md-link", action: "link", title: "Bağlantı", svg: SVGS.link },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          TOOLBAR BAŞLATMA                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Toolbar + Editor'ü başlatır ─────────────────── */

export function initMdToolbar(
  container: HTMLElement,
  editor: HTMLElement,
  mini?: boolean,
): void {
  var btns = mini ? MINI_BTNS : FULL_BTNS;
  container.innerHTML = "";
  container.className = "md-toolbar" + (mini ? " md-toolbar-mini" : "");
  for (var i = 0; i < btns.length; i++) {
    var b = btns[i];
    var btn = document.createElement("button");
    btn.className = "md-tool-btn";
    btn.id = container.id + "-" + b.id;
    btn.title = b.title;
    btn.innerHTML = b.svg;
    btn.dataset.mdAction = b.action;
    btn.addEventListener("mousedown", _onToolMousedown(editor));
    btn.addEventListener("click", _onToolClick(editor));
    container.appendChild(btn);
  }
  _setupEditor(editor);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          SEÇİM YÖNETİMİ                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Seçimi kaydet ─────────────────── */

var _savedRangeForEditor: WeakMap<HTMLElement, Range | null> = new WeakMap();

function _saveSelection(editor: HTMLElement): Range | null {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  var range = sel.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) {
    return range.cloneRange();
  }
  return null;
}

/* ─────────────────── Kaydedilen seçimi geri yükle ─────────────────── */

function _restoreSelection(editor: HTMLElement, saved: Range | null): void {
  if (!saved) return;
  var sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(saved);
}

/* ─────────────────── Mousedown: buton focus'tan önce seçimi yakala ─────────────────── */

function _onToolMousedown(editor: HTMLElement): (e: MouseEvent) => void {
  return function () {
    _savedRangeForEditor.set(editor, _saveSelection(editor));
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                          BUTON İŞLEMLERİ                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Click: seçimi geri yükle, işlemi yap ─────────────────── */

function _onToolClick(editor: HTMLElement): (e: MouseEvent) => void {
  return function (e: MouseEvent) {
    var btn = e.currentTarget as HTMLElement;
    var action = btn.dataset.mdAction || "";
    editor.focus();
    _restoreSelection(editor, _savedRangeForEditor.get(editor) || null);
    _execAction(editor, action);
  };
}

function _execAction(editor: HTMLElement, action: string): void {
  var sel = window.getSelection();
  var hasSelection = !!sel && !sel.isCollapsed && sel.toString().trim().length > 0;

  switch (action) {
    case "bold":
      if (!hasSelection) return;
      _wrapInline(editor, "strong", "b");
      break;
    case "italic":
      if (!hasSelection) return;
      _wrapInline(editor, "em", "i");
      break;
    case "heading":
      if (!hasSelection) return;
      _execHeading(editor);
      break;
    case "link":
      if (!hasSelection) return;
      _execLink(editor);
      break;
    case "code":
      _execCode(editor, hasSelection);
      break;
    case "quote":
      if (!hasSelection) return;
      _execQuote(editor);
      break;
    case "hr":
      _execHr(editor);
      break;
  }
}

/* ─────────────────── İçinde bulunulan blok elementini bul ─────────────────── */

function _getBlockNode(
  node: Node | null,
  root: HTMLElement,
): HTMLElement | null {
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      var el = node as HTMLElement;
      var tag = el.nodeName.toLowerCase();
      if (
        tag === "p" ||
        tag === "h1" ||
        tag === "h2" ||
        tag === "h3" ||
        tag === "h4" ||
        tag === "h5" ||
        tag === "blockquote" ||
        tag === "pre"
      )
        return el;
    }
    node = node.parentNode;
  }
  return null;
}

/* ─────────────────── Blok elementi değiştir, cursor'u yenisine taşı ─────────────────── */

function _replaceBlock(old: HTMLElement, newTag: string): void {
  var el = document.createElement(newTag);
  el.innerHTML = old.innerHTML;
  var parent = old.parentNode;
  if (parent) parent.replaceChild(el, old);
  var range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  var sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      İNLINE FORMATLAMA (bold, italic)                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Seçili metni inline etikete sar / çıkar ─────────────────── */

function _wrapInline(
  editor: HTMLElement,
  primaryTag: string,
  altTag?: string,
): void {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  if (range.collapsed) return;

  var start = range.startContainer;
  var end = range.endContainer;
  var startEl = start.nodeType === 3 ? start.parentElement : (start as Element);
  var endEl = end.nodeType === 3 ? end.parentElement : (end as Element);

  var closest = _closestTag(startEl, primaryTag, altTag);
  if (closest && editor.contains(closest)) {
    var endClosest = _closestTag(endEl, primaryTag, altTag);
    if (endClosest === closest) {
      _unwrapElement(closest);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
  }

  var el = document.createElement(primaryTag);
  try {
    range.surroundContents(el);
  } catch (_e) {
    var frag = range.extractContents();
    el.appendChild(frag);
    range.insertNode(el);
  }

  var newRange = document.createRange();
  newRange.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

function _closestTag(
  el: Element | null,
  primary: string,
  alt?: string,
): HTMLElement | null {
  while (el) {
    var tag = el.nodeName.toLowerCase();
    if (tag === primary || (alt && tag === alt)) return el as HTMLElement;
    el = el.parentElement;
  }
  return null;
}

function _unwrapElement(el: HTMLElement): void {
  var parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      BAŞLIK İŞLEMLERİ                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Heading: h1 ↔ p (tek seviye) ─────────────────── */

function _execHeading(editor: HTMLElement): void {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  if (range.collapsed) return;
  var block = _getBlockNode(range.startContainer, editor);
  if (block && block !== editor && block.parentNode === editor) {
    var tag = block.nodeName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3") _replaceBlock(block, "p");
    else _replaceBlock(block, "h1");
  } else {
    var h = document.createElement("h1");
    var frag = range.extractContents();
    h.appendChild(frag);
    range.insertNode(h);
    var newRange = document.createRange();
    newRange.selectNodeContents(h);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      BAĞLANTI İŞLEMLERİ                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Link: seçili metni [metin](url girin) yap ─────────────────── */

function _execLink(editor: HTMLElement): void {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  var selectedText = sel.toString();
  if (!selectedText.trim()) return;
  var PLACEHOLDER = "url girin";
  var raw = "[" + selectedText + "](" + PLACEHOLDER + ")";
  range.deleteContents();
  var text = document.createTextNode(raw);
  range.insertNode(text);
  var urlStart = selectedText.length + 3;
  range.setStart(text, urlStart);
  range.setEnd(text, urlStart + PLACEHOLDER.length);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      KOD İŞLEMLERİ                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Code: seçimi sar veya boş aç, alt satır ekle ─────────────────── */

function _execCode(editor: HTMLElement, hasSelection: boolean): void {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var raw = hasSelection ? sel.toString() : "";
  var range = sel.getRangeAt(0);
  range.deleteContents();

  var wrapper = document.createElement("pre");
  wrapper.setAttribute("data-placeholder", "Kodunuzu yazın...");
  var code = document.createElement("code");

  if (hasSelection && raw) {
    code.textContent = raw;
  } else {
    wrapper.classList.add("is-empty");
    code.innerHTML = "<br>";
  }

  wrapper.appendChild(code);
  range.insertNode(wrapper);

  var after = document.createElement("p");
  after.innerHTML = "<br>";
  wrapper.parentNode?.insertBefore(after, wrapper.nextSibling);

  var newRange = document.createRange();
  if (hasSelection) {
    newRange.setStart(after, 0);
  } else {
    newRange.setStart(code, 0);
  }
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      ALINTI İŞLEMLERİ                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Quote: seçimi alıntı yap veya toggle ─────────────────── */

function _execQuote(editor: HTMLElement): void {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  var block = _getBlockNode(range.startContainer, editor);
  if (block && block !== editor && block.parentNode === editor) {
    var tag = block.nodeName.toLowerCase();
    if (tag === "blockquote") _replaceBlock(block, "p");
    else _replaceBlock(block, "blockquote");
  } else {
    var bq = document.createElement("blockquote");
    var frag = range.extractContents();
    bq.appendChild(frag);
    range.insertNode(bq);
    var p = document.createElement("p");
    p.innerHTML = "<br>";
    bq.parentNode?.insertBefore(p, bq.nextSibling);
    var newRange = document.createRange();
    newRange.setStart(p, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      AYRAÇ İŞLEMLERİ                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── HR: ayraç ekle + alt satır ─────────────────── */

function _execHr(editor: HTMLElement): void {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  var hr = document.createElement("hr");
  range.deleteContents();
  range.insertNode(hr);
  var p = document.createElement("p");
  p.innerHTML = "<br>";
  hr.parentNode?.insertBefore(p, hr.nextSibling);
  var newRange = document.createRange();
  newRange.setStart(p, 0);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                         EDITOR OLAY YÖNETİMİ                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Editor olaylarını bağla ─────────────────── */

var _autoTimers: WeakMap<HTMLElement, number | null> = new WeakMap();

function _setupEditor(editor: HTMLElement): void {
  editor.addEventListener("paste", _onPaste);
  editor.addEventListener("input", function () {
    _scheduleAutoConvert(editor);
    _updateCodePlaceholders(editor);
  });
  editor.addEventListener("blur", function () {
    _revertLinkPlaceholders(editor);
  });
  editor.addEventListener("keydown", function (e: KeyboardEvent) {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      editor.getAttribute("data-submit-on-enter") === "true"
    ) {
      e.preventDefault();
      editor.dispatchEvent(new CustomEvent("submit-md"));
    }
  });
}

/* ─────────────────── Paste'te düz metin yapıştır ─────────────────── */

function _onPaste(e: ClipboardEvent): void {
  e.preventDefault();
  var text = (e.clipboardData || (window as any).clipboardData).getData(
    "text/plain",
  );
  if (!text) return;
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      OTOMATİK MD DÖNÜŞÜMÜ                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Schedule auto-convert with debounce ─────────────────── */

function _scheduleAutoConvert(editor: HTMLElement): void {
  var existing = _autoTimers.get(editor);
  if (existing) clearTimeout(existing);
  _autoTimers.set(
    editor,
    window.setTimeout(function () {
      _applyAutoConvert(editor);
    }, 600),
  );
}

/* ─────────────────── Text düğümlerinde MD pattern'lerini bul ve dönüştür ─────────────────── */

var _mdRules: [RegExp, (...args: string[]) => string][] = [
  [/\*\*(.+?)\*\*/g, function (_, c) { return "<strong>" + escHtml(c) + "</strong>"; }],
  [/\*(.+?)\*/g, function (_, c) { return "<em>" + escHtml(c) + "</em>"; }],
  [/~~(.+?)~~/g, function (_, c) { return "<s>" + escHtml(c) + "</s>"; }],
  [/`([^`\n]+)`/g, function (_, c) { return "<code>" + escHtml(c) + "</code>"; }],
  [/\[([^\]]+)\]\(([^)]+)\)/g, function (_, t, u) { return '<a href="' + escAttr(u) + '">' + escHtml(t) + "</a>"; }],
];

function _applyAutoConvert(editor: HTMLElement): void {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var cursorOffset = _getTextOffset(editor);
  if (cursorOffset < 0) return;

  var html = editor.innerHTML;
  var changed = false;

  for (var r = 0; r < _mdRules.length; r++) {
    var rule = _mdRules[r];
    var regex = rule[0];
    var fn = rule[1];
    var newHtml = html.replace(regex, fn);
    if (newHtml !== html) {
      html = newHtml;
      changed = true;
    }
  }

  if (changed) {
    editor.innerHTML = html;
    _restoreCursorPos(editor, cursorOffset);
  }
}

/* ─────────────────── Cursor'un metin offset'ini al ─────────────────── */

function _getTextOffset(editor: HTMLElement): number {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return -1;
  var range = sel.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return -1;
  var pre = document.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

/* ─────────────────── Cursor'u offset'e göre geri yükle ─────────────────── */

function _restoreCursorPos(editor: HTMLElement, offset: number): void {
  if (offset < 0) return;
  var sel = window.getSelection();
  if (!sel) return;
  var charCount = 0;
  var found = false;

  function walk(node: Node): void {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      var len = (node.textContent || "").length;
      if (charCount + len >= offset) {
        var r = document.createRange();
        r.setStart(node, Math.min(offset - charCount, len));
        r.collapse(true);
        sel!.removeAllRanges();
        sel!.addRange(r);
        found = true;
        return;
      }
      charCount += len;
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).contentEditable !== "false"
    ) {
      for (var i = 0; i < node.childNodes.length; i++) {
        if (!found) walk(node.childNodes[i]);
      }
    }
  }
  walk(editor);
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                    KOD YER TUTUCU / LİNK GERİ ALMA                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Kod bloğu placeholder'ını göster/gizle ─────────────────── */

function _updateCodePlaceholders(editor: HTMLElement): void {
  var pres = editor.querySelectorAll("pre[data-placeholder]");
  for (var i = 0; i < pres.length; i++) {
    var pre = pres[i] as HTMLElement;
    var code = pre.querySelector("code");
    var hasText = code && code.textContent && code.textContent.replace(/\s/g, "").length > 0;
    pre.classList.toggle("is-empty", !hasText);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                      LİNK YER TUTUCU GERİ ALMA                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Blur'da [metin](url girin) → düz metin ─────────────────── */

function _revertLinkPlaceholders(editor: HTMLElement): void {
  var html = editor.innerHTML;
  var changed = false;
  var rawReg = /\[([^\]]+)\]\(url girin\)/g;
  html = html.replace(rawReg, function (_, text) {
    changed = true;
    return text;
  });
  var linkReg = /<a[^>]*href="url girin"[^>]*>([\s\S]*?)<\/a>/gi;
  html = html.replace(linkReg, function (_, content) {
    changed = true;
    return content;
  });
  if (changed) editor.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*                     HTML → MD DÖNÜŞÜMÜ                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────── Contenteditable içeriğini MD'ye çevir ─────────────────── */

export function editorToMd(editor: HTMLElement): string {
  var html = editor.innerHTML;
  if (!html || html === "<br>") return "";

  var md = html;

  md = md.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, function (_, c) {
    return "```\n" + c + "\n```";
  });

  md = md.replace(/<code>([^<]+)<\/code>/g, "`$1`");

  md = md.replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/g, "**$1**");
  md = md.replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/g, "*$1*");
  md = md.replace(/<(?:s|strike|del)>([\s\S]*?)<\/(?:s|strike|del)>/g, "~~$1~~");

  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)");

  md = md.replace(/<h1>([\s\S]*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2>([\s\S]*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3>([\s\S]*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4>([\s\S]*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5>([\s\S]*?)<\/h5>/gi, "##### $1\n\n");

  md = md.replace(/<blockquote>/gi, "> ");
  md = md.replace(/<\/blockquote>/gi, "\n\n");

  md = md.replace(/<hr\s*\/?>/gi, "\n---\n");

  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<p>/gi, "");
  md = md.replace(/<div>/gi, "");
  md = md.replace(/<\/div>/gi, "\n");

  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");

  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/\n{3,}/g, "\n\n");
  return md.trim();
}

/* ─────────────────── Editor'ü temizle ─────────────────── */

export function clearEditor(editor: HTMLElement): void {
  editor.innerHTML = "";
}

/* ─────────────────── MD metnini editor'e yükle ─────────────────── */

export function mdToEditor(editor: HTMLElement, md: string): void {
  if (!md) {
    editor.innerHTML = "";
    return;
  }
  var html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
      return "<pre><code>" + code.trim() + "</code></pre>";
    })
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr>")
    .replace(/\n/g, "<br>");
  editor.innerHTML = html;
}
