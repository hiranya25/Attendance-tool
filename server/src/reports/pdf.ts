// The monthly report as a PDF: headline figures, the comparison with the previous month, charts,
// each person's month, and repeat patterns. Drawn with pdf-lib and its built-in Helvetica, so nothing
// needs installing on the server.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { Employee, MonthData, Office } from '../../../shared/types.ts';
import { COMPARE, monthFigures, personFigures, type MonthFigures } from '../../../shared/figures.ts';
import * as D from '../engine/dates.ts';
import { today } from '../config.ts';
import { patterns, summaryLines } from './summary.ts';

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  ink: hex('#142026'), muted: hex('#566a72'), line: hex('#dfe5e8'), soft: hex('#eef2f3'), white: hex('#ffffff'),
  accent: hex('#0e6b5e'), accentSoft: hex('#a9d5cd'), good: hex('#1b7446'), bad: hex('#b3261e'), warn: hex('#9a6a00'),
};
const W = 595.28, H = 841.89, M = 40, CW = W - 2 * M;

export interface PdfInput {
  data: MonthData;
  prev: MonthData | null;
  history: { month: string; figures: MonthFigures }[];
  employees: Employee[];
  offices: Office[];
  version: number;
}

/** Helvetica only covers Western European characters; swap the rest for plain ones. */
function safe(s: string): string {
  return s
    .replace(/[→⇒]/g, '->').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/[−]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/[^\x20-\x7e -ÿ–—‘’“”•…€]/g, '?');
}

class Writer {
  doc!: PDFDocument;
  page!: PDFPage;
  y = 0;
  r!: PDFFont;
  b!: PDFFont;
  constructor(private title: string) {}

  async init() {
    this.doc = await PDFDocument.create();
    this.doc.setTitle(this.title);
    this.doc.setCreator('Attendance Desk');
    this.r = await this.doc.embedFont(StandardFonts.Helvetica);
    this.b = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
  }

  /** Start a new page if fewer than h points are left. */
  room(h: number) {
    if (this.y - h < M + 24) this.newPage();
  }

  width(s: string, size: number, bold = false) {
    return (bold ? this.b : this.r).widthOfTextAtSize(safe(s), size);
  }

  draw(s: string, x: number, y: number, size: number, o: { bold?: boolean; color?: RGB } = {}) {
    this.page.drawText(safe(s), { x, y, size, font: o.bold ? this.b : this.r, color: o.color ?? C.ink });
  }

  /** Fit text into a width by cutting it short with an ellipsis. */
  fit(s: string, max: number, size: number, bold = false) {
    if (this.width(s, size, bold) <= max) return s;
    let t = s;
    while (t.length > 1 && this.width(`${t}…`, size, bold) > max) t = t.slice(0, -1);
    return `${t}…`;
  }

  wrap(s: string, max: number, size: number, bold = false): string[] {
    const out: string[] = [];
    let line = '';
    for (const word of safe(s).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (this.width(next, size, bold) <= max || !line) line = next;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    return out;
  }

  /** A paragraph at the current position. */
  para(s: string, o: { size?: number; bold?: boolean; color?: RGB; indent?: number; gap?: number } = {}) {
    const size = o.size ?? 9.5, lh = size * 1.4, x = M + (o.indent ?? 0);
    for (const l of this.wrap(s, CW - (o.indent ?? 0), size, o.bold)) {
      this.room(lh);
      this.draw(l, x, this.y - size, size, o);
      this.y -= lh;
    }
    this.y -= o.gap ?? 4;
  }

  heading(s: string, note?: string) {
    this.room(note ? 48 : 34);
    this.y -= 10;
    this.draw(s, M, this.y - 13, 13, { bold: true });
    this.y -= 19;
    if (note) this.para(note, { size: 8.5, color: C.muted, gap: 2 });
    this.y -= 4;
  }

  rect(x: number, y: number, w: number, h: number, color: RGB, border?: RGB) {
    this.page.drawRectangle({ x, y, width: w, height: h, color, ...(border ? { borderColor: border, borderWidth: 0.6 } : {}) });
  }

  line(x1: number, y1: number, x2: number, y2: number, color = C.line, t = 0.6) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color });
  }

  /** A table that continues on the next page, repeating its header. */
  table(cols: { label: string; w: number; align?: 'right' }[], rows: { cells: string[]; colors?: (RGB | undefined)[]; bold?: boolean }[]) {
    const size = 8.5, rh = 16;
    const total = cols.reduce((a, c) => a + c.w, 0);
    const xs = cols.map((_, i) => M + (cols.slice(0, i).reduce((a, c) => a + c.w, 0) / total) * CW);
    const ws = cols.map((c) => (c.w / total) * CW);
    const header = () => {
      this.room(rh * 2);
      this.rect(M, this.y - rh, CW, rh, C.soft);
      cols.forEach((c, i) => {
        const t = this.fit(c.label.toUpperCase(), ws[i] - 8, 7, true);
        const x = c.align === 'right' ? xs[i] + ws[i] - 4 - this.width(t, 7, true) : xs[i] + 4;
        this.draw(t, x, this.y - 10.5, 7, { bold: true, color: C.muted });
      });
      this.y -= rh;
    };
    header();
    for (const r of rows) {
      if (this.y - rh < M + 24) { this.newPage(); header(); }
      r.cells.forEach((cell, i) => {
        const t = this.fit(cell, ws[i] - 8, size, r.bold || i === 0);
        const x = cols[i].align === 'right' ? xs[i] + ws[i] - 4 - this.width(t, size, r.bold || i === 0) : xs[i] + 4;
        this.draw(t, x, this.y - 11, size, { bold: r.bold || i === 0, color: r.colors?.[i] });
      });
      this.line(M, this.y - rh, M + CW, this.y - rh);
      this.y -= rh;
    }
    this.y -= 6;
  }

  /** Horizontal bars, label on the left. */
  hbars(rows: { label: string; value: number }[], o: { max?: number; format?: (v: number) => string } = {}) {
    const fmt = o.format ?? String;
    const top = o.max ?? Math.max(1, ...rows.map((r) => r.value));
    const labelW = CW * 0.34, valW = 50, barW = CW - labelW - valW - 12, rh = 17;
    for (const r of rows) {
      this.room(rh);
      this.draw(this.fit(r.label, labelW - 6, 8.5), M, this.y - 11, 8.5);
      this.rect(M + labelW, this.y - 12, barW, 8, C.soft);
      this.rect(M + labelW, this.y - 12, Math.max(1, (Math.min(r.value, top) / top) * barW), 8, C.accent);
      const v = fmt(r.value);
      this.draw(v, M + CW - this.width(v, 8.5, true), this.y - 11, 8.5, { bold: true });
      this.y -= rh;
    }
    this.y -= 6;
  }

  /** Vertical bars with a light "out of" bar behind each one. */
  columns(points: { label: string; value: number; of?: number; dim?: boolean; text?: string }[], o: { height?: number; max?: number; labelEvery?: number } = {}) {
    const h = o.height ?? 120;
    this.room(h + 30);
    const top = o.max ?? Math.max(1, ...points.map((p) => Math.max(p.value, p.of ?? 0)));
    const base = this.y - h;
    const slot = CW / Math.max(1, points.length);
    const bw = Math.max(2, Math.min(34, slot * 0.66));
    this.line(M, base, M + CW, base, C.muted, 0.8);
    points.forEach((p, i) => {
      const x = M + i * slot + (slot - bw) / 2;
      if (p.of) this.rect(x, base, bw, (p.of / top) * (h - 14), C.soft);
      if (p.value > 0) this.rect(x, base, bw, (p.value / top) * (h - 14), p.dim ? C.accentSoft : C.accent);
      if (p.text) {
        const tw = this.width(p.text, 7.5, true);
        this.draw(p.text, x + bw / 2 - tw / 2, base + (Math.max(p.value, p.of ?? 0) / top) * (h - 14) + 3, 7.5, { bold: true });
      }
      if (!o.labelEvery || i % o.labelEvery === 0 || i === points.length - 1) {
        const lw = this.width(p.label, 7);
        this.draw(p.label, x + bw / 2 - lw / 2, base - 10, 7, { color: C.muted });
      }
    });
    this.y = base - 22;
  }

  footer(month: string) {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const t = `Attendance Desk · ${D.monthName(month)} · Page ${i + 1} of ${pages.length}`;
      p.drawText(safe(t), { x: M, y: 22, size: 7.5, font: this.r, color: C.muted });
    });
  }
}

const pct = (v: number) => `${v.toFixed(1)}%`;
const hhmm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

export async function writePdf(input: PdfInput): Promise<Buffer> {
  const { data, prev, history, employees, offices } = input;
  const emps = Object.fromEntries(employees.map((e) => [e.id, e]));
  const off = Object.fromEntries(offices.map((o) => [o.id, o.name]));
  const f = monthFigures(data);
  const pf = prev ? monthFigures(prev) : null;
  const prevName = D.monthName(D.prevMonth(data.month));
  const w = new Writer(`Attendance report ${D.monthName(data.month)}`);
  await w.init();

  // Title band
  w.rect(0, H - 92, W, 92, C.accent);
  w.draw('ATTENDANCE REPORT', M, H - 36, 9, { bold: true, color: C.accentSoft });
  w.draw(D.monthName(data.month), M, H - 64, 24, { bold: true, color: C.white });
  const meta = [`Data up to ${D.day(data.dataThrough)}`, `Version ${input.version}`, `Made ${D.day(today())}`].join('   ·   ');
  w.draw(meta, M, H - 80, 8.5, { color: C.accentSoft });
  w.y = H - 92 - 18;

  // Headline figures
  const tiles: { label: string; key: keyof MonthFigures; show: (v: number) => string; good: 'up' | 'down' | 'none' }[] = [
    { label: 'Present rate', key: 'presentRate', show: pct, good: 'up' },
    { label: 'Leave days', key: 'leaveDays', show: String, good: 'none' },
    { label: 'Unexplained absences', key: 'unexplained', show: String, good: 'down' },
    { label: 'Late marks', key: 'lateMarks', show: String, good: 'down' },
  ];
  const gap = 10, tw = (CW - gap * 3) / 4, th = 64;
  tiles.forEach((t, i) => {
    const x = M + i * (tw + gap);
    w.rect(x, w.y - th, tw, th, C.white, C.line);
    w.draw(t.label.toUpperCase(), x + 10, w.y - 16, 7, { bold: true, color: C.muted });
    w.draw(t.show(f[t.key]), x + 10, w.y - 38, 18, { bold: true });
    let note = `No data for ${prevName}`, color = C.muted;
    if (pf) {
      const d = f[t.key] - pf[t.key];
      note = `${d > 0 ? '+' : ''}${t.key === 'presentRate' ? d.toFixed(1) : d} vs ${D.monthName(D.prevMonth(data.month)).split(' ')[0]}`;
      if (d !== 0 && t.good !== 'none') color = (d > 0) === (t.good === 'up') ? C.good : C.bad;
    }
    w.draw(w.fit(note, tw - 20, 7.5), x + 10, w.y - 54, 7.5, { color });
  });
  w.y -= th + 6;

  w.heading('Summary');
  for (const l of summaryLines(data, emps)) w.para(`•  ${l}`, { indent: 0, gap: 2 });

  w.heading(`Compared with ${prevName}`, pf ? 'Green is better than the previous month, red is worse.' : `There is no attendance data for ${prevName}, so there is nothing to compare with.`);
  w.table(
    [{ label: 'Figure', w: 46 }, { label: D.monthName(data.month), w: 18, align: 'right' }, { label: prevName, w: 18, align: 'right' }, { label: 'Change', w: 18, align: 'right' }],
    COMPARE.map((c) => {
      const a = f[c.key], b = pf?.[c.key];
      const show = (v: number) => (c.unit === '%' ? pct(v) : c.unit === 'h' ? (v ? hhmm(v) : '-') : String(v));
      const d = b == null ? null : a - b;
      const color = d == null || d === 0 || c.good === 'none' ? undefined : (d > 0) === (c.good === 'up') ? C.good : C.bad;
      const change = d == null ? '-' : `${d > 0 ? '+' : d < 0 ? '-' : ''}${c.unit === '%' ? Math.abs(d).toFixed(1) : c.unit === 'h' ? hhmm(Math.abs(d)) : Math.abs(d)}`;
      return { cells: [c.label, show(a), b == null ? '-' : show(b), change], colors: [undefined, undefined, C.muted, color] };
    }),
  );

  // Charts
  w.newPage();
  const dates = D.monthDates(data.month).filter((d) => d <= data.dataThrough);
  const daily = dates.map((d) => {
    let present = 0, expected = 0;
    for (const days of Object.values(data.records)) {
      const r = days[d];
      if (!r) continue;
      if (r.code === 'P') present++;
      if (r.code === 'HD') present += 0.5;
      if (['P', 'HD', 'A', 'NR', 'LV'].includes(r.code)) expected++;
    }
    return { label: String(Number(d.slice(8))), value: present, of: expected, dim: expected === 0 };
  });
  w.heading('Present each day', 'Dark bar: people present. Light bar: people expected that day (including those on leave). Weekly offs and holidays show no bar.');
  w.columns(daily, { height: 130, labelEvery: dates.length > 20 ? 2 : 1 });

  const officeIds = [...new Set(Object.keys(data.records).map((id) => emps[id]?.officeId ?? ''))];
  const byOffice = officeIds.map((o) => {
    const ids = Object.keys(data.records).filter((id) => emps[id]?.officeId === o);
    const sub: MonthData = { ...data, records: Object.fromEntries(ids.map((id) => [id, data.records[id]])), issues: [], emails: [] };
    return { label: `${off[o] ?? o} (${ids.length})`, value: monthFigures(sub).presentRate };
  }).sort((a, b) => b.value - a.value);
  w.heading('Present rate by office');
  w.hbars(byOffice, { max: 100, format: pct });

  const byType = [...data.issues.filter((x) => x.state !== 'system').reduce((m, x) => m.set(x.type, (m.get(x.type) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  w.heading('Items found, by type', 'Likely device or sync problems are left out.');
  if (byType.length) w.hbars(byType.map(([label, value]) => ({ label, value })));
  else w.para('Nothing found this month.', { color: C.muted });

  if (history.length > 1) {
    w.heading('Last months', 'Present rate for each month with attendance data. This month is the last bar.');
    w.columns(history.map((h) => ({ label: D.monthName(h.month).slice(0, 3), value: h.figures.presentRate, text: pct(h.figures.presentRate), dim: h.month !== data.month })), { height: 110, max: 100 });
  }

  // People
  w.newPage();
  w.heading('Each person', 'Usual in: average first punch on days present. Hours: average hours on a day present. Emailed: absences or late arrivals the person told HR about by email. Unexpl.: absences with no word from the person.');
  const people = Object.keys(data.records).sort((a, b) => (emps[a]?.name ?? a).localeCompare(emps[b]?.name ?? b));
  w.table(
    [{ label: 'Person', w: 21 }, { label: 'Office', w: 15 }, { label: 'Present', w: 9, align: 'right' }, { label: 'Usual in', w: 9, align: 'right' }, { label: 'Hours', w: 7, align: 'right' },
      { label: 'Leave', w: 7, align: 'right' }, { label: 'Lates', w: 7, align: 'right' }, { label: 'Early', w: 7, align: 'right' }, { label: 'Emailed', w: 9, align: 'right' }, { label: 'Unexpl.', w: 9, align: 'right' }],
    people.map((id) => {
      const p = personFigures(data, id);
      const e = emps[id];
      return {
        cells: [e?.name ?? id, off[e?.officeId ?? ''] ?? '', pct(p.presentRate), p.avgLogin == null ? '-' : `${String(Math.floor(p.avgLogin / 60)).padStart(2, '0')}:${String(p.avgLogin % 60).padStart(2, '0')}`,
          p.avgMinutes ? hhmm(p.avgMinutes) : '-', String(p.leaveDays), String(p.lates), String(p.early), String(p.communicated), String(p.unexplained)],
        colors: [undefined, C.muted, undefined, undefined, undefined, undefined, undefined, undefined, undefined, p.unexplained ? C.bad : undefined],
      };
    }),
  );

  const pats = Object.entries(patterns(data.issues));
  const before = prev ? patterns(prev.issues) : {};
  w.heading('Repeat patterns', 'Any late mark beyond the office allowance, 2 or more unexplained absences, or 2 or more missing punches. Explained and system items are not counted.');
  if (pats.length) {
    w.table(
      [{ label: 'Person', w: 32 }, { label: 'Lates over limit', w: 18, align: 'right' }, { label: 'Unexplained', w: 16, align: 'right' }, { label: 'Missing punches', w: 18, align: 'right' }, { label: `Also in ${prevName.slice(0, 3)}`, w: 16 }],
      pats.sort((a, b) => b[1].unexplained - a[1].unexplained || b[1].lates - a[1].lates).map(([id, p]) => ({
        cells: [emps[id]?.name ?? id, String(p.lates), String(p.unexplained), String(p.punches), before[id] ? 'Yes' : 'No'],
        colors: [undefined, p.lates ? C.bad : undefined, p.unexplained >= 2 ? C.bad : undefined, p.punches >= 2 ? C.bad : undefined, before[id] ? C.warn : C.muted],
      })),
    );
  } else w.para('No repeat patterns this month.', { color: C.muted });

  w.footer(data.month);
  return Buffer.from(await w.doc.save());
}
