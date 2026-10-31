// Floran 3D — umumiy sozlamalar va kataloglar

export const SITE = { W: 60, D: 40, CELL: 0.5 };
export const NX = SITE.W / SITE.CELL; // kataklar soni (x)
export const NZ = SITE.D / SITE.CELL; // kataklar soni (z)
export const VX = NX + 1;
export const VZ = NZ + 1;
export const HALF_W = SITE.W / 2;
export const HALF_D = SITE.D / 2;

// Qoplama turlari (har bir to'r tugunida saqlanadi)
export const C = { GRASS: 0, GRAVEL: 1, PAVING: 2, BED: 3, WATER: 4, SAND: 5, MEADOW: 6 };
export const COVERS = [
  { id: C.GRASS, key: 'grass', name: 'Maysa', color: '#6f9f47' },
  { id: C.GRAVEL, key: 'gravel', name: "Shag'al yo'lak", color: '#cbbb98' },
  { id: C.PAVING, key: 'paving', name: 'Tosh plitka', color: '#a8a29a' },
  { id: C.BED, key: 'bed', name: 'Gulzor (mulcha)', color: '#5e4634' },
  { id: C.WATER, key: 'water', name: 'Suv havzasi', color: '#2f6f93' },
  { id: C.SAND, key: 'sand', name: 'Qum', color: '#ddcb98' },
  { id: C.MEADOW, key: 'meadow', name: "O'tloq", color: '#8ea653' },
];
// O'simlik ekib bo'lmaydigan qattiq qoplamalar
export const HARD = new Set([C.GRAVEL, C.PAVING, C.WATER]);

// O'simlik guruhlari
export const GROUPS = {
  tree: "Daraxtlar",
  shrub: 'Butalar',
  perennial: "Ko'p yilliklar",
  ground: 'Yer qoplovchilar',
  grass: "Bezak o'tlar",
  veg: 'Sabzavotlar',
};

// O'simliklar katalogi. h — balandlik (m), r — toj radiusi (m)
export const PLANTS = {
  spruce:    { name: "Qoraqarag'ay", ru: 'Ель обыкновенная', latin: 'Picea abies', cat: 'conifer', group: 'tree', h: 11, r: 2.3, color: '#2c5537' },
  pine:      { name: "Qarag'ay", ru: 'Сосна обыкновенная', latin: 'Pinus sylvestris', cat: 'pine', group: 'tree', h: 13, r: 2.6, color: '#3d6a3b', trunk: '#8a5a3a' },
  thuja:     { name: "G'arbiy tuya", ru: 'Туя западная', latin: 'Thuja occidentalis', cat: 'column', group: 'tree', h: 5, r: 0.8, color: '#3c6b39' },
  birch:     { name: 'Qayin', ru: 'Берёза повислая', latin: 'Betula pendula', cat: 'deciduous', group: 'tree', h: 12, r: 3, color: '#86b556', trunk: '#e9e5dc' },
  maple:     { name: 'Zarang', ru: 'Клён остролистный', latin: 'Acer platanoides', cat: 'deciduous', group: 'tree', h: 10, r: 3.4, color: '#5c963c' },
  apple:     { name: 'Olma', ru: 'Яблоня домашняя', latin: 'Malus domestica', cat: 'deciduous', group: 'tree', h: 5, r: 2.3, color: '#6a9c43' },
  cherry:    { name: 'Sakura (olcha)', ru: 'Вишня мелкопильчатая', latin: 'Prunus serrulata', cat: 'deciduous', group: 'tree', h: 4.5, r: 2, color: '#e6b3c4' },
  juniper:   { name: 'Archa', ru: 'Можжевельник', latin: 'Juniperus communis', cat: 'conifer', group: 'shrub', h: 2.2, r: 0.6, color: '#47745a' },
  spiraea:   { name: 'Spireya', ru: 'Спирея', latin: 'Spiraea vanhouttei', cat: 'shrub', group: 'shrub', h: 1.4, r: 0.8, color: '#d6e2bf' },
  barberry:  { name: 'Zirk (barbaris)', ru: 'Барбарис Тунберга', latin: 'Berberis thunbergii', cat: 'shrub', group: 'shrub', h: 1, r: 0.55, color: '#8b2f3c' },
  rose:      { name: 'Atirgul', ru: 'Роза', latin: 'Rosa', cat: 'shrub', group: 'shrub', h: 1, r: 0.45, color: '#d0607f' },
  lavender:  { name: 'Lavanda', ru: 'Лаванда', latin: 'Lavandula angustifolia', cat: 'perennial', group: 'perennial', h: 0.5, r: 0.25, color: '#8c79c4' },
  rudbeckia: { name: 'Rudbekiya', ru: 'Рудбекия', latin: 'Rudbeckia fulgida', cat: 'perennial', group: 'perennial', h: 0.7, r: 0.25, color: '#e5b235' },
  sage:      { name: 'Marmarak (shalfey)', ru: 'Шалфей', latin: 'Salvia nemorosa', cat: 'perennial', group: 'perennial', h: 0.5, r: 0.2, color: '#5a5db3' },
  hosta:     { name: 'Xosta', ru: 'Хоста', latin: 'Hosta', cat: 'perennial', group: 'perennial', h: 0.45, r: 0.3, color: '#5d8e4c' },
  sedum:     { name: 'Sedum', ru: 'Очиток', latin: 'Sedum spurium', cat: 'ground', group: 'ground', h: 0.12, r: 0.2, color: '#86a85a' },
  thyme:     { name: 'Tog\' jambil', ru: 'Тимьян ползучий', latin: 'Thymus serpyllum', cat: 'ground', group: 'ground', h: 0.1, r: 0.2, color: '#a98bbd' },
  miscanthus:{ name: 'Miskantus', ru: 'Мискантус', latin: 'Miscanthus sinensis', cat: 'grass', group: 'grass', h: 1.6, r: 0.45, color: '#c9c27c' },
  fescue:    { name: 'Ko\'k betaga', ru: 'Овсяница сизая', latin: 'Festuca glauca', cat: 'grass', group: 'grass', h: 0.3, r: 0.15, color: '#8db4b1' },
  veg:       { name: 'Sabzavot (ko\'chat)', ru: 'Овощи', latin: '—', cat: 'veg', group: 'veg', h: 0.35, r: 0.2, color: '#4f8f3a' },
};

// Kichik me'moriy shakllar va inshootlar. w × d — taglik o'lchami (m)
export const OBJECTS = {
  house:      { name: 'Uy', w: 12, d: 10, h: 7 },
  gazebo:     { name: 'Shiypon (besedka)', w: 4, d: 4, h: 3.2 },
  pergola:    { name: 'Pergola', w: 3, d: 4, h: 2.6 },
  bench:      { name: "O'rindiq", w: 1.8, d: 0.6, h: 0.9 },
  shed:       { name: "Xo'jalik binosi", w: 3, d: 2.5, h: 2.6 },
  greenhouse: { name: 'Issiqxona', w: 3, d: 6, h: 2.4 },
  firepit:    { name: "O'choq", w: 1.4, d: 1.4, h: 0.4 },
  lamp:       { name: 'Bog\' chirog\'i', w: 0.3, d: 0.3, h: 0.9 },
  sprinkler:  { name: 'Purkagich', w: 0.2, d: 0.2, h: 0.15 },
};

// Narxlar (so'm) — avto-injeneriya smetasi uchun taxminiy
export const PRICES = {
  irrPipe: 45000,    // sug'orish quvuri, 1 m
  sprinkler: 350000, // purkagich
  drip: 25000,       // tomchilatib sug'orish chizig'i, 1 m
  lamp: 1200000,     // chiroq
  cable: 30000,      // kabel, 1 m
  drainPipe: 120000, // drenaj quvuri, 1 m
  well: 900000,      // quduq
};

export const fmt = (n, d = 0) =>
  Number(n).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
