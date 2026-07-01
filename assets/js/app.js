/* ============================================================
   Логика витрины: каталог, поиск, категории, карточка товара,
   корзина, оптовая заявка.
   ============================================================ */

let CATALOG = KT.getCatalog();
let state = { category: "all", query: "", sort: "default" };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Тост ---------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Категории ---------- */
function renderCategories() {
  const list = $("#catList");
  const total = CATALOG.products.length;
  let html = `<li><button data-cat="all" class="${state.category === "all" ? "active" : ""}">
      <span>🗂️</span> Все товары <span class="count">${total}</span></button></li>`;
  CATALOG.categories.forEach(c => {
    const n = CATALOG.products.filter(p => p.category === c.id).length;
    if (!n) return;
    html += `<li><button data-cat="${c.id}" class="${state.category === c.id ? "active" : ""}">
        <span>${c.icon || "📦"}</span> ${c.name} <span class="count">${n}</span></button></li>`;
  });
  list.innerHTML = html;
  $$("#catList button").forEach(b => b.onclick = () => {
    state.category = b.dataset.cat;
    renderCategories();
    renderGrid();
  });
}

/* ---------- Фильтрация и сортировка ---------- */
function visibleProducts() {
  let items = CATALOG.products.slice();
  if (state.category !== "all") items = items.filter(p => p.category === state.category);
  if (state.query) {
    const q = state.query.toLowerCase();
    items = items.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q));
  }
  switch (state.sort) {
    case "price-asc":  items.sort((a, b) => a.price - b.price); break;
    case "price-desc": items.sort((a, b) => b.price - a.price); break;
    case "name":       items.sort((a, b) => (a.name || "").localeCompare(b.name, "ru")); break;
  }
  return items;
}

/* ---------- Сетка товаров ---------- */
function renderGrid() {
  const grid = $("#grid");
  const items = visibleProducts();

  $("#catTitle").textContent = state.category === "all"
    ? (state.query ? `Результаты поиска` : "Все товары")
    : KT.categoryName(CATALOG, state.category);
  $("#foundCount").textContent = `Найдено: ${items.length}`;

  if (!items.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <div class="big">🔍</div>Ничего не найдено. Попробуйте изменить запрос или категорию.</div>`;
    return;
  }

  const cart = KT.getCart();
  grid.innerHTML = items.map(p => {
    const icon = KT.categoryIcon(CATALOG, p.category);
    const lowStock = p.stock > 0 && p.stock < 50;
    const stockHtml = p.stock > 0
      ? `<span class="stock ${lowStock ? "low" : "in"}">${lowStock ? "Мало на складе" : "В наличии"}</span>`
      : `<span class="stock low">Под заказ</span>`;
    const inCart = cart[p.sku];
    return `
      <div class="card">
        <div class="thumb" data-sku="${p.sku}" role="button">${icon}</div>
        <div class="body">
          <div class="sku">Арт. ${p.sku}</div>
          <div class="name" data-sku="${p.sku}">${p.name}</div>
          <div class="meta">Мин. партия: ${p.minOrder} ${p.unit} · ${stockHtml}</div>
          <div class="price-row">
            <span class="price">${KT.formatPrice(p.price)}</span>
            <span class="unit">/ ${p.unit}</span>
          </div>
          <button class="add-btn ${inCart ? "added" : ""}" data-add="${p.sku}">
            ${inCart ? "✓ В корзине · добавить ещё" : "В корзину"}
          </button>
        </div>
      </div>`;
  }).join("");

  $$("[data-sku]", grid).forEach(el => el.onclick = () => openProduct(el.dataset.sku));
  $$("[data-add]", grid).forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    const p = findProduct(el.dataset.add);
    KT.addToCart(p.sku, p.minOrder);
    refreshCartCount();
    renderGrid();
    toast(`Добавлено: ${p.minOrder} ${p.unit} «${p.name}»`);
  });
}

function findProduct(sku) { return CATALOG.products.find(p => p.sku === sku); }

/* ---------- Карточка товара ---------- */
function openProduct(sku) {
  const p = findProduct(sku);
  if (!p) return;
  const icon = KT.categoryIcon(CATALOG, p.category);
  $("#productModalBody").innerHTML = `
    <div class="product-detail">
      <div class="thumb-lg">${icon}</div>
      <div>
        <div class="sku" style="color:#6b7480;font-size:12.5px">Артикул: ${p.sku}</div>
        <h2>${p.name}</h2>
        <span class="stock ${p.stock > 0 ? "in" : "low"}">${p.stock > 0 ? "В наличии: " + p.stock + " " + p.unit : "Под заказ"}</span>
        <p class="desc">${p.description || ""}</p>
        <dl class="spec">
          <dt>Категория</dt><dd>${KT.categoryName(CATALOG, p.category)}</dd>
          <dt>Цена опт</dt><dd>${KT.formatPrice(p.price)} / ${p.unit}</dd>
          <dt>Мин. партия</dt><dd>${p.minOrder} ${p.unit}</dd>
        </dl>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="qty">
            <button data-q="-">−</button>
            <input id="pQty" type="number" min="${p.minOrder}" step="${p.minOrder}" value="${p.minOrder}">
            <button data-q="+">+</button>
          </div>
          <button class="btn btn-primary" id="pAdd">Добавить в корзину</button>
        </div>
        <div class="muted" style="margin-top:8px">Кратно минимальной партии (${p.minOrder} ${p.unit})</div>
      </div>
    </div>`;

  const qty = $("#pQty");
  $$('[data-q]', $("#productModalBody")).forEach(b => b.onclick = () => {
    let v = parseInt(qty.value) || p.minOrder;
    v += (b.dataset.q === "+" ? 1 : -1) * p.minOrder;
    qty.value = Math.max(p.minOrder, v);
  });
  $("#pAdd").onclick = () => {
    let v = parseInt(qty.value) || p.minOrder;
    if (v < p.minOrder) v = p.minOrder;
    KT.setCartQty(p.sku, (KT.getCart()[p.sku] || 0) + v);
    refreshCartCount();
    renderGrid();
    closeModal("#productModal");
    toast(`Добавлено в корзину: ${v} ${p.unit}`);
  };
  openModal("#productModal");
}

/* ---------- Корзина ---------- */
function renderCart() {
  const cart = KT.getCart();
  const skus = Object.keys(cart);
  const body = $("#cartModalBody");

  if (!skus.length) {
    body.innerHTML = `<div class="empty"><div class="big">🛒</div>Корзина пуста.<br>Добавьте товары из каталога.</div>`;
    return;
  }

  let total = 0, lines = "";
  skus.forEach(sku => {
    const p = findProduct(sku);
    if (!p) return;
    const qty = cart[sku];
    const sum = p.price * qty;
    total += sum;
    const belowMin = qty < p.minOrder;
    lines += `
      <div class="cart-line">
        <div>
          <div class="ci-name">${p.name}</div>
          <div class="ci-sku">Арт. ${p.sku} · ${KT.formatPrice(p.price)} / ${p.unit}</div>
          ${belowMin ? `<div class="min-warn">Меньше мин. партии (${p.minOrder} ${p.unit})</div>` : ""}
        </div>
        <div class="qty">
          <button data-dec="${sku}">−</button>
          <input data-qin="${sku}" type="number" min="0" step="${p.minOrder}" value="${qty}">
          <button data-inc="${sku}">+</button>
        </div>
        <div>
          <div class="ci-sum">${KT.formatPrice(sum)}</div>
          <button class="ci-remove" data-rem="${sku}">удалить</button>
        </div>
      </div>`;
  });

  body.innerHTML = `
    ${lines}
    <div class="cart-total"><span>Итого:</span><span class="sum">${KT.formatPrice(total)}</span></div>
    <div class="muted">Цены оптовые, без НДС. Итоговая стоимость подтверждается менеджером.</div>
    <div class="modal-foot" style="border:none;padding:18px 0 0">
      <button class="btn btn-ghost" id="clearCart">Очистить</button>
      <button class="btn btn-primary" id="toOrder">Оформить заявку</button>
    </div>`;

  $$('[data-inc]', body).forEach(b => b.onclick = () => { const p = findProduct(b.dataset.inc); KT.addToCart(p.sku, p.minOrder); renderCart(); refreshCartCount(); renderGrid(); });
  $$('[data-dec]', body).forEach(b => b.onclick = () => { const p = findProduct(b.dataset.dec); KT.addToCart(p.sku, -p.minOrder); renderCart(); refreshCartCount(); renderGrid(); });
  $$('[data-qin]', body).forEach(inp => inp.onchange = () => { KT.setCartQty(inp.dataset.qin, Math.max(0, parseInt(inp.value) || 0)); renderCart(); refreshCartCount(); renderGrid(); });
  $$('[data-rem]', body).forEach(b => b.onclick = () => { KT.setCartQty(b.dataset.rem, 0); renderCart(); refreshCartCount(); renderGrid(); });
  $("#clearCart").onclick = () => { KT.clearCart(); renderCart(); refreshCartCount(); renderGrid(); };
  $("#toOrder").onclick = () => { closeModal("#cartModal"); openOrder(); };
}

/* ---------- Оптовая заявка ---------- */
function openOrder() {
  const cart = KT.getCart();
  const skus = Object.keys(cart);
  let total = 0;
  skus.forEach(sku => { const p = findProduct(sku); if (p) total += p.price * cart[sku]; });

  $("#orderModalBody").innerHTML = `
    <p class="muted" style="margin-top:0">Позиций в заявке: <b>${skus.length}</b> · Сумма: <b>${KT.formatPrice(total)}</b></p>
    <form id="orderForm">
      <div class="field"><label>Организация / ИП <span class="req">*</span></label><input name="company" required placeholder="ООО «Ромашка»"></div>
      <div class="field"><label>Контактное лицо <span class="req">*</span></label><input name="name" required placeholder="Иван Иванов"></div>
      <div class="field"><label>Телефон <span class="req">*</span></label><input name="phone" required placeholder="+7 (___) ___-__-__"></div>
      <div class="field"><label>E-mail</label><input name="email" type="email" placeholder="zakaz@company.ru"></div>
      <div class="field"><label>Комментарий</label><textarea name="comment" placeholder="Желаемые сроки, адрес доставки, способ оплаты…"></textarea></div>
      <div class="modal-foot" style="border:none;padding:6px 0 0">
        <button type="button" class="btn btn-ghost" data-close>Назад</button>
        <button type="submit" class="btn btn-primary">Отправить заявку</button>
      </div>
    </form>`;

  bindClose($("#orderModalBody"));
  $("#orderForm").onsubmit = (e) => {
    e.preventDefault();
    // Демо: реальной отправки нет. Здесь подключается e-mail/CRM/Telegram.
    $("#orderModalBody").innerHTML = `
      <div class="empty">
        <div class="big">✅</div>
        <h3 style="margin:0 0 6px">Заявка отправлена!</h3>
        <p class="muted">Это демо-версия — данные никуда не уходят.<br>
        В рабочем варианте здесь заявка падает на почту или в CRM/Telegram менеджера.</p>
        <button class="btn btn-primary" data-close style="margin-top:14px">Понятно</button>
      </div>`;
    bindClose($("#orderModalBody"));
    KT.clearCart();
    refreshCartCount();
    renderGrid();
  };
  openModal("#orderModal");
}

/* ---------- Модалки ---------- */
function openModal(sel) { $(sel).classList.add("open"); document.body.style.overflow = "hidden"; }
function closeModal(sel) { $(sel).classList.remove("open"); document.body.style.overflow = ""; }
function bindClose(root) { $$('[data-close]', root).forEach(b => b.onclick = () => $$(".modal-overlay.open").forEach(m => closeModal("#" + m.id))); }

/* ---------- Счётчик корзины ---------- */
function refreshCartCount() { $("#cartCount").textContent = KT.cartCount(); }

/* ---------- Инициализация ---------- */
function init() {
  renderCategories();
  renderGrid();
  refreshCartCount();

  const doSearch = () => { state.query = $("#searchInput").value.trim(); state.category = "all"; renderCategories(); renderGrid(); };
  $("#searchBtn").onclick = doSearch;
  $("#searchInput").addEventListener("input", () => { state.query = $("#searchInput").value.trim(); renderGrid(); });
  $("#searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

  $("#sortSelect").onchange = (e) => { state.sort = e.target.value; renderGrid(); };

  $("#openCart").onclick = () => { renderCart(); openModal("#cartModal"); };

  // Закрытие модалок
  $$(".modal-overlay").forEach(ov => {
    ov.addEventListener("click", e => { if (e.target === ov) closeModal("#" + ov.id); });
    bindClose(ov);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".modal-overlay.open").forEach(m => closeModal("#" + m.id)); });

  // Подсказка про источник данных
  if (CATALOG.source !== "demo" && CATALOG.updatedAt) {
    console.log("Каталог загружен из Excel, обновлён:", KT.formatDate(CATALOG.updatedAt));
  }
}

document.addEventListener("DOMContentLoaded", init);
