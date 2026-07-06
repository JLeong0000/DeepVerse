// build/lib/refs.mjs
export const STEP2OSIS = {
  Gen:'Gen',Exo:'Exod',Lev:'Lev',Num:'Num',Deu:'Deut',Jos:'Josh',Jdg:'Judg',Rut:'Ruth',
  '1Sa':'1Sam','2Sa':'2Sam','1Ki':'1Kgs','2Ki':'2Kgs','1Ch':'1Chr','2Ch':'2Chr',Ezr:'Ezra',Neh:'Neh',
  Est:'Esth',Job:'Job',Psa:'Ps',Pro:'Prov',Ecc:'Eccl',Sng:'Song',Isa:'Isa',Jer:'Jer',Lam:'Lam',
  Ezk:'Ezek',Dan:'Dan',Hos:'Hos',Jol:'Joel',Amo:'Amos',Oba:'Obad',Jon:'Jonah',Mic:'Mic',Nam:'Nah',
  Hab:'Hab',Zep:'Zeph',Hag:'Hag',Zec:'Zech',Mal:'Mal',Mat:'Matt',Mrk:'Mark',Luk:'Luke',Jhn:'John',
  Act:'Acts',Rom:'Rom','1Co':'1Cor','2Co':'2Cor',Gal:'Gal',Eph:'Eph',Php:'Phil',Col:'Col',
  '1Th':'1Thess','2Th':'2Thess','1Ti':'1Tim','2Ti':'2Tim',Tit:'Titus',Phm:'Phlm',Heb:'Heb',Jas:'Jas',
  '1Pe':'1Pet','2Pe':'2Pet','1Jn':'1John','2Jn':'2John','3Jn':'3John',Jud:'Jude',Rev:'Rev',
};
// Tolerates optional dual-versification notation like Dan.4.1(3.31) before the #position.
const RE = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)/;
export function parseWordRef(col0) {
  const m = String(col0).match(RE);
  if (!m) return null;
  const book = STEP2OSIS[m[1]];
  if (!book) return null;
  return { book, chapter: Number(m[2]), verse: Number(m[3]), position: Number(m[4]) };
}
