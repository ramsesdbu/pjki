import { MatchedTrademark, ConflictingGoodsItem, AlasanYuridis514 } from './types.ts';
import { normalizeText } from './similarityEngine.ts';

/**
 * Pemetaan relasi Genus - Species resmi barang/jasa Nice
 */
interface GenusSpeciesMap {
  genus: string;
  species: string[];
}

const GENUS_SPECIES_KNOWLEDGE: GenusSpeciesMap[] = [
  {
    genus: 'pakaian',
    species: ['kaos', 't-shirt', 'kaos oblong', 'kemeja', 'celana', 'celana jeans', 'celana panjang', 'celana pendek', 'gaun', 'rok', 'jaket', 'sweater', 'jas', 'pakaian olahraga', 'kaus kaki', 'pakaian dalam', 'pakaian rajut', 'pakaian tidur', 'baju renang', 'jersey']
  },
  {
    genus: 'alas kaki',
    species: ['sepatu', 'sepatu santai', 'sepatu olahraga', 'sepatu lari', 'sepatu formal', 'sepatu boot', 'sandal', 'selop', 'alas kaki bertali']
  },
  {
    genus: 'tutup kepala',
    species: ['topi', 'topi bisbol', 'baret', 'peci', 'songkok', 'helm kain', 'kupluk', 'topi rimba']
  },
  {
    genus: 'kosmetik',
    species: ['krim pelembap', 'losion wajah', 'losion kulit', 'serum wajah', 'bedak', 'alas bedak', 'riasan mata', 'lipstik', 'pewarna bibir', 'lulur', 'masker wajah', 'pembersih riasan', 'sabun wajah']
  },
  {
    genus: 'sabun',
    species: ['sabun mandi', 'sabun herbal', 'sabun cuci tangan', 'sabun batangan', 'sabun cair']
  },
  {
    genus: 'sediaan pembersih',
    species: ['deterjen cuci pakaian', 'sabun cuci piring', 'pembersih lantai', 'cairan pembersih kaca', 'cairan pembersih porselen', 'pembersih serbaguna']
  },
  {
    genus: 'kopi',
    species: ['biji kopi sangrai', 'biji kopi mentah', 'kopi bubuk', 'kopi instan', 'campuran kopi', 'ekstrak kopi', 'konsentrat kopi']
  },
  {
    genus: 'minuman non-alkohol',
    species: ['air mineral', 'air minum dalam kemasan', 'air sumber pegunungan', 'air demineralisasi', 'air soda', 'minuman berkarbonasi', 'minuman isotonik', 'minuman energi', 'sari buah', 'jus buah', 'sirop minuman']
  },
  {
    genus: 'teh',
    species: ['teh seduh', 'teh celup', 'teh hijau', 'teh hitam', 'teh melati', 'ekstrak teh']
  },
  {
    genus: 'cokelat',
    species: ['cokelat batangan', 'permen cokelat', 'bubuk kakao', 'selai cokelat', 'cokelat compound', 'wafer cokelat']
  },
  {
    genus: 'makanan ringan',
    species: ['biskuit', 'kue kering', 'wafer', 'keripik singkong', 'keripik kentang', 'kacang olahan', 'kacang atom', 'kerupuk', 'kembang gula', 'permen']
  },
  {
    genus: 'mi',
    species: ['mi instan', 'bihun instan', 'mi kering', 'mi telur', 'pasta', 'makaroni', 'suun']
  },
  {
    genus: 'komputer dan gawai',
    species: ['komputer jinjing', 'laptop', 'komputer tablet', 'telepon pintar', 'smartphone', 'jam tangan pintar', 'smartwatch', 'server komputer']
  },
  {
    genus: 'perangkat lunak komputer',
    species: ['aplikasi seluler', 'sistem operasi', 'perangkat lunak manajemen keuangan', 'aplikasi e-commerce', 'program komputer basis data']
  },
  {
    genus: 'tas',
    species: ['tas ransel', 'tas punggung', 'tas selempang', 'tas gym', 'koper pakaian', 'dompet', 'tas tangan']
  }
];

// Kamus sinonim barang/jasa
const SYNONYM_MAP: Record<string, string[]> = {
  'kaos': ['t-shirt', 'kaos oblong'],
  't-shirt': ['kaos', 'kaos oblong'],
  'sepatu': ['alas kaki', 'footwear'],
  'alas kaki': ['footwear', 'sepatu'],
  'kopi': ['coffee'],
  'coffee': ['kopi'],
  'teh': ['tea'],
  'tea': ['teh'],
  'air mineral': ['air minum dalam kemasan', 'air minum kemasan', 'air botol', 'mineral water'],
  'perangkat lunak': ['software', 'program komputer', 'aplikasi'],
  'software': ['perangkat lunak', 'program komputer', 'aplikasi'],
  'komputer': ['computer', 'pc'],
  'laptop': ['komputer jinjing', 'notebook'],
  'telepon pintar': ['smartphone', 'ponsel cerdas', 'handphone'],
  'tas ransel': ['tas punggung', 'backpack', 'carrier'],
  'jaket': ['jacket', 'outerwear'],
  'celana': ['trousers', 'pants'],
};

export interface ParsedItem {
  raw: string;
  normalized: string;
  kelas: number;
  isRestrictedByYaitu: boolean; // terpengaruh frasa 'yaitu' / 'khususnya'
  restrictedTo?: string[];
  isIllustrativeHanya: boolean; // didahului frasa 'seperti' / 'termasuk'
}

/**
 * Analisis sintaksis spesifikasi barang/jasa (5.1.4.1)
 * Memilah frasa pembatas ("yaitu" / "khususnya") vs frasa ilustratif ("seperti" / "termasuk")
 */
export function parseSpecificationWithSyntax(text: string, defaultClass = 25): ParsedItem[] {
  const items: ParsedItem[] = [];
  if (!text) return items;

  // Cek apakah ada deklarasi kelas Nice (misal "Kelas 25:", "Kelas 30:", dsb)
  const classBlocks = text.split(/(?:^|\n|;)\s*(?:kelas|class)\s*(\d{1,2})\s*[:\-]/i);

  if (classBlocks.length > 1) {
    // Teks memiliki header kelas eksplisit
    for (let i = 1; i < classBlocks.length; i += 2) {
      const clsNum = parseInt(classBlocks[i], 10);
      const content = classBlocks[i + 1] || '';
      parseContentSegment(content, clsNum, items);
    }
  } else {
    // Tidak ada header kelas eksplisit, deteksi nomor kelas jika ada di awal atau gunakan default
    const classMatch = text.match(/(?:kelas|class)\s*(\d{1,2})/i);
    const clsNum = classMatch ? parseInt(classMatch[1], 10) : defaultClass;
    parseContentSegment(text, clsNum, items);
  }

  return items;
}

function parseContentSegment(segment: string, clsNum: number, items: ParsedItem[]) {
  // Pisahkan berdasarkan titik koma atau koma utama
  const clauses = segment.split(/[,;\n]+/).map(c => c.trim()).filter(Boolean);

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    
    // Periksa frasa pembatas: "yaitu", "khususnya", "yakni" (Pedoman 5.1.4.1)
    if (lower.includes('yaitu') || lower.includes('khususnya') || lower.includes('yakni')) {
      const parts = lower.split(/(?:yaitu|khususnya|yakni)/);
      const genusBefore = parts[0].trim();
      const specificAfter = parts[1].trim();

      const specificList = specificAfter.split(/(?:dan|atau|,)+/).map(s => s.trim()).filter(Boolean);

      for (const spec of specificList) {
        items.push({
          raw: `${clause} (dibatasi secara yuridis pada: ${spec})`,
          normalized: normalizeText(spec),
          kelas: clsNum,
          isRestrictedByYaitu: true,
          restrictedTo: specificList,
          isIllustrativeHanya: false
        });
      }
      continue;
    }

    // Periksa frasa ilustratif non-pembatas: "seperti", "termasuk", "antara lain" (Pedoman 5.1.4.1)
    if (lower.includes('seperti') || lower.includes('termasuk') || lower.includes('antara lain')) {
      const parts = lower.split(/(?:seperti|termasuk|antara lain)/);
      const broadGenus = parts[0].trim();
      const exampleItems = parts[1].trim().split(/(?:dan|atau|,)+/).map(s => s.trim()).filter(Boolean);

      // Kategori luas tetap masuk sebagai lingkup penuh
      if (broadGenus) {
        items.push({
          raw: broadGenus,
          normalized: normalizeText(broadGenus),
          kelas: clsNum,
          isRestrictedByYaitu: false,
          isIllustrativeHanya: false
        });
      }

      // Contoh ilustratif juga dicatat
      for (const ex of exampleItems) {
        items.push({
          raw: ex,
          normalized: normalizeText(ex),
          kelas: clsNum,
          isRestrictedByYaitu: false,
          isIllustrativeHanya: true
        });
      }
      continue;
    }

    // Klausa standar
    items.push({
      raw: clause,
      normalized: normalizeText(clause),
      kelas: clsNum,
      isRestrictedByYaitu: false,
      isIllustrativeHanya: false
    });
  }
}

/**
 * Uji Kesamaan Identik & Hubungan Genus-Species (5.1.4.2)
 */
function testIdenticalOrGenusSpecies(
  itemPemohon: ParsedItem,
  itemTerdaftarNorm: string,
  rawTerdaftarDesc: string
): { isMatch: boolean; details?: AlasanYuridis514 } | null {
  const normPemohon = itemPemohon.normalized;

  // 1. Kesamaan Identik Literal (harfiah persis sama)
  if (normPemohon === itemTerdaftarNorm || rawTerdaftarDesc.toLowerCase().includes(normPemohon)) {
    return {
      isMatch: true,
      details: {
        butirPedoman: '5.1.4.2',
        judulKategori: 'Kesamaan Identik Literal (Pasal 5.1.4.2)',
        hubunganKategori: 'Identik Literal',
        uraianLengkap: `Barang yang dimohonkan ("${itemPemohon.raw}") memiliki kesamaan identik secara harfiah dengan barang terdaftar ("${itemTerdaftarNorm}"). Tidak terdapat diferensiasi objek perlindungan.`
      }
    };
  }

  // 2. Kesamaan Sinonim
  const synonyms = SYNONYM_MAP[normPemohon] || [];
  if (synonyms.some(syn => itemTerdaftarNorm.includes(syn) || rawTerdaftarDesc.toLowerCase().includes(syn))) {
    return {
      isMatch: true,
      details: {
        butirPedoman: '5.1.4.2',
        judulKategori: 'Kesamaan Istilah Sinonim (Pasal 5.1.4.2)',
        hubunganKategori: 'Sinonim',
        uraianLengkap: `Barang yang dimohonkan ("${itemPemohon.raw}") merupakan padanan istilah sinonim langsung dari barang terdaftar ("${itemTerdaftarNorm}"). Walaupun susunan kata berbeda, substansi objek perlindungan barang adalah sama.`
      }
    };
  }

  // 3. Hubungan Genus vs Species
  for (const mapping of GENUS_SPECIES_KNOWLEDGE) {
    const isGenusPemohon = normPemohon.includes(mapping.genus);
    const isSpeciesPemohon = mapping.species.some(sp => normPemohon.includes(sp));

    const isGenusTerdaftar = itemTerdaftarNorm.includes(mapping.genus) || rawTerdaftarDesc.toLowerCase().includes(mapping.genus);
    const isSpeciesTerdaftar = mapping.species.some(sp => itemTerdaftarNorm.includes(sp) || rawTerdaftarDesc.toLowerCase().includes(sp));

    // Kasus A: Terdaftar memegang Genus umum, Pemohon memohonkan Species khusus
    if (isGenusTerdaftar && isSpeciesPemohon) {
      return {
        isMatch: true,
        details: {
          butirPedoman: '5.1.4.2',
          judulKategori: 'Ketercakupan Species dalam Genus Terdaftar (Pasal 5.1.4.2)',
          hubunganKategori: 'Species Pemohon tercakup Genus Terdaftar',
          uraianLengkap: `Barang yang dimohonkan ("${itemPemohon.raw}") merupakan bentuk subordinat/species yang tercakup secara mutlak dalam kategori genus terlindungi milik pihak terdaftar ("${mapping.genus}"). Pendaftaran terdahulu atas genus memberi hak monopoli atas seluruh species di bawahnya.`
        }
      };
    }

    // Kasus B: Pemohon memohonkan Genus luas, sementara Terdaftar memegang Species khusus
    if (isGenusPemohon && isSpeciesTerdaftar) {
      return {
        isMatch: true,
        details: {
          butirPedoman: '5.1.4.2',
          judulKategori: 'Pencakupan Genus Pemohon atas Species Terdaftar (Pasal 5.1.4.2)',
          hubunganKategori: 'Genus Pemohon mencakup Species Terdaftar',
          uraianLengkap: `Permohonan diajukan untuk kategori genus yang luas ("${itemPemohon.raw}") yang mencakup jenis barang spesifik milik pendaftaran terdahulu. Pendaftaran tidak dapat disetujui tanpa pembatasan eksplisit yang mengecualikan barang terdaftar tersebut.`
        }
      };
    }

    // Kasus C: Keduanya merupakan species berbeda di bawah genus intim yang sama (misal celana vs kemeja dalam pakaian)
    if (isSpeciesPemohon && isSpeciesTerdaftar && mapping.genus === 'pakaian') {
      return {
        isMatch: true,
        details: {
          butirPedoman: '5.1.4.2',
          judulKategori: 'Kesamaan Species Sejenis Dalam Genus yang Sama (Pasal 5.1.4.2)',
          hubunganKategori: 'Species Pemohon tercakup Genus Terdaftar',
          uraianLengkap: `Barang yang dimohonkan ("${itemPemohon.raw}") dan barang terdaftar keduanya merupakan species dari genus yang sama ("${mapping.genus}"). Diperdagangkan dalam kategori busana jadi yang sejenis.`
        }
      };
    }
  }

  return null;
}

/**
 * Pengujian 7 Faktor Keterkaitan Non-Identik (5.1.4.3)
 * Menilai keterkaitan barang/jasa non-identik (termasuk lintas kelas Nice yang berkaitan erat)
 */
function testSevenFactorsNonIdentical(
  itemPemohon: ParsedItem,
  merekTerdaftarGoods: string,
  kelasPembanding: number
): { isMatch: boolean; details?: AlasanYuridis514 } | null {
  const normPemohon = itemPemohon.normalized;
  const rawDesc = merekTerdaftarGoods.toLowerCase();

  // Pengujian 1: Pakaian (Kelas 25) vs Tas / Perlengkapan Kulit (Kelas 18)
  const isFashionPemohon = ['pakaian', 'baju', 'kaos', 'kemeja', 'celana', 'sepatu', 'jaket', 'alas kaki'].some(k => normPemohon.includes(k));
  const isBagTerdaftar = ['tas', 'ransel', 'backpack', 'koper', 'dompet', 'tas olahraga', 'tas tangan'].some(k => rawDesc.includes(k));
  if (isFashionPemohon && isBagTerdaftar) {
    return {
      isMatch: true,
      details: {
        butirPedoman: '5.1.4.3',
        judulKategori: 'Pengujian 7 Faktor Keterkaitan Non-Identik (Pasal 5.1.4.3)',
        faktorNonIdentikTerpenuhi: {
          sifatProduk: 'Keduanya merupakan produk perlengkapan gaya hidup/busana (apparel & lifestyle accessories) berbahan tekstil, kanvas, dan kulit.',
          tujuanMetodePenggunaan: 'Digunakan secara bersamaan untuk penampilan pribadi dan mobilitas aktivitas konsumen.',
          komplementaritas: 'Produk tas dan pakaian saling melengkapi secara estetika dalam gaya berbusana terpadu.',
          saluranDistribusi: 'Dijual berdampingan dalam butik ritel, department store mode yang sama, dan kategori belanja yang sama.',
          targetKonsumen: 'Segmen pembeli akhir yang identik (konsumen umum peminat mode busana).',
          asalProdusenIndustri: 'Lazim diproduksi dan dilisensikan di bawah satu rumah mode / produsen busana yang sama (trade origin).'
        },
        uraianLengkap: `Terpenuhi 6 dari 7 faktor keterkaitan substantif (Sifat Produk, Komplementaritas, Saluran Distribusi, Target Konsumen, dan Asal Produsen Industri). Berdasarkan Pedoman 5.1.4.3, pakaian dan tas dinilai sebagai barang sejenis meskipun berada pada kelas Nice yang berbeda (Kelas 25 vs Kelas 18).`
      }
    };
  }

  // Pengujian 2: Kosmetik (Kelas 3) vs Sediaan Pembersih / Sabun (Kelas 3)
  const isSkinCarePemohon = ['krim', 'losion', 'serum', 'kosmetik', 'lulur', 'masker'].some(k => normPemohon.includes(k));
  const isCleanserTerdaftar = ['sabun', 'pembersih', 'sampo', 'wangi-wangian'].some(k => rawDesc.includes(k));
  if (isSkinCarePemohon && isCleanserTerdaftar) {
    return {
      isMatch: true,
      details: {
        butirPedoman: '5.1.4.3',
        judulKategori: 'Pengujian 7 Faktor Keterkaitan Non-Identik (Pasal 5.1.4.3)',
        faktorNonIdentikTerpenuhi: {
          sifatProduk: 'Bahan kimiawi/organik sediaan topikal untuk diaplikasikan langsung pada kulit tubuh dan wajah.',
          tujuanMetodePenggunaan: 'Perawatan higienitas dan estetika penampilan tubuh.',
          komplementaritas: 'Pembersihan (sabun/cleanser) merupakan tahapan komplementer wajib sebelum pengaplikasian krim pelembap/kosmetik.',
          saluranDistribusi: 'Dipasarkan di lorong toiletries/health & beauty counter di apotek dan supermarket.',
          targetKonsumen: 'Masyarakat umum dan pembeli produk perawatan tubuh personal.',
          asalProdusenIndustri: 'Pabrikan industri farmasi/kosmetika yang sama (personal care manufacturers).'
        },
        uraianLengkap: `Terpenuhi 6 faktor keterkaitan substantif (Sifat Produk, Tujuan Penggunaan, Komplementaritas, Saluran Distribusi, Target Konsumen, Asal Produsen Industri) berdasarkan Pedoman 5.1.4.3.`
      }
    };
  }

  // Pengujian 3: Minuman Sari Buah / Air Mineral (Kelas 32) vs Kopi / Teh Kemasan (Kelas 30)
  const isBeverage32 = ['air mineral', 'minuman', 'sari buah', 'isotonik', 'sirup'].some(k => normPemohon.includes(k));
  const isReadyDrink30 = ['kopi', 'teh', 'cokelat bubuk'].some(k => rawDesc.includes(k));
  if (isBeverage32 && isReadyDrink30) {
    return {
      isMatch: true,
      details: {
        butirPedoman: '5.1.4.3',
        judulKategori: 'Pengujian 7 Faktor Keterkaitan Non-Identik (Pasal 5.1.4.3)',
        faktorNonIdentikTerpenuhi: {
          sifatProduk: 'Cairan minuman konsumsi pelepas dahaga dan penyegar tubuh.',
          tujuanMetodePenggunaan: 'Dikonsumsi langsung per oral untuk kebutuhan hidrasi dan penyegaran harian.',
          kompetisiSubstitusi: 'Terdapat hubungan substitutif langsung (konsumen dapat memilih teh kemasan atau jus/air botol sebagai pengganti instan).',
          saluranDistribusi: 'Ditempatkan di lemari pendingin (chiller) dan rak minuman yang berdampingan di minimarket.',
          targetKonsumen: 'Masyarakat umum dari segala tingkatan usia.',
          asalProdusenIndustri: 'Konglomerasi industri minuman cepat saji / FMCG (Fast-Moving Consumer Goods).'
        },
        uraianLengkap: `Terpenuhi faktor substitusi/kompetisi, saluran distribusi, target konsumen, dan asal produsen industri (Pedoman 5.1.4.3). Perbedaan Kelas Nice 32 dan Kelas 30 tidak meniadakan fakta keterkaitan erat dalam peredaran pasar.`
      }
    };
  }

  // Pengujian 4: Perangkat Lunak Komputer (Kelas 9) vs Jasa Pemrograman SaaS / IT (Kelas 42)
  const isSoftware9 = ['perangkat lunak', 'software', 'aplikasi', 'program komputer'].some(k => normPemohon.includes(k));
  const isITService42 = ['pemrograman', 'jasa perangkat lunak', 'saas', 'cloud computing', 'pengembangan aplikasi'].some(k => rawDesc.includes(k));
  if (isSoftware9 && isITService42) {
    return {
      isMatch: true,
      details: {
        butirPedoman: '5.1.4.3',
        judulKategori: 'Pengujian 7 Faktor Keterkaitan Non-Identik Lintas Barang-Jasa (Pasal 5.1.4.3)',
        faktorNonIdentikTerpenuhi: {
          sifatProduk: 'Solusi teknologi informasi berbasis kode biner dan arsitektur komputasi.',
          tujuanMetodePenggunaan: 'Automasi proses kerja dan pemrosesan data pengguna.',
          komplementaritas: 'Tingkat komplementaritas mutlak: perangkat lunak (Kelas 9) beroperasi melalui jasa hosting dan pemeliharaan SaaS (Kelas 42).',
          saluranDistribusi: 'Platform distribusi digital, marketplace enterprise software, dan penawaran vendor IT.',
          targetKonsumen: 'Pengguna korporasi, profesional TI, dan pengguna akhir gawai cerdas.',
          asalProdusenIndustri: 'Perusahaan pengembang teknologi perangkat lunak (software house / tech firm).'
        },
        uraianLengkap: `Berdasarkan Pedoman 5.1.4.3, barang perangkat lunak (Kelas 9) dan jasa pengembangan/hosting SaaS (Kelas 42) dinilai sejenis karena komplementaritas tinggi dan identitas asal produsen industri teknologi yang sama.`
      }
    };
  }

  // Pengujian 5: Produk makanan ringan (Kelas 29 vs 30)
  const isSnack29 = ['keripik', 'kacang', 'kerupuk'].some(k => normPemohon.includes(k));
  const isSnack30 = ['biskuit', 'wafer', 'kue kering', 'kembang gula'].some(k => rawDesc.includes(k));
  if (isSnack29 && isSnack30) {
    return {
      isMatch: true,
      details: {
        butirPedoman: '5.1.4.3',
        judulKategori: 'Pengujian 7 Faktor Keterkaitan Non-Identik (Pasal 5.1.4.3)',
        faktorNonIdentikTerpenuhi: {
          sifatProduk: 'Makanan kudapan kering siap saji dalam kemasan ritel kedap udara.',
          tujuanMetodePenggunaan: 'Konsumsi santai dan selingan di antara waktu makan utama.',
          kompetisiSubstitusi: 'Saling bersaing langsung dalam kategori belanja makanan ringan konsumtif.',
          saluranDistribusi: 'Rak lorong snack di supermarket dan warung kelontong.',
          targetKonsumen: 'Masyarakat umum, anak-anak, dan keluarga.',
          asalProdusenIndustri: 'Pabrikan industri makanan kemasan (snack food manufacturing).'
        },
        uraianLengkap: `Terpenuhi faktor substitutif, kesamaan saluran distribusi, target konsumen, dan pabrikan industri makanan ringan yang sama (Pedoman 5.1.4.3).`
      }
    };
  }

  // Pengujian umum: Barang dalam kelas yang sama dengan tujuan/saluran distribusi serumpun
  if (itemPemohon.kelas === kelasPembanding) {
    // Cek kesamaan kata kunci fungsional
    const keywords = ['pakaian', 'alas kaki', 'sepatu', 'kopi', 'teh', 'minuman', 'sabun', 'pembersih', 'rokok', 'tembakau', 'mi', 'kue', 'lampu', 'elektronik'];
    for (const kw of keywords) {
      if (normPemohon.includes(kw) && rawDesc.includes(kw)) {
        return {
          isMatch: true,
          details: {
            butirPedoman: '5.1.4.3',
            judulKategori: 'Pengujian 7 Faktor Keterkaitan Non-Identik (Pasal 5.1.4.3)',
            faktorNonIdentikTerpenuhi: {
              sifatProduk: `Memiliki karakteristik fisik dan fungsi pokok yang berhubungan erat dalam rumpun "${kw}".`,
              tujuanMetodePenggunaan: 'Memenuhi kebutuhan fungsional yang serupa pada konsumen sasaran.',
              saluranDistribusi: 'Beredar pada jalur distribusi dan tempat penjualan yang sama.',
              targetKonsumen: 'Menyasar segmen pembeli yang sama dengan perhatian belanja yang sebanding.',
              asalProdusenIndustri: 'Konsumen wajar berasumsi kedua produk berasal dari unit usaha atau lisensi yang sama.'
            },
            uraianLengkap: `Terpenuhi faktor-faktor keterkaitan non-identik dalam satu rumpun komoditas sejenis dalam Kelas ${itemPemohon.kelas} (Pedoman 5.1.4.3).`
          }
        };
      }
    }
  }

  return null;
}

/**
 * Mesin Utama Pengujian Barang/Jasa Sejenis Berdasarkan Pedoman 5.1.4
 * MUTLAK: Sistem TIDAK BOLEH menampilkan saran atau rekomendasi barang/jasa yang dapat didaftarkan.
 */
export function evaluateConflictingGoods(
  uraianBarangJasaPemohon: string,
  matchedTrademarks: MatchedTrademark[]
): ConflictingGoodsItem[] {
  const conflictingList: ConflictingGoodsItem[] = [];
  const parsedApplicantItems = parseSpecificationWithSyntax(uraianBarangJasaPemohon);

  if (parsedApplicantItems.length === 0 || matchedTrademarks.length === 0) {
    return conflictingList;
  }

  // Set unik untuk mencegah duplikasi barang terbentur yang identik
  const seenKeys = new Set<string>();

  for (const match of matchedTrademarks) {
    const tm = match.merekTerdaftar;
    const registeredDesc = tm.uraianBarangJasa;
    const regNorm = normalizeText(registeredDesc);

    // Periksa dampak frasa pembatas "yaitu/khususnya" pada merek terdaftar (Pedoman 5.1.4.1)
    const tmHasYaitu = /yaitu|khususnya|yakni/i.test(registeredDesc);
    let tmExplicitScope = registeredDesc;
    if (tmHasYaitu) {
      const matchYaitu = registeredDesc.match(/(?:yaitu|khususnya|yakni)\s*([^.;]+)/i);
      if (matchYaitu) {
        tmExplicitScope = matchYaitu[1];
      }
    }

    for (const applicantItem of parsedApplicantItems) {
      // 1. Evaluasi Sintaksis Pembatas (5.1.4.1)
      if (tmHasYaitu) {
        // Lingkup merek terdaftar dibatasi hanya pada daftar setelah 'yaitu/khususnya'
        // Jika barang pemohon tidak ada dalam lingkup pembatas tersebut dan bukan sejenis dengannya,
        // maka berkat pembatas 5.1.4.1 tidak terjadi benturan atas kategori di luar pembatas!
        const normScope = normalizeText(tmExplicitScope);
        const hitInRestricted = normScope.includes(applicantItem.normalized);
        if (!hitInRestricted) {
          // Tidak membentur barang terdaftar karena terdaftar telah membatasi diri
          // Lanjut ke pemeriksaan faktor lain jika ada species terkait
        }
      }

      // 2. Evaluasi Kesamaan Identik & Hubungan Genus-Species (5.1.4.2)
      const identicalOrGenusTest = testIdenticalOrGenusSpecies(
        applicantItem,
        regNorm,
        registeredDesc
      );

      if (identicalOrGenusTest && identicalOrGenusTest.isMatch && identicalOrGenusTest.details) {
        const uniqueKey = `${applicantItem.raw}__${tm.nomorPendaftaran}__${identicalOrGenusTest.details.judulKategori}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          conflictingList.push({
            id: `conflict-${conflictingList.length + 1}`,
            barangPemohon: applicantItem.raw,
            kelasPemohon: applicantItem.kelas,
            barangTerdaftarPembanding: tm.uraianBarangJasa,
            kelasPembanding: tm.kelasNice[0] || applicantItem.kelas,
            merekPembanding: tm.namaMerek,
            nomorPendaftaranPembanding: tm.nomorPendaftaran,
            pemilikPembanding: tm.pemilik,
            alasanYuridis: identicalOrGenusTest.details
          });
        }
        continue;
      }

      // 3. Evaluasi 7 Faktor Keterkaitan Non-Identik (5.1.4.3)
      for (const regClass of tm.kelasNice) {
        const sevenFactorsTest = testSevenFactorsNonIdentical(
          applicantItem,
          registeredDesc,
          regClass
        );

        if (sevenFactorsTest && sevenFactorsTest.isMatch && sevenFactorsTest.details) {
          const uniqueKey = `${applicantItem.raw}__${tm.nomorPendaftaran}__${sevenFactorsTest.details.judulKategori}`;
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            conflictingList.push({
              id: `conflict-${conflictingList.length + 1}`,
              barangPemohon: applicantItem.raw,
              kelasPemohon: applicantItem.kelas,
              barangTerdaftarPembanding: tm.uraianBarangJasa,
              kelasPembanding: regClass,
              merekPembanding: tm.namaMerek,
              nomorPendaftaranPembanding: tm.nomorPendaftaran,
              pemilikPembanding: tm.pemilik,
              alasanYuridis: sevenFactorsTest.details
            });
          }
          break;
        }
      }
    }
  }

  return conflictingList;
}
