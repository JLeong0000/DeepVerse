// build/lib/theographic.mjs
// Load Theographic Bible Metadata (CC BY-SA 4.0, Robert Rouse) into chapter_context + chapter_entity.
// chapter_context: one row per Theographic chapter (writer + derived listable people/place counts).
// chapter_entity: per-chapter people/places/groups/events, derived by walking verses.json link arrays
//   and keeping the lowest verseNum each entity appears at (accumulated in JS, inserted once).
// Book codes come straight from osisRef ("Gen.1" / "Gen.4.21") and match verses.book (OSIS).
import fs from 'node:fs';

const stripHtml = s => (s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const readJson = (dir, name) => JSON.parse(fs.readFileSync(`${dir}/${name}.json`, 'utf8'));
const idMap = records => new Map(records.map(r => [r.id, r.fields]));

// dictText is an array of strings -> join, strip markup, truncate.
function blurbOf(fields) {
  const dt = fields.dictText;
  if (!dt) return null;
  const text = stripHtml(Array.isArray(dt) ? dt.join(' ') : dt);
  if (!text) return null;
  return text.length > 300 ? text.slice(0, 300) : text;
}
function numOrNull(s) {
  if (s === undefined || s === null || String(s).trim() === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function loadTheographic(db, dir) {
  const chapters = readJson(dir, 'chapters');
  const verses = readJson(dir, 'verses');
  const people = idMap(readJson(dir, 'people'));
  const places = idMap(readJson(dir, 'places'));
  const groups = idMap(readJson(dir, 'peopleGroups'));
  const events = idMap(readJson(dir, 'events'));

  // --- chapter_entity: accumulate per (book|chapter|type|entity_id), keep min verseNum ---
  const LINKS = [
    ['people', 'person', people],
    ['places', 'place', places],
    ['peopleGroups', 'group', groups],
    ['event', 'event', events],
  ];
  const acc = new Map();
  const stats = { unresolved: 0 };
  for (const v of verses) {
    const f = v.fields;
    const parts = f.osisRef.split('.');           // Book.Chapter.Verse
    const book = parts[0], chapter = +parts[1], verseNum = +parts[2];
    for (const [field, type, map] of LINKS) {
      const arr = f[field];
      if (!arr) continue;
      for (const id of arr) {
        const ent = map.get(id);
        if (!ent) { stats.unresolved++; continue; }
        const entityId = ent.slug || id;
        const key = `${book}|${chapter}|${type}|${entityId}`;
        const existing = acc.get(key);
        if (existing) { if (verseNum < existing.sort_verse) existing.sort_verse = verseNum; continue; }
        let name, lat = null, lon = null, featureType = null, blurb = null, year = null;
        if (type === 'person') { name = ent.name; blurb = blurbOf(ent); }
        else if (type === 'place') {
          name = ent.displayTitle || ent.kjvName;
          lat = numOrNull(ent.latitude); lon = numOrNull(ent.longitude);
          featureType = ent.featureType || null; blurb = blurbOf(ent);
        }
        else if (type === 'group') name = ent.groupName;
        else { name = ent.title; year = ent.startDate != null ? parseInt(ent.startDate, 10) : null; if (!Number.isFinite(year)) year = null; }
        acc.set(key, { book, chapter, type, entityId, name, lat, lon, featureType, blurb, year, sort_verse: verseNum });
      }
    }
  }

  // Derived per-chapter counts of the entities we can actually list. Theographic's own
  // peopleCount/placesCount are inflated Airtable rollups (Gen 1 -> 26 people for the
  // creation narrative), so we store the listable counts instead — the number always
  // matches the displayed list.
  const counts = new Map();   // book|chapter -> {person, place}
  for (const e of acc.values()) {
    const k = `${e.book}|${e.chapter}`;
    const c = counts.get(k) || { person: 0, place: 0 };
    if (e.type === 'person') c.person++;
    else if (e.type === 'place') c.place++;
    counts.set(k, c);
  }

  // --- chapter_context ---
  const insC = db.prepare('INSERT OR IGNORE INTO chapter_context VALUES (?,?,?,?,?,?)');
  db.exec('BEGIN');
  for (const rec of chapters) {
    const f = rec.fields;
    const [book, chapter] = f.osisRef.split('.');
    const writerId = Array.isArray(f.writer) ? f.writer[0] : undefined;
    const writer = writerId && people.has(writerId) ? (people.get(writerId).name || null) : null;
    const c = counts.get(`${book}|${+chapter}`) || { person: 0, place: 0 };
    insC.run(book, +chapter, f.osisRef, writer, c.person, c.place);
  }
  db.exec('COMMIT');

  const insE = db.prepare('INSERT OR IGNORE INTO chapter_entity VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  for (const e of acc.values())
    insE.run(e.book, e.chapter, e.type, e.entityId, e.name, e.lat, e.lon, e.featureType, e.blurb, e.year, e.sort_verse);
  db.exec('COMMIT');

  if (stats.unresolved) console.log('theographic: skipped', stats.unresolved, 'verse links with no matching entity record');
  return {
    context: db.prepare('SELECT COUNT(*) n FROM chapter_context').get().n,
    entity: db.prepare('SELECT COUNT(*) n FROM chapter_entity').get().n,
  };
}
