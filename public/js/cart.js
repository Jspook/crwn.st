// ==========================================================
// crwn.st Client-side Cart & State Manager
// Rock-solid persistence via localStorage + Background API Sync
// ==========================================================

const Cart = {
  items: [],

  getUserKey() {
    try {
      if (window.currentUser && window.currentUser.id) {
        return window.currentUser.id;
      }
      const match = document.cookie.match(/crwn_auth=([^;]+)/);
      if (match) {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        if (parsed && parsed.id) return parsed.id;
      }
    } catch (e) {}
    return 'guest';
  },

  getStorageKey() {
    return 'crwn_cart_' + this.getUserKey();
  },

  loadFromStorage() {
    try {
      const key = this.getStorageKey();
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.items = parsed;
          return;
        }
      }
      this.items = [];
    } catch (e) {
      console.warn('Failed to read cart from localStorage:', e);
      this.items = [];
    }
  },

  saveToStorage() {
    try {
      const key = this.getStorageKey();
      localStorage.setItem(key, JSON.stringify(this.items));
    } catch (e) {
      console.warn('Failed to save cart to localStorage:', e);
    }
  },

  async init() {
    // 1. Immediately load cart keyed specifically to this user (empty if brand-new user)
    this.loadFromStorage();
    this.updateUI();

    // 2. Fetch server cart for the active user (server authoritative)
    try {
      const res = await fetch('/api/cart');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          // If server has cart, use it; otherwise if user has local items for their key, sync them
          if (data.items.length > 0) {
            this.items = data.items;
            this.saveToStorage();
            this.updateUI();
          } else if (this.items.length > 0) {
            this.syncBackend();
          }
        }
      }
    } catch (err) {
      // Ignore background fetch error
    }
  },

  async syncBackend() {
    this.saveToStorage();
    this.updateUI();
    window.dispatchEvent(new CustomEvent('crwn:cart-updated', { detail: { items: this.items } }));

    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: this.items }),
      });
    } catch (err) {
      console.warn('Cart backend sync skipped:', err);
    }
  },

  async addItem(item) {
    this.loadFromStorage(); // Always ensure latest items loaded

    const existing = this.items.find(i => i.sku === item.sku);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      this.items.push({
        sku: item.sku,
        productId: item.productId || item.id,
        name: item.name,
        color: item.color || 'Standard',
        size: item.size || 'M',
        price: Number(item.price),
        image: item.image || '',
        quantity: 1,
      });
    }
    await this.syncBackend();
    this.openDrawer();
    this.showToast(`เพิ่ม "${item.name}" ลงในตะกร้าแล้ว`);
  },

  async updateQuantity(sku, delta) {
    this.loadFromStorage();
    const idx = this.items.findIndex(i => i.sku === sku);
    if (idx === -1) return;
    this.items[idx].quantity += delta;
    if (this.items[idx].quantity <= 0) {
      this.items.splice(idx, 1);
    }
    await this.syncBackend();
  },

  async removeItem(sku) {
    this.loadFromStorage();
    this.items = this.items.filter(i => i.sku !== sku);
    await this.syncBackend();
  },

  async clear() {
    this.items = [];
    localStorage.removeItem(this.getStorageKey());
    localStorage.removeItem('crwn_cart');
    this.updateUI();
    window.dispatchEvent(new CustomEvent('crwn:cart-updated', { detail: { items: [] } }));
    try {
      await fetch('/api/cart', { method: 'DELETE' });
    } catch (e) {
      console.warn('Clear backend cart failed:', e);
    }
  },

  getTotal() {
    this.loadFromStorage();
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getCount() {
    this.loadFromStorage();
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  updateUI() {
    this.loadFromStorage();
    const count = this.getCount();

    // 1. Update badges in navbars / headers across pages
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(b => {
      b.textContent = count;
      if (count > 0) {
        b.style.display = 'inline-flex';
        b.classList.remove('hidden');
      } else {
        b.style.display = 'none';
        b.classList.add('hidden');
      }
    });

    // 2. Update Drawer content if present
    const list = document.getElementById('cart-items-list');
    const totalEl = document.getElementById('cart-total-amount');
    const emptyState = document.getElementById('cart-empty-state');
    const footer = document.getElementById('cart-drawer-footer');

    if (!list) return;

    if (this.items.length === 0) {
      list.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (footer) footer.style.display = 'none';
      if (totalEl) totalEl.textContent = '฿0.00';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (footer) footer.style.display = 'block';

    list.innerHTML = this.items.map(item => `
      <div class="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#A3907C]/20 shadow-xs transition">
        <div class="w-14 h-14 rounded-xl bg-[#E8DFD1]/50 flex-shrink-0 overflow-hidden relative">
          ${item.image ? `<img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-[#A3907C]"><i data-lucide="shirt" class="w-5 h-5"></i></div>`}
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-medium text-xs sm:text-sm text-[#1F2421] truncate">${item.name}</h4>
          <p class="text-[11px] text-[#8A8177] mt-0.5">ไซส์: <span class="font-semibold text-[#1F2421]">${item.size}</span> · สี: <span class="font-semibold text-[#1F2421]">${item.color}</span></p>
          <div class="flex items-center justify-between mt-1.5">
            <span class="font-semibold text-xs sm:text-sm text-[#1F2421]">฿${(item.price * item.quantity).toLocaleString()}</span>
            <div class="flex items-center border border-[#A3907C]/30 rounded-full bg-[#F5F2EB] px-2 py-0.5 gap-2">
              <button onclick="Cart.updateQuantity('${item.sku}', -1)" class="text-[#8A8177] hover:text-[#1F2421] font-bold text-xs p-1" aria-label="Decrease">-</button>
              <span class="text-xs font-bold px-1 text-[#1F2421]">${item.quantity}</span>
              <button onclick="Cart.updateQuantity('${item.sku}', 1)" class="text-[#8A8177] hover:text-[#1F2421] font-bold text-xs p-1" aria-label="Increase">+</button>
            </div>
          </div>
        </div>
        <button onclick="Cart.removeItem('${item.sku}')" class="p-2 text-[#8A8177] hover:text-red-600 rounded-full transition" title="ลบออก" aria-label="Remove item">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `).join('');

    if (totalEl) {
      totalEl.textContent = '฿' + this.getTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  openDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if (drawer) {
      drawer.classList.remove('translate-x-full');
      if (overlay) overlay.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      document.documentElement.classList.add('overflow-hidden');
      this.updateUI();
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if (drawer) {
      drawer.classList.add('translate-x-full');
      if (overlay) overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
      document.documentElement.classList.remove('overflow-hidden');
    }
  },

  showToast(msg) {
    let toast = document.getElementById('crwn-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'crwn-toast';
      toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full bg-[#1F2421] text-[#F5F2EB] text-xs sm:text-sm font-medium shadow-2xl z-50 transition-all duration-300 transform opacity-0 pointer-events-none flex items-center gap-2 max-w-[90vw] truncate';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-[#9BAF9F] flex-shrink-0"></i> <span class="truncate">${msg}</span>`;
    if (window.lucide) window.lucide.createIcons();
    toast.classList.remove('opacity-0', 'translate-y-2');
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
    }, 2500);
  }
};

// Immediate synchronous load
Cart.loadFromStorage();

document.addEventListener('DOMContentLoaded', () => {
  Cart.init();

  // Handle escape key to close drawer and unlock scroll
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      Cart.closeDrawer();
    }
  });

  // Restore scroll on page leave
  window.addEventListener('beforeunload', () => {
    document.body.classList.remove('overflow-hidden');
    document.documentElement.classList.remove('overflow-hidden');
  });
});

// Cross-tab / cross-window sync
window.addEventListener('storage', (e) => {
  if (e.key === 'crwn_cart') {
    Cart.loadFromStorage();
    Cart.updateUI();
  }
});
