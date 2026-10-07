import { TrademarkRecord, MatchedTrademark, SimilarityDetail, JenisKemiripan } from './types.ts';

// Kamus ejaan gaul, substitusi angka, dan homofon umum
const SLANG_AND_NUMBER_MAP: Record<string, string[]> = {
  '4': ['for', 'four', 'fo'],
  '4ever': ['forever'],
  'forever': ['4ever', '4-ever', '4 ever'],
  '2': ['to', 'two', 'too'],
  '2day': ['today'],
  'today': ['2day'],
  '8': ['ate', 'eight'],
  'gr8': ['great'],
  'great': ['gr8'],
  '1': ['one', 'won'],
  'ez': ['easy'],
  'easy': ['ez'],
  'kool': ['cool'],
  'cool': ['kool', 'kul'],
  'kleen': ['clean'],
  'clean': ['kleen', 'klin'],
  'nite': ['night'],
  'night': ['nite', 'nait'],
  'lite': ['light'],
  'light': ['lite', 'lait'],
  'xpress': ['express'],
  'express': ['xpress', 'ekspres', 'ekpress'],
  'xtreme': ['extreme'],
  'extreme': ['xtreme', 'ekstrim', 'ekstrem'],
  'aqua': ['akua', 'akwa', 'aquafresh', 'akuafresh'],
  'akua': ['aqua'],
  'nike': ['naik', 'nyke', 'naiki'],
  'naik': ['nike'],
  'fresh': ['fres', 'fresy'],
  'smart': ['smrt', 'semart'],
  'pro': ['profesional', 'professional'],
  'super': ['supr'],
};

// Kamus padanan konseptual / terjemahan bahasa Inggris <-> Indonesia
const CONCEPTUAL_MAP: Record<string, string[]> = {
  'forever': ['abadi', 'selamanya', 'kekal'],
  'abadi': ['forever', 'eternal'],
  'queen': ['ratu', 'permaisuri'],
  'ratu': ['queen'],
  'king': ['raja', 'sultan'],
  'raja': ['king', 'royal'],
  'royal': ['kerajaan', 'raja', 'bangsawan'],
  'kerajaan': ['royal', 'kingdom'],
  'gold': ['emas', 'kencana'],
  'golden': ['emas', 'kencana', 'keemasan'],
  'emas': ['gold', 'golden'],
  'kencana': ['gold', 'golden', 'emas'],
  'star': ['bintang'],
  'starlight': ['cahaya bintang', 'sinar bintang'],
  'bintang': ['star', 'starlight'],
  'sun': ['matahari', 'surya'],
  'sunlight': ['cahaya matahari', 'sinar surya', 'matahari'],
  'matahari': ['sun', 'sunlight', 'surya'],
  'surya': ['sun', 'sunlight', 'matahari'],
  'fire': ['api', 'bara'],
  'api': ['fire'],
  'ship': ['kapal', 'perahu'],
  'kapal': ['ship', 'boat'],
  'eagle': ['elang', 'garuda'],
  'garuda': ['eagle'],
  'elang': ['eagle'],
  'apple': ['apel'],
  'apel': ['apple'],
  'water': ['air', 'tirta', 'aqua'],
  'air': ['water', 'aqua'],
  'aqua': ['air', 'tirta', 'water'],
  'tirta': ['air', 'aqua', 'water'],
  'clean': ['bersih'],
  'bersih': ['clean'],
  'night': ['malam'],
  'malam': ['night'],
  'day': ['siang', 'hari'],
  'siang': ['day'],
  'cool': ['dingin', 'sejuk'],
  'dingin': ['cool', 'cold'],
  'sejuk': ['cool', 'fresh'],
  'fresh': ['segar'],
  'segar': ['fresh'],
  'angin': ['wind'],
  'wind': ['angin'],
  'great': ['agung', 'hebat', 'besar'],
};

/**
 * Normalisasi teks untuk pemrosesan nama merek
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalisasi fonetik bunyi (mengubah ejaan ke kode representasi fonetik bunyi)
 * Menangani kaidah fonetik bahasa Indonesia & Inggris, dialek ejaan lama/baru, dan substitusi angka/gaul.
 */
export function phoneticNormalize(input: string): string {
  let s = input.toLowerCase();

  // Penggantian angka dan ejaan gaul
  s = s.replace(/\b4ever\b/g, 'forever');
  s = s.replace(/\b4\b/g, 'for');
  s = s.replace(/4([a-z]+)/g, 'for$1');
  s = s.replace(/([a-z]+)4/g, '$1for');
  s = s.replace(/\b2day\b/g, 'today');
  s = s.replace(/\b2\b/g, 'to');
  s = s.replace(/\bgr8\b/g, 'great');
  s = s.replace(/\b8\b/g, 'ate');
  s = s.replace(/\bez\b/g, 'easy');
  s = s.replace(/\b1\b/g, 'one');
  s = s.replace(/\bnite\b/g, 'night');
  s = s.replace(/\blite\b/g, 'light');
  s = s.replace(/\bkool\b/g, 'cool');
  s = s.replace(/\bkleen\b/g, 'clean');
  s = s.replace(/\bxpress\b/g, 'express');
  s = s.replace(/\bxtreme\b/g, 'extreme');

  // Fonetik ejaan Indonesia & Inggris
  s = s.replace(/oe/g, 'u');     // ejaan lama Soeharto -> Suharto
  s = s.replace(/dj/g, 'j');     // Djakarta -> Jakarta
  s = s.replace(/tj/g, 'c');     // Tjipto -> Cipto
  s = s.replace(/ch/g, 'k');     // Christine -> Kristine
  s = s.replace(/ph/g, 'f');     // Philip -> Filip
  s = s.replace(/v/g, 'f');      // Victor -> Fiktor
  s = s.replace(/x/g, 'ks');     // Express -> Ekspres
  s = s.replace(/q/g, 'k');      // Quick -> Kuik
  s = s.replace(/c(?=[eiy])/g, 's'); // City -> Sity
  s = s.replace(/c/g, 'k');      // Cool -> Kool
  s = s.replace(/sh/g, 'sy');    // Shoes -> Syus
  s = s.replace(/th/g, 't');     // The -> Te
  s = s.replace(/gh/g, 'g');     // Ghost -> Gost
  s = s.replace(/ight/g, 'ait');  // Night -> Nait, Light -> Lait
  s = s.replace(/ee/g, 'i');     // Bee -> Bi
  s = s.replace(/ea/g, 'i');     // Tea -> Ti
  s = s.replace(/oo/g, 'u');     // Moon -> Mun
  s = s.replace(/y(?=[aeiou])/g, 'y');
  s = s.replace(/y\b/g, 'i');    // Easy -> Easi
  s = s.replace(/y/g, 'i');
  s = s.replace(/w/g, 'u');      // Water -> Uater
  s = s.replace(/qu/g, 'ku');    // Aqua -> Akua

  // Reduksi konsonan ganda menjadi tunggal
  s = s.replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1');

  // Bersihkan karakter non huruf
  return s.replace(/[^a-z0-9]/g, '');
}

/**
 * Menghitung jarak Levenshtein
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Menghitung rasio kemiripan visual (0.0 - 1.0)
 */
function visualSimilarityRatio(s1: string, s2: string): number {
  const norm1 = normalizeText(s1).replace(/\s+/g, '');
  const norm2 = normalizeText(s2).replace(/\s+/g, '');

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // Cek substring inklusi
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    if (minLen >= 3 && minLen / maxLen >= 0.5) {
      return 0.85;
    }
  }

  const dist = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Uji Kemiripan Fonetik Bunyi Pengucapan
 */
function testPhoneticSimilarity(merekA: string, merekB: string): { isSimilar: boolean; ratio: number; keterangan: string } {
  const rawA = normalizeText(merekA);
  const rawB = normalizeText(merekB);

  // 1. Cek langsung peta substitusi angka/gaul
  for (const [key, aliases] of Object.entries(SLANG_AND_NUMBER_MAP)) {
    const hasKeyInA = rawA.includes(key);
    const hasAliasInB = aliases.some(a => rawB.includes(a));
    if (hasKeyInA && hasAliasInB) {
      return {
        isSimilar: true,
        ratio: 0.95,
        keterangan: `Terdeteksi ekuivalensi ejaan gaul / substitusi angka ("${key}" berbunyi sama dengan "${aliases.join('/')}"). Pengucapan fonetik bunyi identik.`
      };
    }

    const hasKeyInB = rawB.includes(key);
    const hasAliasInA = aliases.some(a => rawA.includes(a));
    if (hasKeyInB && hasAliasInA) {
      return {
        isSimilar: true,
        ratio: 0.95,
        keterangan: `Terdeteksi ekuivalensi ejaan gaul / substitusi angka ("${key}" berbunyi sama dengan "${aliases.join('/')}"). Pengucapan fonetik bunyi identik.`
      };
    }
  }

  // 2. Normalisasi fonetik lanjutan
  const phA = phoneticNormalize(rawA);
  const phB = phoneticNormalize(rawB);

  if (phA === phB) {
    return {
      isSimilar: true,
      ratio: 1.0,
      keterangan: `Persamaan pengucapan bunyi mutlak (fonetik kode identik: "${phA}"). Pendengaran konsumen awam tidak dapat membedakan rima suara.`
    };
  }

  // Cek substring fonetik
  if (phA.length >= 3 && phB.length >= 3) {
    if (phA.includes(phB) || phB.includes(phA)) {
      return {
        isSimilar: true,
        ratio: 0.88,
        keterangan: `Persamaan ritme dan pengucapan fonetik pokok (unsur bunyi inti "${phA.length < phB.length ? phA : phB}" terdapat pada kedua merek).`
      };
    }
  }

  const dist = levenshteinDistance(phA, phB);
  const maxLen = Math.max(phA.length, phB.length);
  const ratio = Math.max(0, 1 - dist / maxLen);

  if (ratio >= 0.72) {
    return {
      isSimilar: true,
      ratio,
      keterangan: `Kemiripan bunyi pengucapan tinggi (${Math.round(ratio * 100)}% kesamaan artikulasi fonetis). Berpotensi menimbulkan asosiasi keliru saat dilafalkan.`
    };
  }

  return { isSimilar: false, ratio, keterangan: '' };
}

/**
 * Uji Kemiripan Konseptual / Semantik (Arti atau Gagasan Ide)
 */
function testConceptualSimilarity(merekA: string, merekB: string): { isSimilar: boolean; ratio: number; keterangan: string } {
  const wordsA = normalizeText(merekA).split(' ').filter(Boolean);
  const wordsB = normalizeText(merekB).split(' ').filter(Boolean);

  for (const wA of wordsA) {
    const concepts = CONCEPTUAL_MAP[wA] || [];
    for (const wB of wordsB) {
      if (concepts.includes(wB)) {
        return {
          isSimilar: true,
          ratio: 0.90,
          keterangan: `Persamaan makna gagasan konseptual (terjemahan sinonim langsung antara kata "${wA}" dengan "${wB}"). Menimbulkan kesan konsep ide yang identik dalam persepsi konsumen.`
        };
      }
    }
  }

  // Cek kombinasi frase dua kata (misal FIRE SHIP vs KAPAL API)
  const fullA = normalizeText(merekA);
  const fullB = normalizeText(merekB);

  if ((fullA.includes('kapal') && fullA.includes('api')) && (fullB.includes('fire') && fullB.includes('ship'))) {
    return {
      isSimilar: true,
      ratio: 0.95,
      keterangan: 'Persamaan konseptual mutlak: frasa "KAPAL API" merupakan terjemahan harfiah langsung dari "FIRE SHIP".'
    };
  }
  if ((fullB.includes('kapal') && fullB.includes('api')) && (fullA.includes('fire') && fullA.includes('ship'))) {
    return {
      isSimilar: true,
      ratio: 0.95,
      keterangan: 'Persamaan konseptual mutlak: frasa "KAPAL API" merupakan terjemahan harfiah langsung dari "FIRE SHIP".'
    };
  }
  if ((fullA.includes('ratu') && fullA.includes('kencana')) && (fullB.includes('queen') && fullB.includes('gold'))) {
    return {
      isSimilar: true,
      ratio: 0.92,
      keterangan: 'Persamaan konseptual: frasa "RATU KENCANA" berpadanan arti langsung dengan "GOLDEN QUEEN".'
    };
  }
  if ((fullB.includes('ratu') && fullB.includes('kencana')) && (fullA.includes('queen') && fullA.includes('gold'))) {
    return {
      isSimilar: true,
      ratio: 0.92,
      keterangan: 'Persamaan konseptual: frasa "RATU KENCANA" berpadanan arti langsung dengan "GOLDEN QUEEN".'
    };
  }
  if ((fullA.includes('matahari')) && (fullB.includes('sunlight') || fullB.includes('sun'))) {
    return {
      isSimilar: true,
      ratio: 0.90,
      keterangan: 'Persamaan konseptual: kata "MATAHARI" bersesuaian arti dengan "SUN / SUNLIGHT".'
    };
  }
  if ((fullB.includes('matahari')) && (fullA.includes('sunlight') || fullA.includes('sun'))) {
    return {
      isSimilar: true,
      ratio: 0.90,
      keterangan: 'Persamaan konseptual: kata "MATAHARI" bersesuaian arti dengan "SUN / SUNLIGHT".'
    };
  }

  return { isSimilar: false, ratio: 0, keterangan: '' };
}

/**
 * Mesin utama deteksi kemiripan merek terhadap basis data PDKI
 */
export function detectSimilarTrademarks(
  namaMerekPemohon: string,
  database: TrademarkRecord[],
  kelasTarget: number[] = []
): MatchedTrademark[] {
  const results: MatchedTrademark[] = [];
  const cleanApplicant = namaMerekPemohon.trim();
  if (!cleanApplicant) return results;

  for (const record of database) {
    const jenisKemiripan: JenisKemiripan[] = [];
    const rincianKemiripan: SimilarityDetail[] = [];

    // 1. Pengujian Fonetik Bunyi
    const phoneticTest = testPhoneticSimilarity(cleanApplicant, record.namaMerek);
    if (phoneticTest.isSimilar) {
      jenisKemiripan.push('Fonetik / Bunyi');
      rincianKemiripan.push({
        jenis: 'Fonetik / Bunyi',
        keterangan: phoneticTest.keterangan
      });
    }

    // 2. Pengujian Visual / Bentuk Kata
    const visualRatio = visualSimilarityRatio(cleanApplicant, record.namaMerek);
    if (visualRatio >= 0.65) {
      jenisKemiripan.push('Visual / Bentuk');
      const pct = Math.round(visualRatio * 100);
      rincianKemiripan.push({
        jenis: 'Visual / Bentuk',
        keterangan: `Persamaan susunan dan kombinasi karakter visual (${pct}% kemiripan huruf grafis: susunan huruf muka, tengah, atau akhiran memiliki kemiripan tata letak).`
      });
    }

    // 3. Pengujian Konseptual / Makna Gagasan
    const conceptualTest = testConceptualSimilarity(cleanApplicant, record.namaMerek);
    if (conceptualTest.isSimilar) {
      jenisKemiripan.push('Konseptual / Makna');
      rincianKemiripan.push({
        jenis: 'Konseptual / Makna',
        keterangan: conceptualTest.keterangan
      });
    }

    // Jika ada minimal satu jenis kemiripan yang signifikan
    if (jenisKemiripan.length > 0) {
      const maxScore = Math.max(
        phoneticTest.isSimilar ? phoneticTest.ratio : 0,
        visualRatio >= 0.65 ? visualRatio : 0,
        conceptualTest.isSimilar ? conceptualTest.ratio : 0
      );

      // Hitung bobot relevansi kelas Nice
      const hasClassOverlap = kelasTarget.length === 0 || record.kelasNice.some(k => kelasTarget.includes(k));
      const adjustedScore = hasClassOverlap ? maxScore + 0.05 : maxScore;

      results.push({
        merekTerdaftar: record,
        skorKemiripanTotal: Math.min(1.0, adjustedScore),
        jenisKemiripan,
        rincianKemiripan
      });
    }
  }

  // Urutkan dari yang memiliki kemiripan tertinggi
  return results.sort((a, b) => b.skorKemiripanTotal - a.skorKemiripanTotal);
}
