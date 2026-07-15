// build/fetch-biblesummary.mjs
// Refresh Bible Summary (Chris Juby, biblesummary.info) — one plain summary per chapter —
// into the committed local file build/data/recaps-biblesummary.json. This is a one-time /
// occasional refresh tool; the normal build reads the committed file and does NOT hit the
// network. The app attributes biblesummary.info.  Run: node fetch-biblesummary.mjs
import fs from 'node:fs';

const OUT_DIR = './data';
fs.mkdirSync(OUT_DIR, { recursive: true });

// biblesummary.info slug -> OSIS book code (matches verses.book)
const SLUG = {
  genesis:'Gen', exodus:'Exod', leviticus:'Lev', numbers:'Num', deuteronomy:'Deut',
  joshua:'Josh', judges:'Judg', ruth:'Ruth', '1-samuel':'1Sam', '2-samuel':'2Sam',
  '1-kings':'1Kgs', '2-kings':'2Kgs', '1-chronicles':'1Chr', '2-chronicles':'2Chr',
  ezra:'Ezra', nehemiah:'Neh', esther:'Esth', job:'Job', psalms:'Ps', proverbs:'Prov',
  ecclesiastes:'Eccl', 'song-of-songs':'Song', isaiah:'Isa', jeremiah:'Jer', lamentations:'Lam',
  ezekiel:'Ezek', daniel:'Dan', hosea:'Hos', joel:'Joel', amos:'Amos', obadiah:'Obad',
  jonah:'Jonah', micah:'Mic', nahum:'Nah', habakkuk:'Hab', zephaniah:'Zeph', haggai:'Hag',
  zechariah:'Zech', malachi:'Mal', matthew:'Matt', mark:'Mark', luke:'Luke', john:'John',
  acts:'Acts', romans:'Rom', '1-corinthians':'1Cor', '2-corinthians':'2Cor', galatians:'Gal',
  ephesians:'Eph', philippians:'Phil', colossians:'Col', '1-thessalonians':'1Thess',
  '2-thessalonians':'2Thess', '1-timothy':'1Tim', '2-timothy':'2Tim', titus:'Titus',
  philemon:'Phlm', hebrews:'Heb', james:'Jas', '1-peter':'1Pet', '2-peter':'2Pet',
  '1-john':'1John', '2-john':'2John', '3-john':'3John', jude:'Jude', revelation:'Rev',
};

const decode = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, '’')
  .replace(/&#8216;/g, '‘').replace(/&#8220;/g, '“').replace(/&#8221;/g, '”')
  .replace(/&#8212;/g, '—').replace(/&#8230;/g, '…')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const RE = /<p class="summary_content "><span class="chapter_number">(\d+)<\/span>(.*?)<\/p>/gs;

const out = [];
for (const [slug, book] of Object.entries(SLUG)) {
  const html = await (await fetch(`https://biblesummary.info/${slug}`)).text();
  let m, n = 0;
  RE.lastIndex = 0;
  while ((m = RE.exec(html))) { out.push({ book, chapter: +m[1], summary: decode(m[2]) }); n++; }
  if (!n) console.warn('WARN: no summaries parsed for', slug);
}

out.sort((a, b) => a.book.localeCompare(b.book) || a.chapter - b.chapter);
fs.writeFileSync(`${OUT_DIR}/recaps-biblesummary.json`, JSON.stringify(out, null, 1));
console.log('bible summary chapters:', out.length);
