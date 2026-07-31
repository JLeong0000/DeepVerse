// Tyndale files entries under an inverted headword — "Revelation, Book of", "Baca*, Valley of",
// "Prophets, False" — which is right for an A–Z index and wrong everywhere the title is used as a
// name. This reads them back as names. 365 of the 6,010 titles are affected.
//
// The danger is that an inversion and an ALTERNATE SPELLING look identical: "Prophets, False" is
// an inversion, "Elect, Election" is not, and nothing in the data separates them. So nothing here
// is a general "swap around the comma" rule. Four narrow rules, each either structural and
// unambiguous, or an explicit list.

// Rule A — the tail ends in a preposition, so it cannot be an alternate spelling.
// "Valley of", "Book of the", "Letter to the", "Life and Teachings of".
const PREP_TAIL = /\b(?:of|to|for|in|with|from|concerning|against)(?:\s+the)?$/i;

// Rules B1–B3 are likewise structural: no article is ever an alternate spelling of "the", of a
// phrase starting "the ", or of "Mount".

// Rule C — inversions with no structural marker at all. Every one is listed explicitly. The list
// was built by taking every comma-title whose two halves share no word stem (alternate spellings
// nearly always do — "Accho/Acco", "Banker/Banking") and reviewing the 77 survivors by hand.
// Nine were rejected as NOT inversions and are deliberately absent:
//   Philo*, Judaeus            — already natural order ("Philo Judaeus")
//   Iye-Abarim, Iyim* · Vaizatha, Vajezatha* · Zecher*, Zeker*   — alternate names
//   Eli, Eli, Lama Sabachthani?* · Eloi, Eloi, Lama Sabachthani? · Mene, Mene, Tekel, Parsin
//   Shadrach, Meshach, and Abednego                              — quoted phrases and lists
//   Bible*, Quotations of the Old Testament in the New Testament — flips into nonsense
const NAMED = new Set([
  'Akiba*, Rabbi', 'Alexandrinus*, Codex', 'Ark*, Noah’s', 'Ben Sirach*, Jesus',
  'Birth*, New', 'Calendars, Ancient and Modern', 'Calf, Golden', 'Children*, Song of the Three',
  'Chronicles, Books of First and Second', 'Communion*, Holy', 'Convocation*, Holy',
  'Creation, New', 'Creature, New', 'Earth, New', 'Ephraemi Syri*, Codex', 'Epistles*, Apocryphal',
  'Father, God As', 'Father, Human', 'Felix, Antonius', 'Festus, Porcius', 'Ghost*, Holy',
  'Gifts, Spiritual', 'Gospels*, Apocryphal', 'Heavens, New', 'Highway*, King’s',
  'Instruments, Musical', 'Jerusalem, New', 'Jewish Literature*, Extrabiblical',
  'Josephus*, Flavius', 'Kings, Books of First and Second', 'Letter Writing*, Ancient',
  'Maccabaeus, Judas', 'Maccabees, 1 and 2', 'Maccabees*, 3 and 4', 'Maccabeus, Judas',
  'Magdalene, Mary', 'Magus*, Simon', 'Man*, Natural', 'Man, Old and New', 'Manius, Titus',
  'Mark, John', 'Marriage*, Levirate', 'Moon, New', 'Oak, Diviners’', 'Oil, Anointing',
  'Paulus, Sergius', 'Pilate, Pontius', 'Poetry, Biblical', 'Portico*, Solomon’s',
  'Possession, Demon', 'Prayer*, Lord’s', 'Priest, High', 'Prophets, False', 'Punishment, Eternal',
  'Samuel, Books of First and Second', 'Scrolls*, Dead Sea', 'Sea, Dead', 'Sea*, Molten',
  'Sea, Red', 'Seat*, Moses’', 'Serpent, Bronze', 'Spirits, Unclean', 'Stones, Precious',
  'Supper, Lord’s', 'Tacitus*, Cornelius', 'Tradition*, Oral', 'War*, Holy', 'Zealot, Simon the',
]);

export function displayTitle(title) {
  const t = String(title ?? '');
  const i = t.lastIndexOf(', ');
  if (i < 0) return t;
  const head = t.slice(0, i), tail = t.slice(i + 2);
  if (NAMED.has(t)) return `${tail} ${head}`;                    // C
  if (/^the$/i.test(tail)) return `the ${head}`;                 // B1 — "Devil, the"
  if (/^the\s/i.test(tail)) return `${tail} ${head}`;            // B2 — "Commandments, the Ten"
  if (/^(?:Mount|Mt\.?)$/i.test(tail)) return `${tail} ${head}`; // B3 — "Hermon, Mount"
  if (PREP_TAIL.test(tail)) return `${tail} ${head}`;            // A  — "Baca*, Valley of"
  return t;
}
