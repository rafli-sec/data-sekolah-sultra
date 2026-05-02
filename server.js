const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Load data
const loadData = (filename) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, filename), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading ' + filename + ':', error.message);
    return [];
  }
};

// Load all school data
const smpData = loadData('smp.json');
const smaData = loadData('sma.json');
const smkData = loadData('smk.json');

// Combine all data
const allSchools = [...smpData, ...smaData, ...smkData];
const databaseSekolah = require('./data/database-sekolah.json');

console.log('Loaded: ' + smpData.length + ' SMP, ' + smaData.length + ' SMA, ' + smkData.length + ' SMK');
console.log('Total schools: ' + allSchools.length);
console.log('Loaded raw database-sekolah:', databaseSekolah.length, 'records');

// Helper: filter schools based on query params
const filterSchools = (schools, query) => {
  let results = [...schools];
  const { bentuk, sekolah, kabupaten_kota, kecamatan, status, propinsi, page, limit } = query;

  // Filter by school type (bentuk)
  if (bentuk) {
    results = results.filter(function(s) { return s.bentuk && s.bentuk.toLowerCase() === bentuk.toLowerCase(); });
  }

  // Filter by school name (search)
  if (sekolah) {
    const searchTerm = sekolah.toLowerCase();
    results = results.filter(function(s) { return s.sekolah && s.sekolah.toLowerCase().includes(searchTerm); });
  }

  // Filter by regency/kabupaten
  if (kabupaten_kota) {
    const searchTerm = kabupaten_kota.toLowerCase();
    results = results.filter(function(s) { return s.kabupaten_kota && s.kabupaten_kota.toLowerCase().includes(searchTerm); });
  }

  // Filter by kecamatan
  if (kecamatan) {
    const searchTerm = kecamatan.toLowerCase();
    results = results.filter(function(s) { return s.kecamatan && s.kecamatan.toLowerCase().includes(searchTerm); });
  }

  // Filter by status (N = Negeri/Public, S = Swasta/Private)
  if (status) {
    results = results.filter(function(s) { return s.status && s.status.toUpperCase() === status.toUpperCase(); });
  }

  // Filter by propinsi
  if (propinsi) {
    const searchTerm = propinsi.toLowerCase();
    results = results.filter(function(s) { return s.propinsi && s.propinsi.toLowerCase().includes(searchTerm); });
  }

  // Pagination
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || results.length;
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  
  const paginatedResults = results.slice(startIndex, endIndex);

  return {
    success: true,
    total: results.length,
    page: pageNum,
    limit: limitNum,
    data: paginatedResults
  };
};

// GET /api/sekolah - Get all schools with optional filters
app.get('/api/sekolah', function(req, res) {
  try {
    res.json(filterSchools(allSchools, req.query));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/sekolah/:id - Get school by ID
app.get('/api/sekolah/:id', function(req, res) {
  try {
    const id = req.params.id;
    const school = allSchools.find(function(s) { return s.id === id; });

    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }

    res.json({ success: true, data: school });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/smp - Get SMP schools only
app.get('/api/smp', function(req, res) {
  const result = filterSchools(smpData, req.query);
  res.json(result);
});

// GET /api/sma - Get SMA schools only
app.get('/api/sma', function(req, res) {
  const result = filterSchools(smaData, req.query);
  res.json(result);
});

// GET /api/smk - Get SMK schools only
app.get('/api/smk', function(req, res) {
  const result = filterSchools(smkData, req.query);
  res.json(result);
});

// GET /api/kabupaten - Get all unique kabupaten
app.get('/api/kabupaten', function(req, res) {
  try {
    const unique = [...new Set(allSchools.map(function(s) { return s.kabupaten_kota; }).filter(Boolean))];
    res.json({ success: true, data: unique.sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/kecamatan - Get all unique kecamatan (optional, filtered by kabupaten)
app.get('/api/kecamatan', function(req, res) {
  try {
    const { kabupaten_kota } = req.query;
    let schools = allSchools;
    
    if (kabupaten_kota) {
      const searchTerm = kabupaten_kota.toLowerCase();
      schools = allSchools.filter(function(s) { return s.kabupaten_kota && s.kabupaten_kota.toLowerCase().includes(searchTerm); });
    }
    
    const unique = [...new Set(schools.map(function(s) { return s.kecamatan; }).filter(Boolean))];
    res.json({ success: true, data: unique.sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/status - Get status options
app.get('/api/status', function(req, res) {
  res.json({ 
    success: true, 
    data: [
      { code: 'N', name: 'Negeri (Public)' },
      { code: 'S', name: 'Swasta (Private)' }
    ] 
  });
});

// GET /api/database-sekolah - Raw sekolah data in same format as data/database-sekolah.json
app.get(['/api/database-sekolah', '/api/database-sekolah.json'], function(req, res) {
  try {
    res.json(databaseSekolah);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check
app.get('/api', function(req, res) {
  res.json({ 
    success: true, 
    message: 'API Sekolah Sulawesi Tenggara',
    endpoints: [
      'GET /api/sekolah - All schools with filters',
      'GET /api/sekolah/:id - School by ID',
      'GET /api/smp - SMP schools only',
      'GET /api/sma - SMA schools only',
      'GET /api/smk - SMK schools only',
      'GET /api/kabupaten - List of kabupaten',
      'GET /api/kecamatan - List of kecamatan (optional: ?kabupaten_kota=...)',
      'GET /api/status - Status options',
      'GET /api/database-sekolah - Raw data in same format as data/database-sekolah.json'
    ],
    filters: [
      '?bentuk=SMP|SMA|SMK - Filter by school type',
      '?sekolah=... - Search by school name',
      '?kabupaten_kota=... - Filter by kabupaten',
      '?kecamatan=... - Filter by kecamatan',
      '?status=N|S - Filter by status (N=Negeri, S=Swasta)',
      '?page=1&limit=20 - Pagination'
    ],
    stats: {
      smp: smpData.length,
      sma: smaData.length,
      smk: smkData.length,
      total: allSchools.length
    }
  });
});

// Start server when running locally
if (require.main === module) {
  app.listen(PORT, function() {
    console.log('========================================');
    console.log('Server running on http://localhost:' + PORT);
    console.log('API endpoint: http://localhost:' + PORT + '/api');
    console.log('========================================');
  });
}

module.exports = app;
