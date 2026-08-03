// Every text DeepVerse displays that it did not write, and what licence it carries.
//
// Kept in one module because two of these licences require attribution wherever the text appears,
// and a string copied into five components drifts. If you add a source, add it here.

export const TYNDALE_DICTIONARY =
  'Tyndale Open Bible Dictionary · © 2023 Tyndale House Publishers · CC BY-SA 4.0';

export const TYNDALE_STUDY_NOTES =
  'Tyndale Open Study Notes · © 2022 Tyndale House Publishers · CC BY-SA 4.0';

// CC BY-SA 4.0 permits adaptation on condition that the changes are stated. These are ours, in
// full; build/lib/tyndale.mjs holds the per-correction evidence.
export const TYNDALE_CHANGES =
  'Adapted: article text is stored as plain text with its subheadings marked, and three of the '
  + 'source’s own scripture links are corrected — two references to Judges 1 that pointed at '
  + 'Joshua, and one to Romans 13 tagged as Ecclesiastes.';

// The deuterocanon. Public domain, so no attribution is legally required; it is shown anyway
// because a reader seeing 17th-century English beside three modern translations is owed the reason.
export const KJV_APOCRYPHA =
  'King James Version + Apocrypha (1769 text) · public domain · eBible.org';

// What each `version` column value should be called on screen.
const VERSION_LABEL = { NIV: 'NIV', NKJV: 'NKJV', NLT: 'NLT', KJVA: 'KJV Apocrypha' };
export function versionLabel(v) { return VERSION_LABEL[v] ?? v; }
