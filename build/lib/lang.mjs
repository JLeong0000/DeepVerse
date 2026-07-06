// build/lib/lang.mjs
export function deriveLang(morph, defaultLang) {
  if (defaultLang === 'grc') return 'grc';
  const m = String(morph || '').replace(/^H/, ''); // TAHOT prefixes an 'H' language marker
  return m.startsWith('A') ? 'arc' : 'hbo';
}
