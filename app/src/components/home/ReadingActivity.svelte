<script>
  import { activityMap, activityLevel, streak, daysThisYear, chaptersRead } from '../../lib/store.js';

  const WEEKS = 26;
  const map = activityMap();
  const iso = (d) => d.toISOString().slice(0, 10);

  const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  // Build WEEKS columns × 7 days ending today (last column = current week). Each cell carries its
  // level + a hover label (chapters read that day).
  function buildColumns() {
    const today = new Date();
    const end = new Date(today); end.setDate(end.getDate() + (6 - end.getDay())); // Saturday of this week
    const cols = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(end);
        day.setDate(end.getDate() - (w * 7) + (d - 6));
        if (day > today) { col.push({ lv: -1, title: '' }); continue; }
        const n = map[iso(day)] || 0;
        col.push({ lv: activityLevel(n), title: `${n === 0 ? 'No chapters' : n === 1 ? '1 chapter' : `${n} chapters`} · ${fmtDay(day)}` });
      }
      cols.push(col);
    }
    return cols;
  }
  const columns = buildColumns();
  const stats = [
    { num: streak(), cap: 'day streak' },
    { num: daysThisYear(), cap: 'this year' },
    { num: chaptersRead(), cap: 'chapters' },
  ];
</script>

<div class="lbl">Reading activity</div>
<div class="streaks">
  {#each stats as s}
    <div><div class="num">{s.num}</div><div class="cap">{s.cap}</div></div>
  {/each}
</div>
<div class="graphwrap">
  <div class="grid">
    {#each columns as col}
      <div class="col">
        {#each col as cell}
          <div class="cell" class:l1={cell.lv === 1} class:l2={cell.lv === 2} class:l3={cell.lv === 3} class:l4={cell.lv === 4} class:blank={cell.lv === -1}
            title={cell.title}></div>
        {/each}
      </div>
    {/each}
  </div>
</div>
<div class="legend">less <span class="cell"></span><span class="cell l1"></span><span class="cell l2"></span><span class="cell l3"></span><span class="cell l4"></span> more</div>

<style>
  .streaks { display: flex; gap: 26px; margin: 8px 0 12px; }
  .streaks .num { font-size: 23px; }
  .streaks .cap { font-size: 10.5px; color: var(--dim); font-variant: small-caps; letter-spacing: .04em; }
  .graphwrap { overflow-x: auto; }
  .grid { display: flex; gap: 3px; }
  .col { display: flex; flex-direction: column; gap: 3px; }
  .cell { width: 11px; height: 11px; border-radius: 2px; background: var(--lv0); }
  .cell.l1 { background: var(--lv1); } .cell.l2 { background: var(--lv2); }
  .cell.l3 { background: var(--lv3); } .cell.l4 { background: var(--lv4); }
  .cell.blank { background: transparent; }
  .legend { display: flex; align-items: center; gap: 4px; justify-content: flex-end; font-size: 10px; color: var(--dim); margin-top: 8px; }
  .legend .cell { width: 9px; height: 9px; }
</style>
