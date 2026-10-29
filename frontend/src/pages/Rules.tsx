import { useEffect, useState, type ReactNode } from 'react';
import { api, usingSampleData } from '../api';
import { resetDemo } from '../mock/mockApi';
import { useApp } from '../store';
import { PageHead, Panel } from '../components/ui';
import { fmtDay, hm, parseHm } from '../lib/format';
import type { Holiday, Settings } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Rules() {
  const { ref, reload, toast } = useApp();
  const [s, setS] = useState<Settings>(ref.settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(ref.settings), [ref.settings]);
  const dirty = JSON.stringify(s) !== JSON.stringify(ref.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    await api.saveSettings(s);
    await reload();
    setBusy(false);
    toast('Saved. Every month was checked again with the new rules.');
  }

  return (
    <>
      <PageHead
        title="Rules & calendars"
        sub="The tool follows these rules on its own. Change a value and save, and every month is checked again. Each change is written to the change log."
        actions={
          <>
            {usingSampleData && <button className="btn sm" onClick={async () => { resetDemo(); await reload(); toast('Demo reset to the starting rules'); }}>Reset demo</button>}
            <button className="btn sm pri" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
          </>
        }
      />
      {dirty && <p className="note">You have unsaved changes.</p>}

      <div className="two">
        <Panel title="Office timings" note="Scheduled hours in each office's own time zone.">
          <div className="form">
            {ref.offices.map((o) => (
              <fieldset key={o.id} className="shift">
                <legend>{o.name} <span className="muted small">{o.tzLabel}</span></legend>
                <label htmlFor={`st-${o.id}`}>Start<input id={`st-${o.id}`} type="time" value={hm(s.shifts[o.id].start)} onChange={(e) => e.target.value && set('shifts', { ...s.shifts, [o.id]: { ...s.shifts[o.id], start: parseHm(e.target.value) } })} /></label>
                <label htmlFor={`en-${o.id}`}>End<input id={`en-${o.id}`} type="time" value={hm(s.shifts[o.id].end)} onChange={(e) => e.target.value && set('shifts', { ...s.shifts, [o.id]: { ...s.shifts[o.id], end: parseHm(e.target.value) } })} /></label>
              </fieldset>
            ))}
            <fieldset>
              <legend>Weekly off</legend>
              <div className="chips">
                {DAYS.map((d, i) => (
                  <button key={d} type="button" className={`chip${s.weeklyOff.includes(i) ? ' on' : ''}`} aria-pressed={s.weeklyOff.includes(i)}
                    onClick={() => set('weeklyOff', s.weeklyOff.includes(i) ? s.weeklyOff.filter((x) => x !== i) : [...s.weeklyOff, i].sort())}>{d}</button>
                ))}
              </div>
            </fieldset>
          </div>
        </Panel>

        <Panel title="Daily checks" note="What counts as late, early, short or a likely system issue.">
          <div className="form">
            <Num id="grace" label="Late after" unit="min past start" value={s.graceMinutes} onChange={(v) => set('graceMinutes', v)} />
            <Num id="early" label="Early departure when leaving more than" unit="min before end" value={s.earlyToleranceMinutes} onChange={(v) => set('earlyToleranceMinutes', v)} />
            <Num id="short" label="Short hours when below scheduled by more than" unit="min" value={s.shortHoursToleranceMinutes} onChange={(v) => set('shortHoursToleranceMinutes', v)} />
            <Num id="half" label="Count as half day below" unit="hours worked" value={s.halfDayBelowHours} step={0.5} onChange={(v) => set('halfDayBelowHours', v)} />
            <Num id="dup" label="Duplicate punches above" unit="punches a day" value={s.duplicatePunchLimit} onChange={(v) => set('duplicatePunchLimit', v)} />
            <Num id="sys" label="Likely system issue when the same gap hits" unit="people in one office" value={s.systemIssueMinPeople} onChange={(v) => set('systemIssueMinPeople', v)} />
          </div>
        </Panel>
      </div>

      <div className="two">
        <Panel title="HR emails and reminders">
          <div className="form">
            <Num id="conf" label="Apply an email when match confidence is at least" unit="%" value={s.autoApplyConfidence} min={50} max={100} onChange={(v) => set('autoApplyConfidence', v)} />
            <Field label="Remind employees">
              <label className="switch" htmlFor="rem-on"><input id="rem-on" type="checkbox" checked={s.remindersOn} onChange={(e) => set('remindersOn', e.target.checked)} /> {s.remindersOn ? 'On' : 'Off'}</label>
            </Field>
            <Num id="rem-days" label="Send the reminder after" unit="working days" value={s.reminderAfterDays} min={1} max={5} onChange={(v) => set('reminderAfterDays', v)} />
            <Field label="HR daily summary at (IST)"><input id="digest" type="time" value={s.hrDigestTime} onChange={(e) => e.target.value && set('hrDigestTime', e.target.value)} /></Field>
          </div>
        </Panel>
        <Panel title="Month close">
          <div className="form">
            <Num id="close" label="Close the month on day" unit="of the next month, 06:00 IST" value={s.closeDay} min={1} max={10} onChange={(v) => set('closeDay', v)} />
            <Field label="Email the monthly package to (one per line)">
              <textarea id="recips" rows={3} value={s.reportRecipients.join('\n')} onChange={(e) => set('reportRecipients', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} />
            </Field>
          </div>
        </Panel>
      </div>

      <Holidays />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><span>{label}</span>{children}</div>;
}

function Num({ id, label, unit, value, onChange, step = 1, min = 0, max }: { id: string; label: string; unit: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="num-in">
        <input id={id} type="number" value={value} step={step} min={min} max={max} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
        <span className="muted small">{unit}</span>
      </span>
    </div>
  );
}

function Holidays() {
  const { ref, reload, toast } = useApp();
  const [cal, setCal] = useState<'IN' | 'US'>('IN');
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const list = ref.holidays.filter((h) => h.calendar === cal).sort((a, b) => a.date.localeCompare(b.date));

  async function saveList(next: Holiday[], msg: string) {
    await api.saveHolidays(next);
    await reload();
    toast(msg);
  }

  return (
    <Panel
      title="Holiday calendars 2026"
      note="India applies to Indore, Mumbai and Remote. US applies to New York. Holidays are never counted as absences."
      actions={
        <div className="chips" role="group" aria-label="Calendar">
          <button className={`chip${cal === 'IN' ? ' on' : ''}`} onClick={() => setCal('IN')}>India</button>
          <button className={`chip${cal === 'US' ? ' on' : ''}`} onClick={() => setCal('US')}>United States</button>
        </div>
      }
      flush
    >
      <div className="scroll">
        <table>
          <thead><tr><th>Date</th><th>Holiday</th><th /></tr></thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.date + h.name}>
                <td className="nowrap">{fmtDay(h.date)} {h.date.slice(0, 4)}</td>
                <td>{h.name}</td>
                <td className="num"><button className="btn sm ghost" onClick={() => saveList(ref.holidays.filter((x) => x !== h), `Removed ${h.name}`)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="add-row" onSubmit={(e) => { e.preventDefault(); if (date && name.trim()) { void saveList([...ref.holidays, { date, name: name.trim(), calendar: cal }], `Added ${name.trim()}`); setDate(''); setName(''); } }}>
        <label htmlFor="hol-date" className="sr">Date</label>
        <input id="hol-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <label htmlFor="hol-name" className="sr">Holiday name</label>
        <input id="hol-name" type="text" placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn sm" type="submit">Add to {cal === 'IN' ? 'India' : 'US'} calendar</button>
      </form>
    </Panel>
  );
}
