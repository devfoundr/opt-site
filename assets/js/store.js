/* ============================================================
   Общий слой данных. Используется и витриной, и админкой.
   Каталог хранится в localStorage. Если его там нет —
   берутся демо-данные из data.js.
   ============================================================ */

const KT = {
  CATALOG_KEY: "kt_catalog_v1",
  CART_KEY: "kt_cart_v1",

  /* ---------- Каталог ---------- */
  getCatalog() {
    const raw = localStorage.getItem(this.CATALOG_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* упадём на дефолт */ }
    }
    return {
      categories: window.DEFAULT_CATEGORIES,
      products: window.DEFAULT_PRODUCTS,
      updatedAt: null,
      source: "demo"
    };
  },

  saveCatalog(catalog) {
    catalog.updatedAt = new Date().toISOString();
    localStorage.setItem(this.CATALOG_KEY, JSON.stringify(catalog));
  },

  resetCatalog() {
    localStorage.removeItem(this.CATALOG_KEY);
  },

  categoryName(catalog, id) {
    const c = (catalog.categories || []).find(c => c.id === id);
    return c ? c.name : id;
  },

  categoryIcon(catalog, id) {
    const c = (catalog.categories || []).find(c => c.id === id);
    return c && c.icon ? c.icon : "📦";
  },

  /* ---------- Корзина ---------- */
  getCart() {
    try { return JSON.parse(localStorage.getItem(this.CART_KEY)) || {}; }
    catch (e) { return {}; }
  },

  saveCart(cart) {
    localStorage.setItem(this.CART_KEY, JSON.stringify(cart));
  },

  cartCount() {
    const cart = this.getCart();
    return Object.values(cart).reduce((s, n) => s + n, 0);
  },

  addToCart(sku, qty) {
    const cart = this.getCart();
    cart[sku] = (cart[sku] || 0) + qty;
    if (cart[sku] <= 0) delete cart[sku];
    this.saveCart(cart);
  },

  setCartQty(sku, qty) {
    const cart = this.getCart();
    if (qty <= 0) delete cart[sku];
    else cart[sku] = qty;
    this.saveCart(cart);
  },

  clearCart() {
    localStorage.removeItem(this.CART_KEY);
  },

  /* ---------- Утилиты ---------- */
  formatPrice(n) {
    return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
  },

  formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
};
