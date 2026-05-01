// ============================================
//  SEKOLAH MAP - Coordinate Accuracy Validator
//  js/app.js
// ============================================

const CONFIG = {
  center: [-3.98, 122.51],
  zoom: 12,
  // Nominatim: reverse geocode to validate coords
  nominatimUrl: 'https://nominatim.openstreetmap.org/reverse',
  // Threshold (meters) for accuracy rating
  threshGood:   150,
  threshMedium: 500,
};

const COLORS = { SMA: '#58a6ff', SMP: '#3fb950', SMK: '#f0883e' };

// ── State ──────────────────────────────────────
let map, allSchools = [], filteredSchools = [];
let activeTypes = new Set(['SMA', 'SMP', 'SMK']);
let selectedSchool = null;
let userLocation  = null;
let markerLayer   = L.layerGroup();
let corrections   = {};   // { id: { lintang, bujur } }
let accuracyCache = {};   // { id: { score, distance, level } }
let currentTab    = 'list';

// ── Init ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadData();
  renderList();
  initUI();
  requestUserLocation();
});

// ── Map ───────────────────────────────────────
function initMap() {
  map = L.map('map', { zoomControl: true }).setView(CONFIG.center, CONFIG.zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  markerLayer.addTo(map);
}

// ── Data Loading ──────────────────────────────
async function loadData() {
const files = [
    { file: 'sma.json', type: 'SMA' },
    { file: 'smp.json', type: 'SMP' },
    { file: 'smk.json', type: 'SMK' },
  ];

  for (const { file, type } of files) {
    try {
      const res = await fetch(file);
      if (!res.ok) continue;
      const data = await res.json();
      data.forEach(s => {
        s._type = s.bentuk || type;
        s._edited = false;
        allSchools.push(s);
      });
    } catch (e) {
      console.warn(`Gagal memuat ${file}:`, e);
    }
  }

  updateStatBadges();
  applyFilters();
}

function updateStatBadges() {
  ['SMA','SMP','SMK'].forEach(t => {
    const el = document.querySelector(`.stat-badge.${t.toLowerCase()} .count`);
    if (el) el.textContent = allSchools.filter(s => s._type === t).length;
  });
}

// ── Filters ───────────────────────────────────
function applyFilters() {
  const q = document.getElementById('search-box').value.toLowerCase().trim();
  filteredSchools = allSchools.filter(s => {
    if (!activeTypes.has(s._type)) return false;
    if (q) {
      const hay = [s.sekolah, s.kecamatan, s.kabupaten_kota, s.npsn, s.alamat_jalan]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  renderMarkers();
  renderList();
}

// ── Markers ───────────────────────────────────
function renderMarkers() {
  markerLayer.clearLayers();

  filteredSchools.forEach(school => {
    const lat = parseFloat(corrections[school.id]?.lintang ?? school.lintang);
    const lng = parseFloat(corrections[school.id]?.bujur   ?? school.bujur);
    if (isNaN(lat) || isNaN(lng)) return;

    const acc   = accuracyCache[school.id];
    const level = acc ? acc.level : 'unknown';

    const color = COLORS[school._type] || '#fff';
    const ring  = { good:'#3fb950', medium:'#e3b341', bad:'#f85149', unknown:'#484f58' }[level];

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:14px; height:14px; border-radius:50%;
        background:${color};
        border:2.5px solid ${ring};
        box-shadow:0 0 8px ${color}60;
        cursor:pointer;
        transition: transform 0.2s;
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    const marker = L.marker([lat, lng], { icon })
      .bindPopup(buildPopupHTML(school), { maxWidth: 260 });

    marker.on('click', () => selectSchool(school));
    markerLayer.addLayer(marker);
    school._marker = marker;
  });
}

function buildPopupHTML(school) {
  const acc   = accuracyCache[school.id];
  const level = acc?.level || 'unknown';
  const score = acc ? acc.score + '%' : '—';
  const dist  = acc ? acc.distance + 'm' : '—';
  const colorMap = { good:'#3fb950', medium:'#e3b341', bad:'#f85149', unknown:'#8b949e' };
  return `
    <div class="popup-name">${school.sekolah}</div>
    <div class="popup-npsn">NPSN: ${school.npsn}</div>
    <div class="popup-addr">${school.alamat_jalan || '—'}, ${school.kecamatan || ''}</div>
    <div class="popup-acc">
      Akurasi: <strong style="color:${colorMap[level]}">${score}</strong>
      &nbsp;·&nbsp; Deviasi: <strong>${dist}</strong>
    </div>
  `;
}

// ── List ──────────────────────────────────────
function renderList() {
  const container = document.getElementById('school-list');
  container.innerHTML = '';

  if (filteredSchools.length === 0) {
    container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">Tidak ada sekolah ditemukan</div>';
    return;
  }

  filteredSchools.forEach(school => {
    const acc   = accuracyCache[school.id];
    const level = acc?.level || 'unknown';
    const score = acc ? acc.score + '%' : '?';

    const item = document.createElement('div');
    item.className = 'school-item' + (selectedSchool?.id === school.id ? ' selected' : '');
    item.dataset.id = school.id;
    item.innerHTML = `
      <div class="school-dot ${school._type}"></div>
      <div class="school-info">
        <div class="school-name">${school.sekolah}</div>
        <div class="school-sub">${school._type} · ${school.kecamatan || school.kabupaten_kota}</div>
      </div>
      <div class="acc-badge ${level}">${score}</div>
    `;
    item.addEventListener('click', () => selectSchool(school));
    container.appendChild(item);
  });
}

// ── Select School ─────────────────────────────
function selectSchool(school) {
  selectedSchool = school;

  // Update list highlight
  document.querySelectorAll('.school-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === school.id);
  });

  // Fly to marker
  const lat = parseFloat(corrections[school.id]?.lintang ?? school.lintang);
  const lng = parseFloat(corrections[school.id]?.bujur   ?? school.bujur);
  if (!isNaN(lat) && !isNaN(lng)) {
    map.flyTo([lat, lng], 16, { duration: 1.2 });
    school._marker?.openPopup();
  }

  // Switch to detail tab
  switchTab('detail');
  renderDetail(school);
}

// ── Detail Panel ──────────────────────────────
function renderDetail(school) {
  const panel = document.getElementById('detail-panel');
  const acc   = accuracyCache[school.id];
  const level = acc?.level || 'unknown';
  const score = acc ? acc.score : null;
  const edited = corrections[school.id];

  const curLat = edited?.lintang ?? school.lintang;
  const curLng = edited?.bujur   ?? school.bujur;

  const distHTML = userLocation
    ? `<div class="dist-section">
        <div class="acc-title" style="margin-bottom:6px;">📍 Jarak dari Lokasi Anda</div>
        <div class="dist-value">${calcDistKm(userLocation[0], userLocation[1], parseFloat(curLat), parseFloat(curLng))} km</div>
        <div class="dist-label">garis lurus</div>
       </div>`
    : `<div class="dist-section">
        <div class="acc-title" style="margin-bottom:6px;">📍 Jarak dari Lokasi Anda</div>
        <div style="font-size:12px; color:var(--text-secondary)">Lokasi tidak tersedia. <a href="#" onclick="requestUserLocation(); return false;" style="color:var(--accent-blue);">Izinkan akses lokasi</a></div>
       </div>`;

  const colorMap = { good:'var(--good)', medium:'var(--medium)', bad:'var(--bad)', unknown:'var(--text-muted)' };
  const accLabel = { good:'✅ Akurat', medium:'⚠️ Kurang Akurat', bad:'❌ Tidak Akurat', unknown:'🔍 Belum Diverifikasi' };

  panel.innerHTML = `
    <div class="detail-title">${school.sekolah}</div>
    <div class="detail-npsn">NPSN: ${school.npsn} · ${school._type} · Status: ${school.status === 'N' ? 'Negeri' : 'Swasta'}</div>

    <div class="info-grid">
      <div class="info-item full">
        <div class="info-label">Alamat</div>
        <div class="info-value">${school.alamat_jalan || '—'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Kecamatan</div>
        <div class="info-value">${school.kecamatan || '—'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Kab/Kota</div>
        <div class="info-value">${school.kabupaten_kota || '—'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Lintang</div>
        <div class="info-value mono">${curLat}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Bujur</div>
        <div class="info-value mono">${curLng}</div>
      </div>
    </div>

    <div class="accuracy-section">
      <div class="acc-header">
        <div class="acc-title">🎯 Akurasi Koordinat</div>
        <div class="acc-score ${level}">${score !== null ? score + '%' : '—'}</div>
      </div>
      <div class="acc-bar-bg">
        <div class="acc-bar-fill ${level}" style="width:${score ?? 0}%"></div>
      </div>
      <div class="acc-detail">
        Status: <span style="color:${colorMap[level]}">${accLabel[level]}</span>
        ${acc ? `&nbsp;·&nbsp; Deviasi: <span>${acc.distance}m</span>` : ''}
      </div>
      <div style="margin-top:8px;">
        <button class="btn primary" style="font-size:11px;" onclick="verifyCoordinate('${school.id}')">
          🔍 Verifikasi Sekarang
        </button>
      </div>
    </div>

    ${distHTML}

    <div class="edit-section">
      <div class="edit-title">✏️ Koreksi Koordinat</div>
      <div class="form-row">
        <div class="form-group">
          <label>Lintang (Lat)</label>
          <input type="number" id="edit-lat" step="0.0000001" value="${curLat}"
            oninput="markChanged('edit-lat')" placeholder="-3.9786120"/>
        </div>
        <div class="form-group">
          <label>Bujur (Lng)</label>
          <input type="number" id="edit-lng" step="0.0000001" value="${curLng}"
            oninput="markChanged('edit-lng')" placeholder="122.5120830"/>
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn" style="font-size:11px;" onclick="pickFromMap('${school.id}')">📌 Pilih dari Peta</button>
        <button class="btn primary" style="font-size:11px;" onclick="saveCorrection('${school.id}')">💾 Simpan</button>
        ${edited ? `<button class="btn danger" style="font-size:11px;" onclick="resetCorrection('${school.id}')">↩ Reset</button>` : ''}
      </div>
    </div>
  `;
}

function markChanged(inputId) {
  document.getElementById(inputId)?.classList.add('changed');
}

// ── Accuracy Verification ─────────────────────
async function verifyCoordinate(schoolId) {
  const school = allSchools.find(s => s.id === schoolId);
  if (!school) return;

  const lat = parseFloat(corrections[schoolId]?.lintang ?? school.lintang);
  const lng = parseFloat(corrections[schoolId]?.bujur   ?? school.bujur);
  if (isNaN(lat) || isNaN(lng)) return showToast('Koordinat tidak valid', 'info');

  showToast('🔍 Memverifikasi koordinat...', 'info');

  try {
    const url = `${CONFIG.nominatimUrl}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'id' } });
    const data = await res.json();

    // Score based on address match
    const addr = (data.display_name || '').toLowerCase();
    const schoolName = school.sekolah.toLowerCase();
    const kec  = (school.kecamatan || '').toLowerCase().replace('kec.','').trim();
    const kab  = (school.kabupaten_kota || '').toLowerCase().replace('kota','').trim();

    let score = 40; // base: coord is in valid area
    if (addr.includes(kab)) score += 20;
    if (addr.includes(kec)) score += 20;

    // Check distance from name-based search (simple heuristic)
    const nameWords = schoolName.split(' ').filter(w => w.length > 2);
    const matchCount = nameWords.filter(w => addr.includes(w)).length;
    score += Math.min(20, matchCount * 5);

    score = Math.min(100, score);

    // Estimate distance deviation using bounding box
    const bb = data.boundingbox;
    let distance = 0;
    if (bb) {
      const clat = (parseFloat(bb[0]) + parseFloat(bb[1])) / 2;
      const clng = (parseFloat(bb[2]) + parseFloat(bb[3])) / 2;
      distance   = Math.round(haversine(lat, lng, clat, clng));
    }

    const level = score >= 80 ? 'good' : score >= 55 ? 'medium' : 'bad';
    accuracyCache[schoolId] = { score, distance, level, address: data.display_name };

    renderList();
    renderMarkers();
    if (selectedSchool?.id === schoolId) renderDetail(school);
    showToast(`Akurasi: ${score}% (${level === 'good' ? 'Akurat' : level === 'medium' ? 'Kurang Akurat' : 'Tidak Akurat'})`, 'success');

  } catch (e) {
    showToast('Gagal verifikasi — periksa koneksi internet', 'info');
    console.error(e);
  }
}

// Verify all visible schools
async function verifyAll() {
  showToast(`Memverifikasi ${filteredSchools.length} sekolah...`, 'info');
  for (const s of filteredSchools) {
    await verifyCoordinate(s.id);
    await sleep(300); // rate limit Nominatim (1 req/s)
  }
  showToast('✅ Verifikasi selesai!', 'success');
  updateExportPanel();
}

// ── Correction ────────────────────────────────
function saveCorrection(schoolId) {
  const lat = document.getElementById('edit-lat')?.value;
  const lng = document.getElementById('edit-lng')?.value;
  if (!lat || !lng) return;

  corrections[schoolId] = { lintang: lat, bujur: lng };
  const school = allSchools.find(s => s.id === schoolId);
  if (school) school._edited = true;

  // Re-render marker
  renderMarkers();
  if (selectedSchool?.id === schoolId) renderDetail(school);
  showToast('✅ Koreksi koordinat disimpan', 'success');
  updateExportPanel();
}

function resetCorrection(schoolId) {
  delete corrections[schoolId];
  delete accuracyCache[schoolId];
  const school = allSchools.find(s => s.id === schoolId);
  if (school) school._edited = false;
  renderMarkers();
  if (selectedSchool?.id === schoolId) renderDetail(school);
  showToast('↩ Koreksi direset ke data asli', 'info');
  updateExportPanel();
}

function pickFromMap(schoolId) {
  showToast('📌 Klik pada peta untuk menentukan koordinat baru', 'info');
  map.once('click', (e) => {
    document.getElementById('edit-lat').value = e.latlng.lat.toFixed(7);
    document.getElementById('edit-lng').value = e.latlng.lng.toFixed(7);
    document.getElementById('edit-lat').classList.add('changed');
    document.getElementById('edit-lng').classList.add('changed');
    showToast(`Koordinat dipilih: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`, 'info');
  });
}

// ── Export ────────────────────────────────────
function updateExportPanel() {
  const total    = allSchools.length;
  const edited   = Object.keys(corrections).length;
  const verified = Object.keys(accuracyCache).length;
  const good     = Object.values(accuracyCache).filter(a => a.level === 'good').length;
  const medium   = Object.values(accuracyCache).filter(a => a.level === 'medium').length;
  const bad      = Object.values(accuracyCache).filter(a => a.level === 'bad').length;

  document.getElementById('exp-total').textContent    = total;
  document.getElementById('exp-edited').textContent   = edited;
  document.getElementById('exp-verified').textContent = verified;
  document.getElementById('exp-good').textContent     = good;
  document.getElementById('exp-medium').textContent   = medium;
  document.getElementById('exp-bad').textContent      = bad;
}

function exportJSON() {
  const result = allSchools.map(s => {
    const corr = corrections[s.id];
    const acc  = accuracyCache[s.id];
    return {
      ...s,
      lintang: corr?.lintang ?? s.lintang,
      bujur:   corr?.bujur   ?? s.bujur,
      _edited:   !!corr,
      _accuracy: acc ? { score: acc.score, level: acc.level, distance_m: acc.distance } : null,
    };
  });
  downloadFile(JSON.stringify(result, null, 2), 'sekolah_terkoreksi.json', 'application/json');
  showToast('✅ File JSON berhasil diunduh', 'success');
}

function exportCorrOnly() {
  const result = allSchools
    .filter(s => corrections[s.id])
    .map(s => ({
      id: s.id, npsn: s.npsn, sekolah: s.sekolah, bentuk: s._type,
      lintang_asli: s.lintang, bujur_asli: s.bujur,
      lintang_baru: corrections[s.id].lintang,
      bujur_baru:   corrections[s.id].bujur,
    }));
  downloadFile(JSON.stringify(result, null, 2), 'koreksi_koordinat.json', 'application/json');
  showToast('✅ File koreksi berhasil diunduh', 'success');
}

function exportCSV() {
  const headers = ['npsn','sekolah','bentuk','status','kecamatan','kabupaten_kota',
    'alamat_jalan','lintang_asli','bujur_asli','lintang_baru','bujur_baru',
    'edited','accuracy_score','accuracy_level','distance_m'];

  const rows = allSchools.map(s => {
    const corr = corrections[s.id];
    const acc  = accuracyCache[s.id];
    return [
      s.npsn, `"${s.sekolah}"`, s._type, s.status, s.kecamatan, s.kabupaten_kota,
      `"${s.alamat_jalan}"`,
      s.lintang, s.bujur,
      corr?.lintang ?? s.lintang, corr?.bujur ?? s.bujur,
      corr ? 'Ya' : 'Tidak',
      acc?.score ?? '', acc?.level ?? '', acc?.distance ?? '',
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  downloadFile(csv, 'sekolah_akurasi.csv', 'text/csv');
  showToast('✅ File CSV berhasil diunduh', 'success');
}

function exportBadOnly() {
  const bad = allSchools.filter(s => {
    const acc = accuracyCache[s.id];
    return acc && (acc.level === 'bad' || acc.level === 'medium');
  });
  const result = bad.map(s => ({
    npsn: s.npsn, sekolah: s.sekolah, bentuk: s._type,
    kecamatan: s.kecamatan, kabupaten_kota: s.kabupaten_kota,
    lintang: corrections[s.id]?.lintang ?? s.lintang,
    bujur:   corrections[s.id]?.bujur   ?? s.bujur,
    accuracy_score: accuracyCache[s.id].score,
    accuracy_level: accuracyCache[s.id].level,
    distance_m: accuracyCache[s.id].distance,
  }));
  downloadFile(JSON.stringify(result, null, 2), 'koordinat_bermasalah.json', 'application/json');
  showToast(`✅ ${bad.length} sekolah bermasalah diekspor`, 'success');
}

// ── User Location ─────────────────────────────
function requestUserLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      userLocation = [pos.coords.latitude, pos.coords.longitude];
      L.circleMarker(userLocation, {
        radius: 8, fillColor: '#bc8cff', fillOpacity: 0.9,
        color: '#fff', weight: 2,
      }).addTo(map).bindPopup('📍 Lokasi Anda');
      if (selectedSchool) renderDetail(selectedSchool);
    },
    err => console.warn('Geolocation denied:', err)
  );
}

// ── UI Init ───────────────────────────────────
function initUI() {
  // Search
  const searchEl = document.getElementById('search-box');
  searchEl.addEventListener('input', () => applyFilters());

  // Filter chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const t = chip.dataset.type;
      if (activeTypes.has(t)) { activeTypes.delete(t); chip.classList.remove('active'); }
      else                    { activeTypes.add(t);    chip.classList.add('active');    }
      applyFilters();
    });
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  updateExportPanel();
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'export') updateExportPanel();
}

// ── Helpers ───────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcDistKm(lat1, lng1, lat2, lng2) {
  return (haversine(lat1, lng1, lat2, lng2) / 1000).toFixed(2);
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }