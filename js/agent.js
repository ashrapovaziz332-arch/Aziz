// Matnli buyruqlar agenti (o'zbek / rus / ingliz). Internet yoki API talab qilmaydi.
// parse(text) -> { intent, ...params } ; bajarish main.js da.

const SPECIES = [
  ['spruce', ["qoraqarag'ay", 'qoraqaragay', 'ель', 'ели', 'ёл', 'spruce', 'yel']],
  ['pine', ["qarag'ay", 'qaragay', 'сосн', 'pine']],
  ['thuja', ['tuya', 'туй', 'туя', 'thuja']],
  ['birch', ['qayin', 'берёз', 'берез', 'birch']],
  ['maple', ['zarang', 'клён', 'клен', 'maple', 'chinor']],
  ['apple', ['olma', 'ябло', 'apple']],
  ['cherry', ['olcha', 'sakura', 'вишн', 'сакур', 'cherry']],
  ['juniper', ['archa', 'можжев', 'juniper']],
  ['spiraea', ['spirey', 'спире', 'spiraea']],
  ['barberry', ['zirk', 'barbaris', 'барбарис', 'barberry']],
  ['rose', ['atirgul', 'роз', 'rose']],
  ['lavender', ['lavand', 'лаванд', 'lavender']],
  ['rudbeckia', ['rudbek', 'рудбек']],
  ['sage', ['shalfey', 'marmarak', 'шалфе', 'sage', 'salvia']],
  ['hosta', ['xosta', 'хост', 'hosta']],
  ['sedum', ['sedum', 'очиток']],
  ['thyme', ['jambil', 'тимьян', 'thyme']],
  ['miscanthus', ['miskant', 'мискант', 'miscanthus']],
  ['fescue', ['betaga', 'овсяниц', 'fescue']],
];

const num = (s) => parseFloat(String(s).replace(',', '.'));

function findSpecies(t) {
  // uzunroq kalit so'zlar birinchi tekshiriladi (qoraqarag'ay ⊃ qarag'ay)
  const all = SPECIES.flatMap(([id, keys]) => keys.map((k) => [id, k])).sort((a, b) => b[1].length - a[1].length);
  for (const [id, k] of all) if (t.includes(k)) return id;
  return null;
}

function where(t) {
  const pos = {};
  if (/chap|слева|левой|left/.test(t)) pos.x = -16;
  if (/o'ng|ong tomon|справа|правой|right/.test(t)) pos.x = 16;
  if (/orqa|сзади|задн|back/.test(t)) pos.z = -14;
  if (/old|спереди|перед|front/.test(t)) pos.z = 12;
  if (/markaz|центр|середин|center|o'rta|поляны|polyan|maydon/.test(t)) pos.center = true;
  if (/chegara|забор|границ|периметр|border|fence/.test(t)) pos.border = true;
  return pos;
}

export function parse(text) {
  const raw = String(text || '').trim();
  const t = raw.toLowerCase().replace(/[ʻʼ’`]/g, "'");
  if (!t) return { intent: 'none' };

  const radius = (() => {
    const m = t.match(/(?:\br|радиус\w*|radius\w*)\s*[=:]?\s*(\d+(?:[.,]\d+)?)/);
    return m ? num(m[1]) : null;
  })();
  const height = (() => {
    const m = t.match(/(?:balandlig\w*|высот\w*|height|h)\s*[=:]?\s*(\d+(?:[.,]\d+)?)/) || t.match(/(\d+(?:[.,]\d+)?)\s*(?:m|м)(?![a-zа-яё])/);
    return m ? num(m[1]) : null;
  })();
  const count = (() => {
    const m = t.match(/(\d+)\s*(?:ta|шт|dona|pcs|x)?\s*(?=[a-zа-яё'])/);
    return m ? parseInt(m[1], 10) : null;
  })();

  if (/yordam|help|помощ|nima qila|что умее/.test(t)) return { intent: 'help' };
  if (/bekor|undo|отмен/.test(t)) return { intent: 'undo' };
  if (/\btun\b|kechasi|kech|ноч|night/.test(t)) return { intent: 'night', value: true };
  if (/\bkun\b|kunduz|день|днём|днем|\bday\b/.test(t)) return { intent: 'night', value: false };
  if (/normakontrol|нормоконтрол|norma|tekshir|провер|check/.test(t)) return { intent: 'norms' };
  if (/injener|инженер|sug'orish|полив|drenaj|дренаж|tarmoq|сети|коммуникац/.test(t)) return { intent: 'engineering' };
  if (/rejala|планиров|variant|layout/.test(t)) return { intent: 'autoplan' };
  if (/sayr|прогулк|walk/.test(t)) return { intent: 'walk' };
  if (/render|рендер|surat|фото/.test(t)) return { intent: 'render' };

  if (/tepalik|холм|hill|bo'rtma|насып|ko'tar|поднять/.test(t)) {
    return { intent: 'hill', h: height ?? 1, r: radius ?? 5, pos: where(t) };
  }
  if (/chuqur|котлован|яма|впадин|pit|pasayt|опуст/.test(t)) {
    return { intent: 'hill', h: -(height ?? 0.8), r: radius ?? 4, pos: where(t) };
  }
  if (/hovuz|ko'l|пруд|водо[её]м|pond|basseyn/.test(t)) {
    return { intent: 'pond', r: radius ?? 3.5, pos: where(t) };
  }
  if (/tekisla|выровн|flatten/.test(t)) {
    return { intent: 'flatten', r: radius ?? 6, pos: where(t) };
  }
  if (/o'chir|olib tashla|удали|убери|remove|delete|tozala|очист/.test(t)) {
    const sp = findSpecies(t);
    return { intent: 'removePlants', species: sp };
  }
  const sp = findSpecies(t);
  if (sp || /ek|посад|plant|o'tqaz/.test(t)) {
    if (!sp) return { intent: 'unknown', text: raw, hint: "Qaysi o'simlik? Masalan: «10 ta qarag'ay ek»" };
    return { intent: 'plant', species: sp, n: Math.min(count ?? 5, 500), pos: where(t) };
  }
  return { intent: 'unknown', text: raw };
}

export const HELP = [
  "Tepalik qo'sh: balandligi 1,2 m, R 6 m, markazda",
  "Chap tomonda hovuz R 4",
  "Chegara bo'ylab 12 ta qarag'ay ek",
  "20 ta lavanda ek",
  "Qayinlarni o'chir",
  'Normakontrol',
  'Avto-injeneriya',
  'Kechasi / kunduzi',
  'Sayr',
];
