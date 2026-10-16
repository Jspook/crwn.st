// ==========================================================
// crwn.st Global Client Application Utilities
// ==========================================================

// Debounce helper to prevent excessive function/API calls
function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
window.debounce = debounce;

async function handleLogout() {
  try {
    // Push the current cart to the server (awaited) so it persists across logout.
    try {
      // Cart is a top-level const in cart.js (not on window), so resolve the global first.
      const cart = (typeof Cart !== 'undefined') ? Cart : window.Cart;
      if (cart) {
        if (typeof cart.loadFromStorage === 'function') cart.loadFromStorage();
        if (Array.isArray(cart.items) && cart.items.length > 0) {
          await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart.items })
          });
        }
      }
    } catch (e) {}
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('crwn_cart') || k.startsWith('crwn_fitting'))) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    console.error(e);
  }
  window.location.href = '/';
}

// Room Scanner Modal (Scan QR or Manual Code)
function openRoomModal() {
  const modal = document.getElementById('room-modal');
  const errBox = document.getElementById('room-modal-error');
  if (errBox) errBox.classList.add('hidden');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    document.documentElement.classList.add('overflow-hidden');
    // Attempt auto-start camera for convenience
    toggleRoomQrCamera(true);
    const manualInput = document.getElementById('room-manual-code-input');
    if (manualInput) manualInput.value = '';
  }
}

function submitManualRoomCode() {
  const input = document.getElementById('room-manual-code-input');
  let val = (input?.value || '').trim();
  if (!val) {
    showRoomModalError('กรุณากรอกรหัส QR Code หน้าห้องลอง');
    return;
  }
  if (val.includes('roomId=')) {
    const m = val.match(/roomId=([^&]+)/);
    if (m) val = decodeURIComponent(m[1]).trim();
  }
  selectRoom(val);
}


function closeRoomModal() {
  const modal = document.getElementById('room-modal');
  if (modal) modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  document.documentElement.classList.remove('overflow-hidden');
  stopRoomQrCamera();
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("BrowserDoesNotSupport");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    roomQrStream = stream;
    if (video) {
      video.srcObject = stream;
      video.classList.remove('hidden');
      
      // Explicit play is required on iOS Safari
      video.play().catch(e => console.warn('iOS Play Warning:', e));
    }
    if (offState) offState.classList.add('hidden');
    if (beam) beam.classList.remove('hidden');
    if (label) label.textContent = 'ปิดกล้อง';

    // Start scanning barcodes if supported
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39'] });
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
    let errMsg = 'ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง หรือใช้ปุ่มจำลองการสแกน';
    if (err.message === "BrowserDoesNotSupport" || err.name === "NotAllowedError" || err.name === "TypeError") {
      errMsg = 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ (แนะนำให้เปิดผ่านเบราว์เซอร์หลัก Safari/Chrome แทนแอปแชท) หรือคุณยังไม่ได้อนุญาตการเข้าถึงกล้อง';
    }
    showRoomModalError(errMsg + ' (' + err.message + ')');
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
  let code = String(raw).trim();
  if (code.includes('roomId=')) {
    const m = code.match(/roomId=([^&]+)/);
    if (m) code = decodeURIComponent(m[1]);
  }
  selectRoom(code);
}

function showRoomModalError(message) {
  const errBox = document.getElementById('room-modal-error');
  const errText = document.getElementById('room-modal-error-text');
  const manualErr = document.getElementById('room-manual-error');
  const manualErrText = document.getElementById('room-manual-error-text');

  if (errBox && errText) {
    errText.textContent = message;
    errBox.classList.remove('hidden');
  }
  if (manualErr && manualErrText) {
    manualErrText.textContent = message;
    manualErr.classList.remove('hidden');
  }
  if (!errBox && !manualErr) {
    alert(message);
  }
  if (window.lucide) window.lucide.createIcons();
}

async function selectRoom(roomNum) {
  const cleanNum = String(roomNum || '').trim();
  if (!cleanNum) {
    showRoomModalError('กรุณาระบุหมายเลขห้องลอง');
    return;
  }

  const errBox = document.getElementById('room-modal-error');
  const manualErr = document.getElementById('room-manual-error');
  if (errBox) errBox.classList.add('hidden');
  if (manualErr) manualErr.classList.add('hidden');

  const btn = document.getElementById('btn-submit-room-code');
  const originalBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span> กำลังเข้า...';
  }

  try {
    stopRoomQrCamera();

    // Call /enter to atomically lock or resume room
    const enterRes = await fetch(`/api/fitting-rooms/${encodeURIComponent(cleanNum)}/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const enterData = await enterRes.json();

    if (!enterRes.ok) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
      }
      if (enterRes.status === 403) {
        showRoomModalError(enterData.error || 'กรุณาเข้าสู่ระบบก่อนสแกน QR Code');
      } else if (enterRes.status === 409) {
        showRoomModalError(enterData.error || 'ห้องลองนี้มีลูกค้าท่านอื่นใช้งานอยู่ กรุณารอสักครู่');
      } else {
        showRoomModalError(enterData.error || 'รหัสห้องลองไม่ถูกต้อง กรุณาสแกนหรือกรอกรหัส QR หน้าห้องลองเสื้อผ้า');
      }
      return;
    }

    const finalRoomId = enterData.roomId || cleanNum;
    if (enterData.sessionId) {
      window.currentSessionId = enterData.sessionId;
      localStorage.setItem('crwn_active_session_' + finalRoomId, enterData.sessionId);
    }

    document.body.classList.remove('overflow-hidden');
    document.documentElement.classList.remove('overflow-hidden');
    window.location.href = `/customer/fitting-room?roomId=${encodeURIComponent(finalRoomId)}`;
  } catch (e) {
    console.error('Error selecting room:', e);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
    showRoomModalError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
  }
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
        <img src="${product.image || '/images/products/p1.webp'}" alt="${product.name}" class="w-20 h-20 rounded-xl object-cover bg-[#E8DFD1]">
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

  // Populate sizes and dynamically filter available colors
  const variants = currentRequestProduct.variants || [];
  const sizes = [...new Set(variants.map(v => v.size))];

  const sizeContainer = document.getElementById('request-size-options');
  const colorContainer = document.getElementById('request-color-options');

  function renderColorOptions(selectedSize) {
    if (!colorContainer) return;
    const availableColors = [...new Set(variants.filter(v => !selectedSize || v.size === selectedSize).map(v => v.color))];
    const colorsToRender = availableColors.length > 0 ? availableColors : [...new Set(variants.map(v => v.color))];
    colorContainer.innerHTML = colorsToRender.map((c, idx) => `
      <label class="cursor-pointer">
        <input type="radio" name="req-color" value="${c}" ${idx === 0 ? 'checked' : ''} class="peer sr-only">
        <span class="inline-block px-3.5 py-1.5 rounded-xl border border-[#A3907C]/30 text-xs font-medium peer-checked:bg-[#1F2421] peer-checked:text-[#F5F2EB] peer-checked:border-[#1F2421] transition hover:border-[#1F2421]">${c}</span>
      </label>
    `).join('');
  }

  if (sizeContainer) {
    sizeContainer.innerHTML = sizes.map((s, idx) => `
      <label class="cursor-pointer">
        <input type="radio" name="req-size" value="${s}" ${idx === 0 ? 'checked' : ''} class="peer sr-only">
        <span class="inline-block px-3.5 py-1.5 rounded-xl border border-[#A3907C]/30 text-xs font-medium peer-checked:bg-[#1F2421] peer-checked:text-[#F5F2EB] peer-checked:border-[#1F2421] transition hover:border-[#1F2421]">${s}</span>
      </label>
    `).join('');

    sizeContainer.querySelectorAll('input[name="req-size"]').forEach(input => {
      input.addEventListener('change', (e) => {
        renderColorOptions(e.target.value);
      });
    });
  }

  renderColorOptions(sizes[0] || null);

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

  const sizeInput = document.querySelector('input[name="req-size"]:checked');
  const colorInput = document.querySelector('input[name="req-color"]:checked');
  const size = sizeInput ? sizeInput.value : '';
  const color = colorInput ? colorInput.value : '';

  const variants = currentRequestProduct.variants || [];
  const matchedVariant = variants.find(v => v.size === size && v.color === color);
  if (!matchedVariant) {
    const errorMsg = 'ขออภัย ไม่พบตัวเลือกขนาดและสีนี้ในระบบ กรุณาเลือกตัวเลือกอื่น';
    if (typeof Cart !== 'undefined' && Cart.showToast) {
      Cart.showToast(errorMsg);
    } else {
      alert(errorMsg);
    }
    return;
  }
  const sku = matchedVariant.sku;

  const submitBtn = document.querySelector('#request-modal button.btn-primary');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span> กำลังส่งคำขอ...`;
  }

  try {
    const res = await fetch('/api/fitting-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: roomId || '1',
        sessionId: typeof currentSessionId !== 'undefined' ? currentSessionId : (window.currentSessionId || undefined),
        sku,
        productName: currentRequestProduct.name,
        size: matchedVariant.size,
        color: matchedVariant.color,
      }),
    });

    if (res.ok) {
      const newOrder = await res.json();
      if (newOrder && newOrder.sessionId) {
        window.currentSessionId = newOrder.sessionId;
        if (typeof currentRoomId !== 'undefined') {
          localStorage.setItem('crwn_active_session_' + currentRoomId, newOrder.sessionId);
        }
      }

      // Record item as tried during this session
      recordTriedFittingItem(roomId, {
        sku: newOrder?.sku || sku,
        productId: currentRequestProduct.id,
        name: currentRequestProduct.name,
        price: Number(currentRequestProduct.price),
        color: matchedVariant.color,
        size: matchedVariant.size,
        image: currentRequestProduct.image,
        quantity: 1
      });

      closeRequestModal();
      Cart.showToast(`ส่งคำขอ "${currentRequestProduct.name} (${matchedVariant.size}/${matchedVariant.color})" ถึงพนักงานเรียบร้อยแล้ว`);
      
      if (typeof window.addOptimisticFittingOrder === 'function') {
        window.addOptimisticFittingOrder(newOrder || {
          id: 'fo_' + Date.now(),
          productName: currentRequestProduct.name,
          size,
          color,
          image: currentRequestProduct.image,
          status: 'pending'
        });
      }
      if (typeof refreshOrdersStatus === 'function') {
        setTimeout(refreshOrdersStatus, 300);
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData.error && errData.error.message) || errData.error || 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่อีกครั้ง';
      if (typeof Cart !== 'undefined' && Cart.showToast) {
        Cart.showToast(msg);
      } else {
        alert(msg);
      }
    }
  } catch (err) {
    console.error('Submit item request error:', err);
    if (typeof Cart !== 'undefined' && Cart.showToast) {
      Cart.showToast('เกิดข้อผิดพลาดในการส่งคำขอ');
    } else {
      alert('เกิดข้อผิดพลาดในการส่งคำขอ');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i> ส่งคำขอถึงพนักงาน`;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}
