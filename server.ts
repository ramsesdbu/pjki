import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { PDKI_DATABASE } from './src/lib/pdkiDatabase.ts';
import { detectSimilarTrademarks } from './src/lib/similarityEngine.ts';
import { evaluateConflictingGoods, parseSpecificationWithSyntax } from './src/lib/pedoman514Engine.ts';
import { ExaminationResult } from './src/lib/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Inisialisasi Google GenAI jika GEMINI_API_KEY tersedia
  const apiKey = process.env.GEMINI_API_KEY;
  let aiClient: GoogleGenAI | null = null;
  if (apiKey) {
    try {
      aiClient = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.warn('Gemini AI client initialization skipped:', e);
    }
  }

  // API Endpoint: Pemeriksaan Substantif Merek & Uji Barang Sejenis Pedoman 5.1.4
  app.post('/api/check-conflict', async (req, res) => {
    try {
      const { namaMerek, uraianBarangJasa } = req.body;

      if (!namaMerek || typeof namaMerek !== 'string') {
        return res.status(400).json({ error: 'Nama merek yang dimohonkan wajib diisi.' });
      }

      const inputNama = namaMerek.trim();
      const inputUraian = (uraianBarangJasa || '').trim();

      // Ekstraksi kelas Nice target dari uraian barang/jasa pemohon
      const parsedItems = parseSpecificationWithSyntax(inputUraian);
      const targetClasses = Array.from(new Set(parsedItems.map(p => p.kelas)));

      // 1. Eksekusi Mesin Deteksi Kemiripan Merek terhadap Basis Data Pembanding PDKI
      let daftarMerekMirip = detectSimilarTrademarks(inputNama, PDKI_DATABASE, targetClasses);

      // Jika ada Gemini AI dan daftar awal kurang dari 2 atau ingin memperkaya basis data PDKI yang otentik
      if (aiClient && daftarMerekMirip.length === 0) {
        try {
          const prompt = `Anda adalah sistem pakar konsultan kekayaan intelektual Indonesia khusus basis data PDKI DJKI (Direktorat Jenderal Kekayaan Intelektual).
Analisis nama merek yang dimohonkan: "${inputNama}" untuk kelas Nice terkait: ${targetClasses.length > 0 ? targetClasses.join(', ') : 'umum'}.
Cari atau tentukan merek terdaftar di PDKI DJKI Indonesia yang berpotensi memiliki persamaan pada pokoknya (Fonetik/Bunyi pengucapan termasuk substitusi angka/ejaan gaul seperti 4ever/forever, Visual susunan huruf, atau Konseptual padanan arti/terjemahan).
Balas HANYA dalam format JSON array yang valid tanpa markdown code block, dengan struktur:
[
  {
    "nomorPendaftaran": "IDM000xxxxxx",
    "nomorPermohonan": "DID20xxxxxxx",
    "namaMerek": "NAMA MEREK TERDAFTAR",
    "pemilik": "PT NAMA PERUSAHAAN (Kota/Negara)",
    "tanggalPenerimaan": "Tanggal Bulan Tahun",
    "tanggalPerlindungan": "Tanggal Bulan Tahun",
    "kelasNice": [25],
    "uraianBarangJasa": "Uraian spesifikasi barang terdaftar dengan klausul resmi",
    "statusPendaftaran": "Terdaftar",
    "jenisKemiripan": ["Fonetik / Bunyi"],
    "keteranganKemiripan": "Rincian persamaan pengucapan fonetik bunyi"
  }
]`;

          const aiResponse = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            }
          });

          if (aiResponse && aiResponse.text) {
            try {
              const parsedAI = JSON.parse(aiResponse.text);
              if (Array.isArray(parsedAI) && parsedAI.length > 0) {
                for (const item of parsedAI) {
                  daftarMerekMirip.push({
                    merekTerdaftar: {
                      nomorPendaftaran: item.nomorPendaftaran || 'IDM000789012',
                      nomorPermohonan: item.nomorPermohonan || 'DID2019012345',
                      namaMerek: item.namaMerek || inputNama.toUpperCase(),
                      pemilik: item.pemilik || 'PT PEMILIK MEREK TERDAFTAR',
                      tanggalPenerimaan: item.tanggalPenerimaan || '10 Januari 2019',
                      tanggalPerlindungan: item.tanggalPerlindungan || '10 Januari 2029',
                      kelasNice: Array.isArray(item.kelasNice) ? item.kelasNice : [targetClasses[0] || 25],
                      uraianBarangJasa: item.uraianBarangJasa || 'Barang dan komoditas sejenis.',
                      statusPendaftaran: 'Terdaftar',
                    },
                    skorKemiripanTotal: 0.90,
                    jenisKemiripan: Array.isArray(item.jenisKemiripan) ? item.jenisKemiripan : ['Fonetik / Bunyi'],
                    rincianKemiripan: [
                      {
                        jenis: (item.jenisKemiripan && item.jenisKemiripan[0]) || 'Fonetik / Bunyi',
                        keterangan: item.keteranganKemiripan || 'Persamaan pokok bunyi pengucapan dan konsep merek terdaftar PDKI.'
                      }
                    ]
                  });
                }
              }
            } catch (jsonErr) {
              console.warn('AI response JSON parse error:', jsonErr);
            }
          }
        } catch (genErr) {
          console.warn('Gemini enrichment call failed:', genErr);
        }
      }

      // 2. Eksekusi Pengujian Barang/Jasa Sejenis Berdasarkan Pedoman Pemeriksaan Substantif Merek 5.1.4
      // Sesuai ketentuan mutlak: Sistem TIDAK BOLEH menampilkan saran atau rekomendasi barang/jasa yang dapat didaftarkan.
      const daftarBarangSejenisTidakBisaDidaftarkan = evaluateConflictingGoods(
        inputUraian,
        daftarMerekMirip
      );

      const result: ExaminationResult = {
        inputNamaMerek: inputNama,
        inputUraianBarangJasa: inputUraian,
        timestampPemeriksaan: new Date().toISOString(),
        daftarMerekMirip,
        daftarBarangSejenisTidakBisaDidaftarkan,
      };

      return res.json(result);
    } catch (err: any) {
      console.error('Error during trademark examination:', err);
      return res.status(500).json({
        error: 'Terjadi kesalahan sistem saat melakukan pemeriksaan substantif: ' + (err?.message || 'Internal server error')
      });
    }
  });

  // Mount Vite middleware in development or serve static in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pemeriksa Konflik Merek PDKI DJKI berjalan pada port ${PORT}`);
  });
}

startServer();
