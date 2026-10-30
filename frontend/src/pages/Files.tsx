import { useEffect, useRef, useState } from 'react';
import { api, usingSampleData } from '../api';
import { useApp } from '../store';
import { Empty, PageHead, Panel, Pill } from '../components/ui';
import { fmtMonth, fmtWhen } from '../lib/format';
import type { ImportRecord } from '../types';

/** Upload the punch system's monthly export, and see every file the tool has taken in. */
export function Files() {
  const { ref, reload, toast, setMonth } = useApp();
  const [list, setList] = useState<ImportRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isAdmin = ref.user?.role === 'admin';

  const refresh = () => api.listImports().then(setList).catch(() => setList([]));
  useEffect(() => { void refresh(); }, []);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await api.uploadImport(file);
      if (r.kind === 'team' && r.team) {
        const t = r.team;
        setResult({ ok: true, text: `Team list read: ${t.updated.length} people matched and updated, ${t.added.length} added, ${t.notTracked.length} not tracked (NA).${t.notOnList.length ? ` Not on the team list: ${t.notOnList.join(', ')}.` : ''} Check the People page.` });
      } else {
        const what = r.kind === 'sheet' ? 'Mumbai attendance sheet' : 'punch export';
        setResult({ ok: true, text: `Imported the ${what} for ${r.months.map(fmtMonth).join(', ')}: ${r.people} people, ${r.days} days.${r.newPeople.length ? ` New people added (check them on the People page): ${r.newPeople.join(', ')}.` : ''} Everything has been checked again.` });
      }
      toast('File imported');
      await refresh();
      if (r.months[0]) setMonth(r.months[r.months.length - 1]);
      else await reload();
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <PageHead
        title="Attendance files"
        sub={`The monthly "Month Date Wise Performance" export from the punch system. Upload it here, or email it to ${ref.settings.hrEmail} and the tool imports it by itself. You can upload the month so far at any time; a newer file for the same month replaces the older one.`}
      />
      {isAdmin && (
        <Panel title="Upload a file" note="A newer file for the same month replaces the older one. The older file is kept and any punches that arrive late are logged.">
          <label
            htmlFor="file-input"
            className={`drop${drag ? ' on' : ''}${busy ? ' busy' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files[0]); }}
          >
            <b>{busy ? 'Importing and checking…' : 'Choose a file, or drop it here'}</b>
            <span className="muted small">The punch export (monthdatewiseperformance….xls), the Mumbai attendance sheet, or the team list (.ods / .xlsx). The tool works out which one it is.</span>
            <input id="file-input" ref={input} type="file" accept=".xls,.xlsx,.ods" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
          </label>
          {result && <p className={result.ok ? 'note ok' : 'error'} role="status">{result.text}</p>}
          {usingSampleData && <p className="muted small">This is the demo with sample data, so uploads are turned off here.</p>}
        </Panel>
      )}
      <Panel title="Files received" flush>
        {list === null ? <Empty>Loading…</Empty> : list.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Month</th><th>File</th><th>How it arrived</th><th>When</th><th className="num">People</th><th className="num">Days</th></tr></thead>
              <tbody>
                {list.map((f, i) => {
                  const current = list.findIndex((x) => x.month === f.month && (x.scope ?? 'punch') === (f.scope ?? 'punch')) === i;
                  return (
                    <tr key={f.id}>
                      <td className="nowrap"><b>{fmtMonth(f.month)}</b> {current ? <Pill tone="ok">In use</Pill> : <Pill tone="mute">Replaced</Pill>}</td>
                      <td className="mono small wide">{f.fileName}<span className="sub">{(f.scope ?? 'punch') === 'punch' ? 'Punch export' : 'Mumbai sheet'}</span></td>
                      <td className="nowrap">{f.source === 'email' ? 'Email' : 'Upload'} <span className="muted small">{f.importedBy}</span></td>
                      <td className="nowrap mono small">{fmtWhen(f.importedAt)}</td>
                      <td className="num">{f.people}</td>
                      <td className="num">{f.days}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No files yet. Upload the first one above.</Empty>}
      </Panel>
    </>
  );
}
