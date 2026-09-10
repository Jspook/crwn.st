// ==========================================================
// crwn.st Global Client Application Utilities
// ==========================================================

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    console.error(e);
  }
  window.location.href = '/';
}

// Room Scanner / Selection Modal
async function loadRoomModalStatus() {
  const container = document.getElementById('rooms-grid-container');
  if (!container) return;

  try {
    const res = await fetch('/api/fitting-rooms');
    if (!res.ok) return;
    const rooms = await res.json();

    container.innerHTML = rooms.map(r => {
      const isOccupied = r.FTR_Status === 'occupied';
      const isMine = r.isMySession;
      const numDisplay = String(r.FTR_Num).padStart(2, '0');

      if (isOccupied && !isMine) {
        // Occupied by someone else - STRICTLY DISABLED
        return `
          <button type="button" disabled class="p-4 rounded-2xl bg-gray-100/80 border border-rose-200/70 text-center opacity-50 cursor-not-allowed select-none shadow-2xs group relative transition-all" title="ห้องนี้กำลังมีผู้ใช้งานอยู่">
            <span class="block text-xs text-[#8A8177]">ห้อง</span>
            <span class="block font-serif text-2xl font-bold text-[#8A8177]">${numDisplay}</span>
            <span class="inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-medium">
              <i data-lucide="lock" class="w-2.5 h-2.5"></i> มีคนใช้อยู่
            </span>
          </button>
        `;
      } else if (isMine) {
        // Occupied by current user - Can re-enter
        return `
          <button type="button" onclick="selectRoom('${r.FTR_Num}')" class="p-4 rounded-2xl bg-amber-50/90 hover:bg-amber-100 border border-amber-300 transition text-center group shadow-xs hover:shadow-md cursor-pointer">
            <span class="block text-xs text-amber-800">ห้อง</span>
            <span class="block font-serif text-2xl font-bold text-amber-950 group-hover:scale-105 transition-transform">${numDisplay}</span>
            <span class="inline-block mt-1.5 text-[10px] px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-medium">ห้องของคุณ</span>
          </button>
        `;
      } else {
        // Available - Clickable
        return `
          <button type="button" onclick="selectRoom('${r.FTR_Num}')" class="p-4 rounded-2xl bg-white/80 hover:bg-white border border-[#A3907C]/30 hover:border-[#1F2421] transition text-center group shadow-xs hover:shadow-md cursor-pointer active:scale-95">
            <span class="block text-xs text-[#8A8177]">ห้อง</span>
            <span class="block font-serif text-2xl font-bold text-[#1F2421] group-hover:scale-105 transition-transform">${numDisplay}</span>
            <span class="inline-block mt-1.5 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">ว่าง (เข้าได้)</span>
          </button>
        `;
      }
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    console.warn('Failed to fetch fitting rooms status:', e);
  }
}

function openRoomModal() {
  const modal = document.getElementById('room-modal');
  const errBox = document.getElementById('room-modal-error');
  if (errBox) errBox.classList.add('hidden');
  if (modal) {
    modal.classList.remove('hidden');
    loadRoomModalStatus();
    switchRoomModalTab('select');
  }
}

function closeRoomModal() {
  const modal = document.getElementById('room-modal');
  if (modal) modal.classList.add('hidden');
  stopRoomQrCamera();
}

function switchRoomModalTab(tab) {
  const tabSelect = document.getElementById('tab-room-select');
  const tabQr = document.getElementById('tab-room-qr');
  const secSelect = document.getElementById('section-room-select');
  const secQr = document.getElementById('section-room-qr');

  if (!tabSelect || !tabQr) return;

  if (tab === 'select') {
    tabSelect.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition-all bg-[#1F2421] text-[#F5F2EB] shadow-xs flex items-center justify-center gap-1.5';
    tabQr.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-[#8A8177] hover:text-[#1F2421] flex items-center justify-center gap-1.5';
    if (secSelect) secSelect.classList.remove('hidden');
    if (secQr) secQr.classList.add('hidden');
    stopRoomQrCamera();
  } else {
    tabQr.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition-all bg-[#1F2421] text-[#F5F2EB] shadow-xs flex items-center justify-center gap-1.5';
    tabSelect.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition-all text-[#8A8177] hover:text-[#1F2421] flex items-center justify-center gap-1.5';
    if (secQr) secQr.classList.remove('hidden');
    if (secSelect) secSelect.classList.add('hidden');
  }
  if (window.lucide) window.lucide.createIcons();
}

let roomQrStream = null;
let roomQrScanInterval = null;

async function toggleRoomQrCamera() {
  const video = document.getElementById('room-qr-video');
  const offState = document.getElementById('room-qr-off-state');
  const beam = document.getElementById('room-qr-beam');
  const label = document.getElementById('btn-room-camera-label');

  if (roomQrStream) {
    stopRoomQrCamera();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    roomQrStream = stream;
    if (video) {
      video.srcObject = stream;
      video.classList.remove('hidden');
    }
    if (offState) offState.classList.add('hidden');
    if (beam) beam.classList.remove('hidden');
    if (label) label.textContent = 'ปิดกล้อง';

    // Start scanning barcodes if supported
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
      roomQrScanInterval = setInterval(async () => {
        if (!roomQrStream || !video || video.readyState < 2) return;
        try {
          const codes = await barcodeDetector.detect(video);
          if (codes && codes.length > 0) {
            const rawVal = codes[0].rawValue;
            handleRoomQrScannedValue(rawVal);
          }
        } catch (e) {}
      }, 500);
    }
  } catch (err) {
    console.warn('Cannot open room QR camera:', err);
    showRoomModalError('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง หรือใช้ปุ่มจำลองการสแกน');
  }
}

function stopRoomQrCamera() {
  if (roomQrScanInterval) {
    clearInterval(roomQrScanInterval);
    roomQrScanInterval = null;
  }
  if (roomQrStream) {
    roomQrStream.getTracks().forEach(t => t.stop());
    roomQrStream = null;
  }
  const video = document.getElementById('room-qr-video');
  const offState = document.getElementById('room-qr-off-state');
  const beam = document.getElementById('room-qr-beam');
  const label = document.getElementById('btn-room-camera-label');

  if (video) {
    video.srcObject = null;
    video.classList.add('hidden');
  }
  if (offState) offState.classList.remove('hidden');
  if (beam) beam.classList.add('hidden');
  if (label) label.textContent = 'เปิดกล้องสแกน QR Code';
}

function handleRoomQrScannedValue(raw) {
  if (!raw) return;
  stopRoomQrCamera();
  // Parse room number from URL e.g. /customer/fitting-room?roomId=2, or "ROOM_2", or "2"
  let num = '1';
  if (raw.includes('roomId=')) {
    const m = raw.match(/roomId=([0-9]+)/);
    if (m) num = m[1];
  } else {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits) num = digits;
  }
  selectRoom(num);
}

function simulateRoomQrScan(num) {
  stopRoomQrCamera();
  selectRoom(num);
}

function showRoomModalError(message) {
  const errBox = document.getElementById('room-modal-error');
  const errText = document.getElementById('room-modal-error-text');
  if (errBox && errText) {
    errText.textContent = message;
    errBox.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  } else {
    alert(message);
  }
}

async function selectRoom(roomNum) {
  const cleanNum = String(roomNum || '').trim();
  if (!cleanNum) {
    showRoomModalError('กรุณาระบุหมายเลขห้องลอง');
    return;
  }

  const errBox = document.getElementById('room-modal-error');
  if (errBox) errBox.classList.add('hidden');

  try {
    const res = await fetch('/api/fitting-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomNum: cleanNum }),
    });

    const data = await res.json();

    if (res.ok) {
      stopRoomQrCamera();
      window.location.href = `/customer/fitting-room?roomId=${cleanNum}`;
    } else {
      // Room is occupied or error occurred — strictly DO NOT navigate
      showRoomModalError(data.error || `ห้องลองหมายเลข ${cleanNum} ล็อกอยู่และมีผู้ใช้งาน ไม่สามารถเข้าได้`);
      loadRoomModalStatus();
    }
  } catch (e) {
    console.error('Error selecting room:', e);
    showRoomModalError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
    loadRoomModalStatus();
  }
}

function submitManualRoom() {
  const input = document.getElementById('manual-room-input');
  const val = (input?.value || '').trim();
  if (!val) {
    showRoomModalError('กรุณากรอกหมายเลขห้องลอง เช่น 1, 2, หรือ 3');
    return;
  }
  // Strip non-digits or clean up
  const clean = val.replace(/[^0-9]/g, '') || val;
  selectRoom(clean);
}

// Barcode Scanner Modal
function openBarcodeModal() {
  const modal = document.getElementById('barcode-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const input = document.getElementById('barcode-manual-input');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

function closeBarcodeModal() {
  const modal = document.getElementById('barcode-modal');
  if (modal) modal.classList.add('hidden');
}

async function handleBarcodeLookup(barcode) {
  const code = (barcode || document.getElementById('barcode-manual-input')?.value || '').trim();
  if (!code) return;

  const resultContainer = document.getElementById('barcode-scan-result');
  if (resultContainer) {
    resultContainer.innerHTML = `
      <div class="p-4 text-center text-[#8A8177]">
        <div class="inline-block w-5 h-5 border-2 border-[#1F2421] border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs mt-2">กำลังค้นหาสินค้า ${code}...</p>
      </div>
    `;
  }

  try {
    const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}`);
    if (!res.ok) {
      throw new Error('ไม่พบข้อมูลสินค้าจากบาร์โค้ดนี้');
    }
    const product = await res.json();
    displayScannedProduct(product);
  } catch (err) {
    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
          <p class="font-medium">ไม่พบสินค้า</p>
          <p class="mt-1">${err.message}</p>
        </div>
      `;
    }
  }
}

function displayScannedProduct(product) {
  const resultContainer = document.getElementById('barcode-scan-result');
  if (!resultContainer) return;

  const v = (product.variants && product.variants[0]) || { sku: product.id + '-std', color: 'Standard', size: 'M', stock: 5 };

  resultContainer.innerHTML = `
    <div class="p-4 rounded-2xl bg-white/80 border border-[#A3907C]/30 shadow-sm mt-3 animate-fade-in">
      <div class="flex gap-4">
        <img src="${product.image || 'https://picsum.photos/seed/' + product.id + '/200/200'}" alt="${product.name}" class="w-20 h-20 rounded-xl object-cover bg-[#E8DFD1]">
        <div class="flex-1">
          <span class="text-[10px] uppercase tracking-wider text-[#A3907C] font-semibold">${product.category || 'Luxury Item'}</span>
          <h4 class="font-serif font-medium text-base text-[#1F2421]">${product.name}</h4>
          <p class="font-semibold text-[#1F2421] mt-1">฿${Number(product.price).toLocaleString()}</p>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs px-2 py-0.5 rounded-full bg-[#E8DFD1]/60 text-[#1F2421]">ไซส์: ${v.size || 'Free'}</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-[#E8DFD1]/60 text-[#1F2421]">สี: ${v.color || 'Original'}</span>
            <span class="text-xs text-[#9BAF9F] font-medium ml-auto">คงเหลือ: ${v.stock || 10}</span>
          </div>
        </div>
      </div>
      <div class="mt-4 flex gap-2">
        <button onclick="addScannedToCart('${product.id}', '${product.name}', ${product.price}, '${v.sku}', '${v.color}', '${v.size}', '${product.image}')" class="flex-1 btn-primary text-xs py-2.5">
          <i data-lucide="shopping-bag" class="w-4 h-4"></i> เพิ่มลงในตะกร้า
        </button>
      </div>
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function addScannedToCart(id, name, price, sku, color, size, image) {
  Cart.addItem({
    sku,
    productId: id,
    name,
    price,
    color,
    size,
    image,
  });
  closeBarcodeModal();
}

// Request Modal for Fitting Room
let currentRequestProduct = null;
function openRequestModal(productJson) {
  try {
    currentRequestProduct = typeof productJson === 'string' ? JSON.parse(productJson) : productJson;
  } catch {
    currentRequestProduct = productJson;
  }

  const modal = document.getElementById('request-modal');
  if (!modal || !currentRequestProduct) return;

  document.getElementById('request-product-name').textContent = currentRequestProduct.name;
  document.getElementById('request-product-img').src = currentRequestProduct.image || '';

  // Populate sizes and colors
  const variants = currentRequestProduct.variants || [];
  const sizes = [...new Set(variants.map(v => v.size))];
  const colors = [...new Set(variants.map(v => v.color))];

  const sizeContainer = document.getElementById('request-size-options');
  if (sizeContainer) {
    sizeContainer.innerHTML = sizes.map((s, idx) => `
      <label class="cursor-pointer">
        <input type="radio" name="req-size" value="${s}" ${idx === 0 ? 'checked' : ''} class="peer sr-only">
        <span class="inline-block px-3.5 py-1.5 rounded-xl border border-[#A3907C]/30 text-xs font-medium peer-checked:bg-[#1F2421] peer-checked:text-[#F5F2EB] peer-checked:border-[#1F2421] transition hover:border-[#1F2421]">${s}</span>
      </label>
    `).join('');
  }

  const colorContainer = document.getElementById('request-color-options');
  if (colorContainer) {
    colorContainer.innerHTML = colors.map((c, idx) => `
      <label class="cursor-pointer">
        <input type="radio" name="req-color" value="${c}" ${idx === 0 ? 'checked' : ''} class="peer sr-only">
        <span class="inline-block px-3.5 py-1.5 rounded-xl border border-[#A3907C]/30 text-xs font-medium peer-checked:bg-[#1F2421] peer-checked:text-[#F5F2EB] peer-checked:border-[#1F2421] transition hover:border-[#1F2421]">${c}</span>
      </label>
    `).join('');
  }

  modal.classList.remove('hidden');
}

function closeRequestModal() {
  const modal = document.getElementById('request-modal');
  if (modal) modal.classList.add('hidden');
}

function recordTriedFittingItem(roomId, item) {
  try {
    const key = 'crwn_fitting_items_' + roomId;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findIndex(i => i.sku === item.sku);
    if (idx === -1) {
      existing.push(item);
      localStorage.setItem(key, JSON.stringify(existing));
    }
  } catch (e) {
    console.warn('Record tried item error:', e);
  }
}

function getTriedFittingItems(roomId) {
  try {
    const key = 'crwn_fitting_items_' + roomId;
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    return [];
  }
}

function clearTriedFittingItems(roomId) {
  try {
    const key = 'crwn_fitting_items_' + roomId;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(e);
  }
}

async function submitItemRequest(roomId) {
  if (!currentRequestProduct) return;

  const size = document.querySelector('input[name="req-size"]:checked')?.value || 'M';
  const color = document.querySelector('input[name="req-color"]:checked')?.value || 'Standard';

  const variants = currentRequestProduct.variants || [];
  const matchedVariant = variants.find(v => v.size === size && v.color === color) || variants[0];
  const sku = matchedVariant ? matchedVariant.sku : `${currentRequestProduct.id}-${size.toLowerCase()}-${color.toLowerCase()}`;

  try {
    const res = await fetch('/api/fitting-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: roomId || '1',
        sku,
        productName: currentRequestProduct.name,
        size,
        color,
      }),
    });

    if (res.ok) {
      // Record item as tried during this session
      recordTriedFittingItem(roomId, {
        sku,
        productId: currentRequestProduct.id,
        name: currentRequestProduct.name,
        price: Number(currentRequestProduct.price),
        color,
        size,
        image: currentRequestProduct.image,
        quantity: 1
      });

      closeRequestModal();
      Cart.showToast(`ส่งคำขอ "${currentRequestProduct.name} (${size}/${color})" ถึงพนักงานแล้ว`);
      if (typeof refreshOrdersStatus === 'function') refreshOrdersStatus();
    } else {
      alert('ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง');
    }
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการส่งคำขอ');
  }
}
