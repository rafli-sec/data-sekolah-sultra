# API Sekolah Sulawesi Tenggara

REST API untuk data sekolah di Provinsi Sulawesi Tenggara (SMP, SMA, SMK)

## Install

```bash
npm install
```

## Run

```bash
npm start
```

Server akan berjalan di `http://localhost:3000`

## Endpoints

| Method | Endpoint | Deskripsi |
|-------|---------|-----------|
| GET | `/api` | Info API dan stats |
| GET | `/api/sekolah` | Semua sekolah (filterable) |
| GET | `/api/sekolah/:id` | Sekolah by ID |
| GET | `/api/smp` | Sekolah SMP |
| GET | `/api/sma` | Sekolah SMA |
| GET | `/api/smk` | Sekolah SMK |
| GET | `/api/kabupaten` | Daftar kabupaten |
| GET | `/api/status` | Statussekolah (N/S) |

## Query Parameters

| Parameter | Deskripsi |
|----------|---------|
| `bentuk` | Tipe sekolah (SMP/SMA/SMK) |
| `sekolah` | Nama sekolah (search) |
| `kabupaten_kota` | Kabupaten/Kota |
| `kecamatan` | Kecamatan |
| `status` | N (Negeri) atau S (Swasta) |
| `page` | Halaman |
| `limit` | Batasan hasil |

## Contoh

```bash
# Semua sekolah di Kota Kendari
curl "http://localhost:3000/api/sekolah?kabupaten_kota=Kendari"

# Cari sekolah
curl "http://localhost:3000/api/sekolah?sekolah=SMK"

# SMP negeri saja
curl "http://localhost:3000/api/sekolah?bentuk=SMP&status=N"

# Dengan pagination
curl "http://localhost:3000/api/sekolah?page=1&limit=10"
```

## Data

- **SMP**: 499 sekolah
- **SMA**: 132 sekolah  
- **SMK**: 170 sekolah
- **Total**: 801 sekolah
