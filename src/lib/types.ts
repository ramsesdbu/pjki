/**
 * Definisi Tipe Data Sistem Pemeriksaan Substantif Merek
 * Berdasarkan Pedoman Pemeriksaan Substantif Merek DJKI Bagian 5.1.4
 */

export interface TrademarkRecord {
  nomorPendaftaran: string; // misal IDM000672190
  nomorPermohonan: string;  // misal DID2018042918
  namaMerek: string;
  pemilik: string;
  tanggalPenerimaan: string;
  tanggalPerlindungan: string;
  kelasNice: number[];
  uraianBarangJasa: string;
  statusPendaftaran: 'Terdaftar' | 'Perpanjangan Terdaftar';
}

export type JenisKemiripan = 'Fonetik / Bunyi' | 'Visual / Bentuk' | 'Konseptual / Makna';

export interface SimilarityDetail {
  jenis: JenisKemiripan;
  keterangan: string;
}

export interface MatchedTrademark {
  merekTerdaftar: TrademarkRecord;
  skorKemiripanTotal: number;
  jenisKemiripan: JenisKemiripan[];
  rincianKemiripan: SimilarityDetail[];
}

export interface AlasanYuridis514 {
  butirPedoman: '5.1.4.1' | '5.1.4.2' | '5.1.4.3';
  judulKategori: string;
  analisisSintaksis?: string; // Khusus 5.1.4.1 (pembatas yaitu/khususnya vs pengabaian seperti/termasuk)
  hubunganKategori?: 'Identik Literal' | 'Sinonim' | 'Genus Pemohon mencakup Species Terdaftar' | 'Species Pemohon tercakup Genus Terdaftar'; // Khusus 5.1.4.2
  faktorNonIdentikTerpenuhi?: {
    sifatProduk?: string;
    tujuanMetodePenggunaan?: string;
    komplementaritas?: string;
    kompetisiSubstitusi?: string;
    saluranDistribusi?: string;
    targetKonsumen?: string;
    asalProdusenIndustri?: string;
  }; // Khusus 5.1.4.3
  uraianLengkap: string;
}

export interface ConflictingGoodsItem {
  id: string;
  barangPemohon: string;
  kelasPemohon: number;
  barangTerdaftarPembanding: string;
  kelasPembanding: number;
  merekPembanding: string;
  nomorPendaftaranPembanding: string;
  pemilikPembanding: string;
  alasanYuridis: AlasanYuridis514;
}

export interface ExaminationResult {
  inputNamaMerek: string;
  inputUraianBarangJasa: string;
  timestampPemeriksaan: string;
  daftarMerekMirip: MatchedTrademark[];
  daftarBarangSejenisTidakBisaDidaftarkan: ConflictingGoodsItem[];
}
