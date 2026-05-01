# Cara Deploy ke Vercel via GitHub

## Langkah 1: Buat GitHub Repository

1. Buka https://github.com/new
2. Buat repository baru (misalnya: `cek-sekolah`)
3. Klik **"Create repository"**

## Langkah 2: Push Kode ke GitHub

Buka terminal/command prompt di folder project:

```bash
# Inisialisasi git (jika belum ada)
git init

# Tambahkan semua file
git add .

# Commit
git commit -m "Initial commit - Sekolah Map"

# Tambahkan remote (ganti URL dengan repo Anda)
git remote add origin https://github.com/USERNAME/cek-sekolah.git

# Push ke GitHub
git push -u origin main
```

## Langkah 3: Import ke Vercel

1. Buka https://vercel.com
2. Klik **"Add New..."** → **"Project"**
3. Pilih repository `cek-sekolah`
4. Klik **"Deploy"**

## Selesai! 🚀

Aplikasi akan tersedia di `https://cek-sekolah.vercel.app`

---

## Catatan Penting:

- File `vercel.json` sudah ditambahkan untuk menangani routing SPA
- Pastikan project structure:
  ```
  ├── index.html
  ├── app.js
  ├── style.css
  ├── sma.json
  ├── smp.json
  ├── smk.json
  └── vercel.json
