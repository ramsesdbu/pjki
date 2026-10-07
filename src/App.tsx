/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Printer, Copy, Check, Search, FileText } from 'lucide-react';
import { PDKI_DATABASE } from './lib/pdkiDatabase.ts';
import { detectSimilarTrademarks } from './lib/similarityEngine.ts';
import { evaluateConflictingGoods, parseSpecificationWithSyntax } from './lib/pedoman514Engine.ts';
import { ExaminationResult, MatchedTrademark, ConflictingGoodsItem } from './lib/types.ts';

export default function App() {
  const [namaMerek, setNamaMerek] = useState<string>('4EVER');
  const [uraianBarangJasa, setUraianBarangJasa] = useState<string>(
    'Kelas 25: Pakaian, alas kaki, tutup kepala, khususnya kemeja pria dan sepatu formal; jaket santai, celana jeans, pakaian renang'
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ExaminationResult | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Contoh kasus penelusuran konsultan merek
  const CONTOH_KASUS = [
    {
      label: '4EVER (Kelas 25)',
      merek: '4EVER',
      uraian: 'Kelas 25: Pakaian, alas kaki, tutup kepala, khususnya kemeja pria dan sepatu formal; jaket santai, celana jeans, pakaian renang'
    },
    {
      label: 'SUPERKOOL (Kelas 32)',
      merek: 'SUPERKOOL',
      uraian: 'Kelas 32: Air mineral dan minuman non-alkohol, sari buah apel, minuman energi, teh seduh kemasan'
    },
    {
      label: 'RATU KENCANA (Kelas 03)',
      merek: 'RATU KENCANA',
      uraian: 'Kelas 03: Kosmetik, krim pelembap, losion wajah, serum emas, sabun mandi pembersih, lulur herbal'
    },
    {
      label: 'EZ CLEAN (Kelas 03)',
      merek: 'EZ CLEAN',
      uraian: 'Kelas 03: Sediaan pembersih, deterjen cuci pakaian, sabun cuci piring, cairan pembersih kaca'
    },
    {
      label: 'FIRE SHIP (Kelas 30)',
      merek: 'FIRE SHIP',
      uraian: 'Kelas 30: Kopi, biji kopi sangrai, kopi bubuk instan, teh seduh, sediaan minuman cokelat'
    },
    {
      label: 'NAIK SPORT (Kelas 25 & 18)',
      merek: 'NAIK SPORT',
      uraian: 'Kelas 25: Pakaian olahraga, jaket lari, celana pendek, sepatu lari; Kelas 18: Tas ransel olahraga, tas punggung'
    }
  ];

  const handleApplyContoh = (contoh: typeof CONTOH_KASUS[0]) => {
    setNamaMerek(contoh.merek);
    setUraianBarangJasa(contoh.uraian);
  };

  const handlePeriksa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!namaMerek.trim()) return;

    setIsLoading(true);

    try {
      // Panggil backend API
      const response = await fetch('/api/check-conflict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namaMerek: namaMerek.trim(),
          uraianBarangJasa: uraianBarangJasa.trim(),
        }),
      });

      if (response.ok) {
        const data: ExaminationResult = await response.json();
        setResult(data);
      } else {
        // Fallback langsung ke mesin lokal
        runLocalExamination();
      }
    } catch {
      // Fallback mesin lokal jika jaringan bermasalah
      runLocalExamination();
    } finally {
      setIsLoading(false);
    }
  };

  const runLocalExamination = () => {
    const inputNama = namaMerek.trim();
    const inputUraian = uraianBarangJasa.trim();
    const parsedItems = parseSpecificationWithSyntax(inputUraian);
    const targetClasses = Array.from(new Set(parsedItems.map(p => p.kelas)));

    const matches = detectSimilarTrademarks(inputNama, PDKI_DATABASE, targetClasses);
    const conflicts = evaluateConflictingGoods(inputUraian, matches);

    setResult({
      inputNamaMerek: inputNama,
      inputUraianBarangJasa: inputUraian,
      timestampPemeriksaan: new Date().toISOString(),
      daftarMerekMirip: matches,
      daftarBarangSejenisTidakBisaDidaftarkan: conflicts,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSalinRingkasan = () => {
    if (!result) return;

    let text = `LAPORAN PEMERIKSAAN SUBSTANTIF POTENSI KONFLIK MEREK\n`;
    text += `Basis Data Pembanding: PDKI DJKI Indonesia (https://pdki-indonesia.dgip.go.id/)\n`;
    text += `Pedoman Rujukan: Pedoman Pemeriksaan Substantif Merek DJKI Bagian 5.1.4\n`;
    text += `Tanggal Pemeriksaan: ${new Date(result.timestampPemeriksaan).toLocaleDateString('id-ID', { dateStyle: 'long' })}\n`;
    text += `Nama Merek yang Dimohonkan: ${result.inputNamaMerek}\n`;
    text += `Uraian Barang/Jasa: ${result.inputUraianBarangJasa}\n\n`;

    text += `--- I. DAFTAR MEREK TERDAFTAR YANG MIRIP (${result.daftarMerekMirip.length} Entri Terdeteksi) ---\n`;
    result.daftarMerekMirip.forEach((m, idx) => {
      text += `${idx + 1}. ${m.merekTerdaftar.namaMerek} (${m.merekTerdaftar.nomorPendaftaran})\n`;
      text += `   Pemilik: ${m.merekTerdaftar.pemilik}\n`;
      text += `   Kelas Nice: ${m.merekTerdaftar.kelasNice.join(', ')}\n`;
      text += `   Jenis Kemiripan: ${m.jenisKemiripan.join(' / ')}\n`;
      text += `   Uraian Terdaftar: ${m.merekTerdaftar.uraianBarangJasa}\n`;
      text += `   Masa Perlindungan: s/d ${m.merekTerdaftar.tanggalPerlindungan}\n\n`;
    });

    text += `--- II. DAFTAR JENIS BARANG/JASA SEJENIS YANG SUDAH TIDAK BISA DIDAFTARKAN (${result.daftarBarangSejenisTidakBisaDidaftarkan.length} Barang Terbentur) ---\n`;
    result.daftarBarangSejenisTidakBisaDidaftarkan.forEach((c, idx) => {
      text += `${idx + 1}. Barang Pemohon: "${c.barangPemohon}" (Kelas ${c.kelasPemohon})\n`;
      text += `   Merek Pembanding: ${c.merekPembanding} (${c.nomorPendaftaranPembanding}) - Kelas ${c.kelasPembanding}\n`;
      text += `   Dasar Pedoman: ${c.alasanYuridis.judulKategori}\n`;
      text += `   Alasan Yuridis: ${c.alasanYuridis.uraianLengkap}\n\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  // Filter internal data tabel
  const filteredMerekMirip = (result?.daftarMerekMirip || []).filter((item: MatchedTrademark) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.merekTerdaftar.namaMerek.toLowerCase().includes(q) ||
      item.merekTerdaftar.nomorPendaftaran.toLowerCase().includes(q) ||
      item.merekTerdaftar.pemilik.toLowerCase().includes(q) ||
      item.merekTerdaftar.uraianBarangJasa.toLowerCase().includes(q)
    );
  });

  const filteredBarangKonflik = (result?.daftarBarangSejenisTidakBisaDidaftarkan || []).filter((item: ConflictingGoodsItem) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.barangPemohon.toLowerCase().includes(q) ||
      item.merekPembanding.toLowerCase().includes(q) ||
      item.nomorPendaftaranPembanding.toLowerCase().includes(q) ||
      item.alasanYuridis.judulKategori.toLowerCase().includes(q) ||
      item.alasanYuridis.uraianLengkap.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-900 antialiased py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Bersih & Khusus Konsultan Merek */}
        <header className="border-b border-neutral-200 pb-6 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
            <div>
              <span className="text-xs font-mono-legal text-neutral-500 tracking-wider uppercase">
                Pangkalan Data Kekayaan Intelektual · DJKI Kemenkumham RI
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif-legal font-normal text-neutral-900 tracking-tight mt-1">
                Pemeriksaan Substantif Konflik Merek
              </h1>
            </div>
            <div className="text-xs text-neutral-500 font-normal sm:text-right">
              Pedoman Pemeriksaan Substantif Merek Bagian 5.1.4
            </div>
          </div>
          <p className="text-sm text-neutral-600 mt-2 max-w-3xl leading-relaxed">
            Sistem analisis yuridis netral untuk mendeteksi potensi persamaan pada pokoknya secara visual, fonetik bunyi (termasuk ejaan gaul dan substitusi angka), dan konseptual terhadap data terdaftar PDKI, serta pengujian objektif barang/jasa sejenis berdasarkan sintaksis pembatas, identik/genus-species, dan 7 faktor keterkaitan non-identik.
          </p>
        </header>

        {/* Form Input Sederhana */}
        <section className="bg-white border border-neutral-200 rounded-none p-6 sm:p-8 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] no-print">
          <form onSubmit={handlePeriksa} className="space-y-5">
            <div>
              <label 
                htmlFor="namaMerek" 
                className="block text-xs font-medium uppercase tracking-wider text-neutral-700 mb-1.5"
              >
                Nama Merek yang Dimohonkan
              </label>
              <input
                id="namaMerek"
                type="text"
                value={namaMerek}
                onChange={(e) => setNamaMerek(e.target.value)}
                placeholder="Contoh: 4EVER, SUPERKOOL, RATU KENCANA, EZ CLEAN"
                className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-none focus:outline-none focus:bg-white focus:border-neutral-900 transition-colors font-medium text-neutral-900 placeholder:text-neutral-400"
                required
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Mesin mengenali ejaan fonetik bunyi, transliterasi homofon, substitusi angka (mis. 4ever = forever, 2day = today), dan padanan arti bahasa.
              </p>
            </div>

            <div>
              <label 
                htmlFor="uraianBarangJasa" 
                className="block text-xs font-medium uppercase tracking-wider text-neutral-700 mb-1.5"
              >
                Uraian Jenis Barang/Jasa Beserta Kelasnya
              </label>
              <textarea
                id="uraianBarangJasa"
                rows={4}
                value={uraianBarangJasa}
                onChange={(e) => setUraianBarangJasa(e.target.value)}
                placeholder="Contoh: Kelas 25: Pakaian, alas kaki, tutup kepala, khususnya kemeja pria dan sepatu formal, bukan termasuk pakaian renang"
                className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-none focus:outline-none focus:bg-white focus:border-neutral-900 transition-colors text-neutral-900 placeholder:text-neutral-400 font-normal leading-relaxed"
                required
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Sintaksis kata pembatas "yaitu/khususnya" (5.1.4.1) dan frasa ilustratif non-pembatas "seperti/termasuk" dianalisis secara yuridis terhadap lingkup perlindungan.
              </p>
            </div>

            {/* Subtle Quick Case Selectors */}
            <div className="pt-1 border-t border-neutral-100 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-600">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400">Rujukan cepat kasus:</span>
              {CONTOH_KASUS.map((contoh, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleApplyContoh(contoh)}
                  className="text-neutral-700 hover:text-neutral-950 underline underline-offset-2 decoration-neutral-300 hover:decoration-neutral-900 transition-colors text-xs py-0.5 cursor-pointer"
                >
                  {contoh.label}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !namaMerek.trim()}
                className="w-full sm:w-auto px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium uppercase tracking-widest transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'Sedang Memeriksa Substantif...' : 'Uji Potensi Konflik Substantif'}
              </button>
            </div>
          </form>
        </section>

        {/* Hasil Pemeriksaan Substantif */}
        {result && (
          <div className="space-y-10">
            
            {/* Header Laporan Hasil & Aksi Konsultan */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-4">
              <div>
                <span className="text-xs font-mono-legal text-neutral-500">
                  Hasil Pemeriksaan Substantif Merek
                </span>
                <h2 className="text-xl font-serif-legal font-normal text-neutral-900">
                  Laporan Deteksi Konflik: "{result.inputNamaMerek}"
                </h2>
                <div className="text-xs text-neutral-500 mt-0.5">
                  Waktu Verifikasi: {new Date(result.timestampPemeriksaan).toLocaleString('id-ID')}
                </div>
              </div>

              {/* Utility Tools: Salin & Cetak */}
              <div className="flex items-center gap-2 no-print">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Saring hasil tabel..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-300 focus:outline-none focus:border-neutral-900 w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSalinRingkasan}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:border-neutral-900 text-neutral-800 text-xs font-medium transition-colors cursor-pointer"
                  title="Salin teks lengkap laporan"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-neutral-900" />
                      <span>Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 hover:border-neutral-900 text-neutral-800 text-xs font-medium transition-colors cursor-pointer"
                  title="Cetak laporan resmi atau simpan ke PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Cetak</span>
                </button>
              </div>
            </div>

            {/* TABEL 1: DAFTAR MEREK TERDAFTAR YANG MIRIP */}
            <section className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">
                    Tabel 1: Daftar Merek Terdaftar yang Mirip
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Data pembanding terdaftar dari Pangkalan Data Kekayaan Intelektual (PDKI DJKI Indonesia)
                  </p>
                </div>
                <span className="text-xs font-mono-legal text-neutral-500">
                  {filteredMerekMirip.length} entri ditemukan
                </span>
              </div>

              {filteredMerekMirip.length === 0 ? (
                <div className="p-6 bg-white border border-neutral-200 text-center text-xs text-neutral-500">
                  Tidak ditemukan merek terdaftar pembanding yang memiliki kemiripan fonetik, visual, atau konseptual dengan parameter ini.
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 bg-white">
                  <table className="w-full text-left text-xs divide-y divide-neutral-200">
                    <thead className="bg-neutral-100 text-neutral-700 font-medium">
                      <tr>
                        <th scope="col" className="py-3 px-4 w-32 font-medium">
                          No. Pendaftaran
                        </th>
                        <th scope="col" className="py-3 px-4 w-44 font-medium">
                          Merek & Pemilik
                        </th>
                        <th scope="col" className="py-3 px-3 w-16 text-center font-medium">
                          Kelas
                        </th>
                        <th scope="col" className="py-3 px-4 w-48 font-medium">
                          Kategori Kemiripan
                        </th>
                        <th scope="col" className="py-3 px-4 font-medium">
                          Spesifikasi Barang/Jasa Terdaftar
                        </th>
                        <th scope="col" className="py-3 px-4 w-32 font-medium">
                          Status & Masa Berlaku
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-800">
                      {filteredMerekMirip.map((item, index) => {
                        const m = item.merekTerdaftar;
                        return (
                          <tr key={index} className="hover:bg-neutral-50 transition-colors">
                            {/* Nomor Pendaftaran & Permohonan */}
                            <td className="py-3 px-4 align-top font-mono-legal text-[11px] tabular-nums text-neutral-900">
                              <div className="font-medium">{m.nomorPendaftaran}</div>
                              <div className="text-neutral-500">{m.nomorPermohonan}</div>
                            </td>

                            {/* Nama Merek & Pemilik */}
                            <td className="py-3 px-4 align-top">
                              <div className="font-semibold text-neutral-900 text-[13px]">
                                {m.namaMerek}
                              </div>
                              <div className="text-[11px] text-neutral-600 mt-0.5 leading-snug">
                                {m.pemilik}
                              </div>
                            </td>

                            {/* Kelas Nice */}
                            <td className="py-3 px-3 align-top text-center font-mono-legal tabular-nums font-medium text-neutral-800">
                              {m.kelasNice.join(', ')}
                            </td>

                            {/* Jenis Kemiripan Terdeteksi (Unboxed Clean Text) */}
                            <td className="py-3 px-4 align-top space-y-1.5">
                              <div className="font-medium text-neutral-900">
                                {item.jenisKemiripan.join(' · ')}
                              </div>
                              <div className="space-y-1 text-[11px] text-neutral-600 leading-snug">
                                {item.rincianKemiripan.map((r, ri) => (
                                  <div key={ri}>
                                    <span className="font-medium text-neutral-700">{r.jenis}:</span> {r.keterangan}
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* Uraian Barang/Jasa Terdaftar */}
                            <td className="py-3 px-4 align-top text-neutral-700 leading-relaxed text-[11px]">
                              {m.uraianBarangJasa}
                            </td>

                            {/* Status & Masa Berlaku */}
                            <td className="py-3 px-4 align-top font-mono-legal text-[11px] text-neutral-600">
                              <div>{m.statusPendaftaran}</div>
                              <div className="text-neutral-500 mt-0.5 text-[10px]">
                                s/d {m.tanggalPerlindungan}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* TABEL 2: DAFTAR JENIS BARANG/JASA SEJENIS YANG SUDAH TIDAK BISA DIDAFTARKAN */}
            <section className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">
                    Tabel 2: Daftar Jenis Barang/Jasa Sejenis yang Sudah Tidak Bisa Didaftarkan
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Pengujian objektif berdasarkan Pedoman Pemeriksaan Substantif Merek Bagian 5.1.4 (Sintaksis 5.1.4.1, Genus-Species 5.1.4.2, 7 Faktor Keterkaitan 5.1.4.3)
                  </p>
                </div>
                <span className="text-xs font-mono-legal text-neutral-500">
                  {filteredBarangKonflik.length} barang terbentur
                </span>
              </div>

              {filteredBarangKonflik.length === 0 ? (
                <div className="p-6 bg-white border border-neutral-200 text-center text-xs text-neutral-500">
                  Berdasarkan uraian spesifikasi yang dimasukkan, tidak terdeteksi benturan barang/jasa sejenis yang memenuhi unsur penolakan Pedoman 5.1.4 terhadap merek pembanding di atas.
                </div>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 bg-white">
                  <table className="w-full text-left text-xs divide-y divide-neutral-200">
                    <thead className="bg-neutral-100 text-neutral-700 font-medium">
                      <tr>
                        <th scope="col" className="py-3 px-4 w-44 font-medium">
                          Barang Dimohonkan (Terbentur)
                        </th>
                        <th scope="col" className="py-3 px-3 w-16 text-center font-medium">
                          Kelas
                        </th>
                        <th scope="col" className="py-3 px-4 w-44 font-medium">
                          Merek Pembanding Terdaftar
                        </th>
                        <th scope="col" className="py-3 px-4 w-48 font-medium">
                          Dasar Yuridis Pedoman 5.1.4
                        </th>
                        <th scope="col" className="py-3 px-4 font-medium">
                          Rincian Alasan Yuridis Objektif
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-neutral-800">
                      {filteredBarangKonflik.map((item, index) => {
                        const alasan = item.alasanYuridis;
                        return (
                          <tr key={index} className="hover:bg-neutral-50 transition-colors">
                            {/* Barang Pemohon yang Terbentur */}
                            <td className="py-3 px-4 align-top">
                              <div className="font-semibold text-neutral-900 text-[12px]">
                                {item.barangPemohon}
                              </div>
                            </td>

                            {/* Kelas Nice Pemohon & Terdaftar */}
                            <td className="py-3 px-3 align-top text-center font-mono-legal tabular-nums text-neutral-700">
                              <div>{item.kelasPemohon}</div>
                              {item.kelasPembanding !== item.kelasPemohon && (
                                <div className="text-[10px] text-neutral-500">
                                  vs {item.kelasPembanding}
                                </div>
                              )}
                            </td>

                            {/* Merek Terdaftar Pembanding */}
                            <td className="py-3 px-4 align-top">
                              <div className="font-medium text-neutral-900">
                                {item.merekPembanding}
                              </div>
                              <div className="font-mono-legal text-[11px] text-neutral-600 tabular-nums">
                                {item.nomorPendaftaranPembanding}
                              </div>
                              <div className="text-[10px] text-neutral-500 truncate max-w-[160px]">
                                {item.pemilikPembanding}
                              </div>
                            </td>

                            {/* Dasar Yuridis Pedoman 5.1.4 */}
                            <td className="py-3 px-4 align-top">
                              <div className="font-medium text-neutral-900">
                                {alasan.judulKategori}
                              </div>
                              <div className="text-[11px] text-neutral-500 font-mono-legal mt-0.5">
                                Bagian {alasan.butirPedoman}
                              </div>
                            </td>

                            {/* Rincian Alasan Yuridis Objektif */}
                            <td className="py-3 px-4 align-top space-y-2 text-neutral-700 leading-relaxed text-[11px]">
                              <div>{alasan.uraianLengkap}</div>

                              {/* Tampilan rincian 7 faktor jika ada (5.1.4.3) */}
                              {alasan.faktorNonIdentikTerpenuhi && (
                                <div className="mt-1 pt-1 border-t border-neutral-100 space-y-0.5 text-[10px] text-neutral-600">
                                  {alasan.faktorNonIdentikTerpenuhi.sifatProduk && (
                                    <div><span className="font-medium text-neutral-700">1. Sifat Produk:</span> {alasan.faktorNonIdentikTerpenuhi.sifatProduk}</div>
                                  )}
                                  {alasan.faktorNonIdentikTerpenuhi.tujuanMetodePenggunaan && (
                                    <div><span className="font-medium text-neutral-700">2. Tujuan & Metode Penggunaan:</span> {alasan.faktorNonIdentikTerpenuhi.tujuanMetodePenggunaan}</div>
                                  )}
                                  {alasan.faktorNonIdentikTerpenuhi.komplementaritas && (
                                    <div><span className="font-medium text-neutral-700">3. Komplementaritas:</span> {alasan.faktorNonIdentikTerpenuhi.komplementaritas}</div>
                                  )}
                                  {alasan.faktorNonIdentikTerpenuhi.kompetisiSubstitusi && (
                                    <div><span className="font-medium text-neutral-700">4. Kompetisi / Substitusi:</span> {alasan.faktorNonIdentikTerpenuhi.kompetisiSubstitusi}</div>
                                  )}
                                  {alasan.faktorNonIdentikTerpenuhi.saluranDistribusi && (
                                    <div><span className="font-medium text-neutral-700">5. Saluran Distribusi:</span> {alasan.faktorNonIdentikTerpenuhi.saluranDistribusi}</div>
                                  )}
                                  {alasan.faktorNonIdentikTerpenuhi.targetKonsumen && (
                                    <div><span className="font-medium text-neutral-700">6. Target Konsumen:</span> {alasan.faktorNonIdentikTerpenuhi.targetKonsumen}</div>
                                  )}
                                  {alasan.faktorNonIdentikTerpenuhi.asalProdusenIndustri && (
                                    <div><span className="font-medium text-neutral-700">7. Asal Produsen Industri:</span> {alasan.faktorNonIdentikTerpenuhi.asalProdusenIndustri}</div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Catatan Kepatuhan Konsultan */}
            <div className="border-t border-neutral-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-neutral-500 gap-2">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                <span>Pengujian ini murni menyajikan inventarisasi yuridis potensi benturan tanpa memuat rekomendasi barang/jasa yang dapat didaftarkan.</span>
              </div>
              <div className="text-[11px] font-mono-legal text-neutral-400">
                PDKI DGIP Substantive Protocol · Non-Prescriptive Legal Engine
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
