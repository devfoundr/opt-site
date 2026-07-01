/* ============================================================
   Демо-админка: чтение Excel через SheetJS и обновление каталога.
   ============================================================ */

const $ = s => document.querySelector(s);
let parsedCatalog = null;

/* ---------- Тост ---------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Соответствие колонок (рус. синонимы) ---------- */
const COLS = {
  sku:        ["артикул", "sku", "код", "код товара"],
  name:       ["наименование", "название", "товар", "name"],
  category:   ["категория", "группа", "category"],
  price:      ["цена", "цена опт", "оптовая цена", "price"],
  unit:       ["единица", "ед", "ед.изм", "единица измерения", "unit"],
  minOrder:   ["мин.партия", "минпартия", "мин партия", "минимальная партия", "минимум", "min"],
  stock:      ["остаток", "наличие", "склад", "количество", "кол-во", "stock"],
  description:["описание", "описание товара", "description"]
};

function normalize(h) { return String(h || "").trim().toLowerCase().replace(/\s+/g, " "); }

function buildColumnMap(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const n = normalize(h);
    for (const [key, names] of Object.entries(COLS)) {
      if (names.includes(n)) { map[key] = i; break; }
    }
  });
  return map;
}

/* категория: имя -> id (с генерацией id для новых) */
function slug(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "") || "cat";
}
const CAT_ICONS = { "канцелярия":"✏️", "сантехника":"🚿", "бумага":"📒", "бумага и блокноты":"📒", "хозтовары":"🧴" };

/* ---------- Парсинг рабочей книги ---------- */
function parseWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
  if (!rows.length) throw new Error("Файл пустой.");

  const headers = rows[0];
  const map = buildColumnMap(headers);

  const required = ["sku", "name", "category", "price"];
  const missing = required.filter(k => map[k] === undefined);
  if (missing.length) {
    const rusNames = { sku: "Артикул", name: "Наименование", category: "Категория", price: "Цена" };
    throw new Error("Не найдены обязательные колонки: " + missing.map(k => rusNames[k]).join(", ") +
      ". Проверьте заголовки в первой строке.");
  }

  const products = [];
  const catMap = {};   // name(lower) -> {id, name, icon}
  const errors = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const sku = String(row[map.sku] ?? "").trim();
    const name = String(row[map.name] ?? "").trim();
    if (!sku && !name) continue; // пустая строка

    const priceRaw = row[map.price];
    const price = Number(String(priceRaw).replace(/\s/g, "").replace(",", "."));
    if (!sku)  { errors.push(`Строка ${r + 1}: пустой артикул`); continue; }
    if (!name) { errors.push(`Строка ${r + 1}: пустое наименование`); continue; }
    if (!isFinite(price)) { errors.push(`Строка ${r + 1}: некорректная цена «${priceRaw}»`); continue; }

    const catName = String(row[map.category] ?? "Без категории").trim() || "Без категории";
    const catKey = catName.toLowerCase();
    if (!catMap[catKey]) {
      catMap[catKey] = { id: slug(catName), name: catName, icon: CAT_ICONS[catKey] || "📦" };
    }

    const num = (i, def) => {
      if (i === undefined) return def;
      const v = Number(String(row[i]).replace(/\s/g, "").replace(",", "."));
      return isFinite(v) ? v : def;
    };

    products.push({
      sku, name,
      category: catMap[catKey].id,
      price,
      unit: (map.unit !== undefined && String(row[map.unit]).trim()) || "шт.",
      minOrder: Math.max(1, num(map.minOrder, 1)),
      stock: Math.max(0, num(map.stock, 0)),
      description: map.description !== undefined ? String(row[map.description] ?? "").trim() : ""
    });
  }

  if (!products.length) throw new Error("Не удалось прочитать ни одного товара. " + (errors[0] || ""));

  return {
    catalog: { categories: Object.values(catMap), products, updatedAt: null, source: "excel" },
    errors
  };
}

/* ---------- Предпросмотр ---------- */
function showPreview(result) {
  parsedCatalog = result.catalog;
  const products = parsedCatalog.products;

  const head = `<thead><tr>
    <th>Артикул</th><th>Наименование</th><th>Категория</th><th>Цена</th><th>Ед.</th><th>Мин.</th><th>Остаток</th>
  </tr></thead>`;
  const rows = products.slice(0, 12).map(p => `<tr>
    <td>${p.sku}</td><td>${p.name}</td><td>${KT.categoryName(parsedCatalog, p.category)}</td>
    <td>${KT.formatPrice(p.price)}</td><td>${p.unit}</td><td>${p.minOrder}</td><td>${p.stock}</td>
  </tr>`).join("");
  $("#previewTable").innerHTML = head + "<tbody>" + rows + "</tbody>";
  $("#moreRows").textContent = products.length > 12 ? `…и ещё ${products.length - 12} товаров` : "";

  $("#previewInfo").textContent =
    `Товаров: ${products.length} · Категорий: ${parsedCatalog.categories.length}` +
    (result.errors.length ? ` · Пропущено строк: ${result.errors.length}` : "");

  $("#previewBox").style.display = "block";

  if (result.errors.length) {
    setStatus("ok", `Файл прочитан. Внимание: пропущено ${result.errors.length} строк (${result.errors.slice(0,3).join("; ")}${result.errors.length>3?"…":""}). Проверьте предпросмотр и нажмите «Применить».`);
  } else {
    setStatus("ok", "Файл прочитан успешно. Проверьте предпросмотр и нажмите «Применить».");
  }
}

function setStatus(type, msg) {
  const el = $("#status");
  el.className = "status-line " + type;
  el.textContent = msg;
}

/* ---------- Обработка файла ---------- */
function handleFile(file) {
  if (!file) return;
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    setStatus("err", "Нужен файл .xlsx или .xls");
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      const result = parseWorkbook(wb);
      showPreview(result);
    } catch (err) {
      $("#previewBox").style.display = "none";
      setStatus("err", "Ошибка: " + err.message);
    }
  };
  reader.onerror = () => setStatus("err", "Не удалось прочитать файл.");
  reader.readAsArrayBuffer(file);
}

/* ---------- Шаблон прайса ---------- */
function downloadTemplate() {
  const rows = [
    ["Артикул", "Наименование", "Категория", "Цена", "Единица", "Мин.партия", "Остаток", "Описание"],
    ...window.DEFAULT_PRODUCTS.map(p => [
      p.sku, p.name, KT.categoryName({ categories: window.DEFAULT_CATEGORIES }, p.category),
      p.price, p.unit, p.minOrder, p.stock, p.description
    ])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:12},{wch:42},{wch:18},{wch:10},{wch:10},{wch:11},{wch:10},{wch:50}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Прайс");
  XLSX.writeFile(wb, "Шаблон_прайса_ОптСнаб.xlsx");
}

/* ---------- Текущее состояние ---------- */
function refreshCurrent() {
  const c = KT.getCatalog();
  const src = c.source === "excel" ? "загружен из Excel" : "демо-данные";
  $("#currentInfo").innerHTML =
    `Товаров: <b>${c.products.length}</b> · Категорий: <b>${c.categories.length}</b> · Источник: <b>${src}</b>` +
    (c.updatedAt ? ` · Обновлён: ${KT.formatDate(c.updatedAt)}` : "");
}

/* ---------- Инициализация ---------- */
function init() {
  const dz = $("#dropzone"), fi = $("#fileInput");
  dz.onclick = () => fi.click();
  fi.onchange = () => handleFile(fi.files[0]);

  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag"); }));
  dz.addEventListener("drop", e => handleFile(e.dataTransfer.files[0]));

  $("#applyBtn").onclick = () => {
    if (!parsedCatalog) return;
    KT.saveCatalog(parsedCatalog);
    refreshCurrent();
    setStatus("ok", "✓ Каталог обновлён! Откройте магазин, чтобы увидеть новые цены.");
    $("#previewBox").style.display = "none";
    parsedCatalog = null;
    toast("Каталог обновлён");
  };
  $("#cancelBtn").onclick = () => {
    $("#previewBox").style.display = "none";
    $("#status").className = "status-line";
    parsedCatalog = null;
    $("#fileInput").value = "";
  };

  $("#downloadTemplate").onclick = downloadTemplate;
  $("#resetBtn").onclick = () => {
    KT.resetCatalog();
    refreshCurrent();
    setStatus("ok", "Каталог сброшен к демо-данным.");
    toast("Сброшено к демо");
  };

  refreshCurrent();
}

document.addEventListener("DOMContentLoaded", init);
