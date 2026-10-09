/* BIZIBOIZ Corteiz-type shop — cart, filters, product sheet */
(() => {
  const root = document.querySelector(".ftw-shop");
  if (!root) return;

  const moneyFormat = root.dataset.moneyFormat || "{{amount}}";
  const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  let selectedVariantId = null;
  let sheetOpen = false;
  let sheetVariants = [];
  let sheetOptionDefs = [];
  let sheetSelectedOptions = [];
  let sheetImages = [];
  let sheetImageIndex = 0;
  let sheetAvailable = true;

  const THEME_KEY = "ftw-theme";

  function getTheme() {
    const t = document.documentElement.getAttribute("data-ftw-theme");
    return t === "dark" ? "dark" : "light";
  }

  function syncThemeButton(theme) {
    const btn = $("#ftw-theme-btn");
    if (!btn) return;
    const isDark = theme === "dark";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }

  function setTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-ftw-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_) {}
    syncThemeButton(next);
  }

  syncThemeButton(getTheme());

  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    $("#toast-body").textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-on"), 2200);
  }

  function formatMoney(cents) {
    if (window.Shopify && typeof Shopify.formatMoney === "function") {
      return Shopify.formatMoney(cents, moneyFormat);
    }
    return (Number(cents) / 100).toFixed(0) + " Kč";
  }

  function updateTrayCart(count) {
    const el = $("#cart-count");
    if (el) el.textContent = String(count ?? 0);
  }

  async function fetchCart() {
    const res = await fetch("/cart.js", { headers: { Accept: "application/json" } });
    return res.json();
  }

  async function changeCartLine(key, quantity) {
    if (!key) return false;
    const qty = Math.max(0, Number(quantity) || 0);

    if (isLocal) {
      toast(qty === 0 ? "REMOVED." : "CART UPDATED.");
      return true;
    }

    try {
      const res = await fetch("/cart/change.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: key, quantity: qty }),
      });
      if (!res.ok) throw new Error("change failed");
      await renderCart();
      if (qty === 0) toast("REMOVED.");
      return true;
    } catch {
      toast("COULDN'T UPDATE CART.");
      return false;
    }
  }

  function cartImageUrl(item) {
    const raw =
      item?.image ||
      item?.featured_image?.url ||
      item?.featured_image ||
      "";
    if (!raw || typeof raw !== "string") return "";
    if (raw.startsWith("//")) return `https:${raw}`;
    return raw;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getUpsellPool() {
    const raw = $("#ftw-upsell-data")?.textContent;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed.filter((p) => p && p.variantId);
      } catch (_) {}
    }
    return $$(".ftw-product", root)
      .filter((card) => card.dataset.available !== "0")
      .map((card) => ({
        id: Number(card.dataset.productId) || 0,
        handle: card.dataset.product || "",
        title: card.dataset.title || "",
        price: card.dataset.price || "",
        image: card.dataset.image || "",
        variantId: Number(card.dataset.variantId),
        available: true,
      }))
      .filter((p) => p.variantId);
  }

  function renderUpsell(cart) {
    const host = $("#cart-upsell");
    if (!host) return;
    const limit = Math.max(1, Number(root.dataset.upsellLimit || 2));
    const heading = (root.dataset.upsellHeading || "ADD THIS TOO").toUpperCase();
    const inCartIds = new Set((cart.items || []).map((i) => Number(i.product_id)));
    const inCartHandles = new Set((cart.items || []).map((i) => i.handle).filter(Boolean));
    const picks = getUpsellPool()
      .filter((p) => {
        if (p.available === false) return false;
        if (p.id && inCartIds.has(Number(p.id))) return false;
        if (p.handle && inCartHandles.has(p.handle)) return false;
        return true;
      })
      .slice(0, limit);

    if (!picks.length) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }

    host.hidden = false;
    host.innerHTML = `
      <div class="ftw-upsell__head">${escapeHtml(heading)}</div>
      <div class="ftw-upsell__list">
        ${picks
          .map(
            (p) => `<div class="ftw-upsell__item">
            <div class="ftw-upsell__media">
              ${
                p.image
                  ? `<img src="${escapeHtml(p.image)}" alt="" width="56" height="56" loading="lazy">`
                  : ""
              }
            </div>
            <div class="ftw-upsell__meta">
              <div class="ftw-upsell__title">${escapeHtml(p.title)}</div>
              <div class="ftw-upsell__price">${escapeHtml(p.price)}</div>
            </div>
            <button type="button" class="ftw-upsell__add" data-upsell-add="${p.variantId}">+</button>
          </div>`
          )
          .join("")}
      </div>`;
  }

  async function renderCart() {
    const body = $("#cart-body");
    const footer = $("#cart-footer");
    const upsell = $("#cart-upsell");
    if (!body) return;
    try {
      const cart = await fetchCart();
      updateTrayCart(cart.item_count);
      if (!cart.item_count) {
        body.innerHTML = `<div class="ftw-empty">CART EMPTY.</div>`;
        if (footer) {
          footer.hidden = true;
          footer.innerHTML = "";
        }
        if (upsell) {
          upsell.hidden = true;
          upsell.innerHTML = "";
        }
        return;
      }
      const lines = cart.items
        .map((i) => {
          const title = escapeHtml(i.product_title || i.title || "Item");
          const variant =
            i.variant_title && i.variant_title !== "Default Title"
              ? ` — ${escapeHtml(i.variant_title)}`
              : "";
          const img = cartImageUrl(i);
          const media = img
            ? `<img src="${escapeHtml(img)}" alt="" width="64" height="64" loading="lazy">`
            : "";
          const key = escapeHtml(i.key || String(i.id));
          const qty = Number(i.quantity) || 1;
          return `<div class="ftw-cart-line" data-cart-key="${key}">
            <div class="ftw-cart-line__media">${media}</div>
            <div class="ftw-cart-line__meta">
              <div class="ftw-cart-line__title">${title}${variant}</div>
              <div class="ftw-cart-line__controls">
                <div class="ftw-cart-qty" role="group" aria-label="Quantity">
                  <button type="button" class="ftw-cart-qty__btn" data-cart-qty="${qty - 1}" data-cart-key="${key}" aria-label="Decrease quantity">−</button>
                  <span class="ftw-cart-qty__val">${qty}</span>
                  <button type="button" class="ftw-cart-qty__btn" data-cart-qty="${qty + 1}" data-cart-key="${key}" aria-label="Increase quantity">+</button>
                </div>
                <button type="button" class="ftw-cart-line__remove" data-cart-qty="0" data-cart-key="${key}">REMOVE</button>
              </div>
            </div>
            <div class="ftw-cart-line__price">${formatMoney(i.final_line_price)}</div>
          </div>`;
        })
        .join("");
      body.innerHTML = `<div class="ftw-cart-lines">${lines}</div>`;
      renderUpsell(cart);
      if (footer) {
        footer.hidden = false;
        footer.innerHTML = `
          <strong>TOTAL: ${formatMoney(cart.total_price)}</strong>
          <a class="ftw-btn ftw-btn--primary" href="/checkout">CHECKOUT</a>`;
      }
    } catch {
      body.innerHTML = `<div class="ftw-empty">Couldn't load cart.</div>`;
      if (footer) {
        footer.hidden = true;
        footer.innerHTML = "";
      }
      if (upsell) {
        upsell.hidden = true;
        upsell.innerHTML = "";
      }
    }
  }

  function openDrawer(id) {
    closeSheet(true);
    $$(".ftw-drawer", root).forEach((d) => {
      d.hidden = d.id !== id;
    });
    $("#ftw-bag-btn")?.setAttribute("aria-expanded", String(id === "ftw-bag"));
    $("#ftw-account-btn")?.setAttribute("aria-expanded", String(id === "ftw-account"));
    if (id === "ftw-bag") renderCart();
  }

  function closeDrawers() {
    $$(".ftw-drawer", root).forEach((d) => {
      d.hidden = true;
    });
    $("#ftw-bag-btn")?.setAttribute("aria-expanded", "false");
    $("#ftw-account-btn")?.setAttribute("aria-expanded", "false");
  }

  function setTab(id) {
    $$("[data-ftw-tab]", root).forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.ftwTab === id);
    });
    $$("[data-ftw-panel]", root).forEach((panel) => {
      const on = panel.dataset.ftwPanel === id;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
  }

  function setNavOpen(open) {
    root.classList.toggle("is-nav-open", open);
    const scrim = $("#ftw-nav-scrim");
    if (scrim) scrim.hidden = !open;
  }

  let activeFilter = "all";
  let searchQuery = "";

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function productCollections(card) {
    return String(card.dataset.collections || "")
      .split(",")
      .map((s) => normalize(s.trim()))
      .filter(Boolean);
  }

  const FILTER_ALIASES = {
    "hoodies-sweatshirts": ["hoodies", "hoodies-sweat", "sweatshirts"],
    hoodies: ["hoodies-sweatshirts", "hoodies-sweat", "sweatshirts"],
    "t-shirts": ["t-shirt", "tees", "tee"],
    hats: ["hat", "caps", "cap", "beanies"],
    bottoms: ["bottom", "shorts", "pants"],
    jackets: ["jacket", "shells"],
    accessories: ["accessory", "bags", "bag"],
  };

  const FILTER_TITLE_HINTS = {
    "t-shirts": ["t-shirt", "tee", "tshirt"],
    "hoodies-sweatshirts": ["hoodie", "sweat", "crew"],
    hoodies: ["hoodie", "sweat", "crew"],
    hats: ["hat", "cap", "beanie", "trucker"],
    bottoms: ["short", "pant", "bottom", "track"],
    jackets: ["jacket", "shell", "zip"],
    womens: ["bikini", "women"],
    lifestyle: ["towel", "lifestyle"],
    accessories: ["bag", "tote", "accessory"],
  };

  function matchesCategory(cols, title, active) {
    if (cols.includes(active)) return true;
    const alts = FILTER_ALIASES[active] || [];
    if (alts.some((a) => cols.includes(a))) return true;
    if (cols.some((c) => c === active || c.startsWith(active + "-") || active.startsWith(c + "-"))) {
      return true;
    }
    const hints = FILTER_TITLE_HINTS[active] || [active.replace(/-/g, " ")];
    return hints.some((h) => title.includes(h));
  }

  function applyFilters() {
    const q = searchQuery.trim().toLowerCase();
    const active = normalize(activeFilter);
    let visible = 0;
    $$(".ftw-product", root).forEach((card) => {
      const drop = card.dataset.drop || "new";
      const cols = productCollections(card);
      const title = (card.dataset.title || card.textContent || "").toLowerCase();
      let show = true;

      if (active === "archive") {
        show = drop === "archive";
      } else if (active === "all" || active === "new") {
        show = drop !== "archive";
      } else {
        show = matchesCategory(cols, title, active);
      }

      if (show && q) show = title.includes(q);
      card.classList.toggle("is-filtered-out", !show);
      if (show) visible += 1;
    });

    const grid = $("#ftw-grid", root);
    if (!grid) return;
    let empty = $("#ftw-filter-empty", root);
    if (!visible) {
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "ftw-empty";
        empty.id = "ftw-filter-empty";
        grid.appendChild(empty);
      }
      empty.hidden = false;
      empty.textContent = q
        ? "NO MATCHES."
        : "NO PRODUCTS IN THIS COLLECTION. Connect it in the theme editor.";
    } else if (empty) {
      empty.hidden = true;
    }
  }

  function setFilter(key) {
    activeFilter = key || "all";
    $$("[data-ftw-filter]", root).forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.ftwFilter === activeFilter);
    });
    applyFilters();
    setNavOpen(false);
  }

  function parseVariants(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function parseImages(raw, fallback) {
    const list = parseVariants(raw).filter((x) => typeof x === "string" && x);
    if (list.length) return list;
    return fallback ? [fallback] : [];
  }

  function descLines(desc) {
    const clean = String(desc || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return ["LIMITED DROP", "NO RESTOCKS", "FOR THE WIN"];
    const parts = clean
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
    return parts.length ? parts.map((p) => p.toUpperCase()) : [clean.toUpperCase()];
  }

  function syncAddButton() {
    const btn = $("#ftw-sheet-add");
    if (!btn) return;
    if (!sheetAvailable) {
      btn.textContent = "SOLD OUT";
      btn.disabled = true;
      return;
    }
    btn.textContent = "ADD TO CART";
    btn.disabled = !selectedVariantId;
  }

  function buildStack(title) {
    const stage = $("#ftw-sheet-stack");
    if (!stage) return;
    stage.innerHTML = "";
    const imgs = sheetImages.length ? sheetImages : [];
    imgs.forEach((src, n) => {
      const shot = document.createElement("div");
      shot.className = "ftw-sheet__shot";
      shot.dataset.imageIndex = String(n);
      shot.innerHTML = `<img src="${src}" alt="${title || ""}" width="1200" height="1200" loading="${n === 0 ? "eager" : "lazy"}">`;
      stage.appendChild(shot);
    });
  }

  function parseOptions(raw) {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function variantOptionValues(v) {
    if (Array.isArray(v.options) && v.options.length) return v.options.map(String);
    if (v.title && v.title !== "Default Title") {
      return String(v.title)
        .split(" / ")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  function inferOptionDefs(variants) {
    const names = ["Option 1", "Option 2", "Option 3"];
    const buckets = [[], [], []];
    variants.forEach((v) => {
      variantOptionValues(v).forEach((val, i) => {
        if (i < 3 && val && !buckets[i].includes(val)) buckets[i].push(val);
      });
    });
    return buckets
      .map((values, i) => ({ name: names[i], values }))
      .filter((o) => o.values.length);
  }

  function findMatchingVariant() {
    return (
      sheetVariants.find((v) => {
        const opts = variantOptionValues(v);
        if (!sheetSelectedOptions.length) return false;
        return sheetSelectedOptions.every((val, i) => opts[i] === val);
      }) || null
    );
  }

  function optionHasAnyVariant(index, value, draft) {
    const probe = draft.slice();
    probe[index] = value;
    return sheetVariants.some((v) => {
      const opts = variantOptionValues(v);
      return probe.every((val, i) => val == null || val === "" || opts[i] === val);
    });
  }

  function syncVariantFromOptions() {
    const match = findMatchingVariant();
    selectedVariantId = match ? match.id : null;
    if (match?.price) $("#ftw-sheet-price").textContent = match.price;

    const btn = $("#ftw-sheet-add");
    if (!btn) return;
    if (!match) {
      btn.textContent = "UNAVAILABLE";
      btn.disabled = true;
      return;
    }
    if (!match.available) {
      btn.textContent = "SOLD OUT";
      btn.disabled = true;
      return;
    }
    sheetAvailable = true;
    syncAddButton();
  }

  function buildSizes(card) {
    const host = $("#ftw-sheet-sizes");
    host.innerHTML = "";
    selectedVariantId = null;
    sheetOptionDefs = parseOptions(card.dataset.options);
    if (!sheetOptionDefs.length) sheetOptionDefs = inferOptionDefs(sheetVariants);

    const hasRealOptions = sheetOptionDefs.some((o) => o.values && o.values.length);
    const onlyDefault =
      sheetVariants.length <= 1 &&
      (!sheetVariants[0] || !sheetVariants[0].title || sheetVariants[0].title === "Default Title");

    if (!hasRealOptions || onlyDefault) {
      selectedVariantId = Number(card.dataset.variantId) || sheetVariants[0]?.id || null;
      syncAddButton();
      return;
    }

    const firstAvailable = sheetVariants.find((v) => v.available) || sheetVariants[0];
    sheetSelectedOptions = variantOptionValues(firstAvailable || {});

    sheetOptionDefs.forEach((opt, index) => {
      if (!sheetSelectedOptions[index]) sheetSelectedOptions[index] = opt.values[0];

      const wrap = document.createElement("label");
      wrap.className = "ftw-sheet__option";

      const label = document.createElement("span");
      label.className = "ftw-sheet__option-label";
      label.textContent = String(opt.name || `Option ${index + 1}`).toUpperCase();

      const select = document.createElement("select");
      select.className = "ftw-sheet__select";
      select.dataset.optionIndex = String(index);
      select.setAttribute("aria-label", opt.name || `Option ${index + 1}`);

      opt.values.forEach((value) => {
        const optionEl = document.createElement("option");
        optionEl.value = value;
        optionEl.textContent = String(value).toUpperCase();
        const exists = optionHasAnyVariant(index, value, sheetSelectedOptions);
        optionEl.disabled = !exists;
        if (sheetSelectedOptions[index] === value) optionEl.selected = true;
        select.appendChild(optionEl);
      });

      select.addEventListener("change", () => {
        sheetSelectedOptions[index] = select.value;
        // refresh disabled states for other selects
        $$(".ftw-sheet__select", host).forEach((sel) => {
          const i = Number(sel.dataset.optionIndex);
          [...sel.options].forEach((optEl) => {
            optEl.disabled = !optionHasAnyVariant(i, optEl.value, sheetSelectedOptions);
          });
        });
        syncVariantFromOptions();
      });

      wrap.appendChild(label);
      wrap.appendChild(select);
      host.appendChild(wrap);
    });

    syncVariantFromOptions();
  }

  function openSheet(card) {
    const sheet = $("#ftw-sheet");
    if (!sheet || !card) return;

    closeDrawers();
    setNavOpen(false);

    const title = card.dataset.title || "";
    const price = card.dataset.price || "";
    const image = card.dataset.image || card.querySelector("img")?.src || "";
    const desc = card.dataset.description || "";
    sheetAvailable = card.dataset.available !== "0";
    sheetVariants = parseVariants(card.dataset.variants);
    sheetImages = parseImages(card.dataset.images, image);
    sheetImageIndex = 0;

    $("#ftw-sheet-title").textContent = title;
    $("#ftw-sheet-price").textContent = sheetAvailable ? price : "SOLD OUT";
    $("#ftw-sheet-lines").innerHTML = descLines(desc)
      .map((l) => `<li>${l}</li>`)
      .join("");

    $$("[data-ftw-detail-panel]", root).forEach((p) => {
      p.hidden = true;
    });

    buildStack(title);
    buildSizes(card);
    sheetImageIndex = 0;

    sheet.hidden = false;
    document.body.classList.add("ftw-sheet-open");
    requestAnimationFrame(() => {
      sheet.classList.add("is-open");
      sheetOpen = true;
      $(".ftw-sheet__back")?.focus();
    });
  }

  function closeSheet(instant) {
    const sheet = $("#ftw-sheet");
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove("is-open");
    sheetOpen = false;
    document.body.classList.remove("ftw-sheet-open");
    const finish = () => {
      sheet.hidden = true;
      selectedVariantId = null;
    };
    if (instant) finish();
    else setTimeout(finish, 240);
    sheetVariants = [];
    sheetImages = [];
  }

  async function addVariantToCart(variantId, { openBag = false, sourceBtn = null } = {}) {
    if (!variantId) return false;

    if (isLocal) {
      const count = Number($("#cart-count")?.textContent || 0) + 1;
      updateTrayCart(count);
      toast("ADDED TO CART.");
      if (openBag) openDrawer("ftw-bag");
      return true;
    }

    if (sourceBtn) sourceBtn.disabled = true;
    try {
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
      });
      if (!res.ok) throw new Error("add failed");
      const cart = await fetchCart();
      updateTrayCart(cart.item_count);
      toast("ADDED TO CART.");
      if (openBag) openDrawer("ftw-bag");
      else if (!$("#ftw-bag")?.hidden) renderCart();
      return true;
    } catch {
      toast("COULDN'T ADD. TRY AGAIN.");
      if (sourceBtn) sourceBtn.disabled = false;
      return false;
    }
  }

  async function addToCart() {
    const addBtn = $("#ftw-sheet-add");
    if (!selectedVariantId || addBtn?.disabled) {
      toast("PICK YOUR OPTIONS.");
      return;
    }
    addBtn.disabled = true;
    const ok = await addVariantToCart(selectedVariantId, { openBag: true, sourceBtn: addBtn });
    if (ok) closeSheet(true);
    else addBtn.disabled = false;
  }

  $("#ftw-bag-btn")?.addEventListener("click", () => {
    const bag = $("#ftw-bag");
    if (bag?.hidden) openDrawer("ftw-bag");
    else closeDrawers();
  });

  $("#ftw-account-btn")?.addEventListener("click", () => {
    const account = $("#ftw-account");
    if (account?.hidden) openDrawer("ftw-account");
    else closeDrawers();
  });

  $("#ftw-contact-open")?.addEventListener("click", () => openDrawer("ftw-contact"));
  $("#ftw-menu-btn")?.addEventListener("click", () => setNavOpen(!root.classList.contains("is-nav-open")));
  $("#ftw-nav-scrim")?.addEventListener("click", () => setNavOpen(false));
  $("#ftw-sheet-add")?.addEventListener("click", addToCart);
  $("#ftw-theme-btn")?.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  });

  $("#ftw-search-input")?.addEventListener("input", (e) => {
    searchQuery = e.target.value || "";
    applyFilters();
  });

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-sheet]")) {
      closeSheet();
      return;
    }

    const detailBtn = e.target.closest("[data-ftw-detail]");
    if (detailBtn) {
      const key = detailBtn.dataset.ftwDetail;
      const panel = $(`[data-ftw-detail-panel="${key}"]`, root);
      if (panel) panel.hidden = !panel.hidden;
      return;
    }

    const sizeBtn = e.target.closest(".ftw-sheet__size");
    if (sizeBtn && !sizeBtn.disabled) {
      $$(".ftw-sheet__size", root).forEach((b) => b.classList.remove("is-active"));
      sizeBtn.classList.add("is-active");
      selectedVariantId = Number(sizeBtn.dataset.variantId);
      const match = sheetVariants.find((v) => String(v.id) === String(selectedVariantId));
      if (match?.price) $("#ftw-sheet-price").textContent = match.price;
      syncAddButton();
      return;
    }

    const product = e.target.closest(".ftw-product");
    if (product && root.contains(product)) {
      e.preventDefault();
      openSheet(product);
      return;
    }

    const cartQtyBtn = e.target.closest("[data-cart-key][data-cart-qty]");
    if (cartQtyBtn) {
      const key = cartQtyBtn.dataset.cartKey;
      const qty = Number(cartQtyBtn.dataset.cartQty);
      cartQtyBtn.disabled = true;
      changeCartLine(key, qty).finally(() => {
        cartQtyBtn.disabled = false;
      });
      return;
    }

    const upsellBtn = e.target.closest("[data-upsell-add]");
    if (upsellBtn) {
      addVariantToCart(upsellBtn.dataset.upsellAdd, { sourceBtn: upsellBtn });
      return;
    }

    const filterBtn = e.target.closest("[data-ftw-filter]");
    if (filterBtn) {
      setFilter(filterBtn.dataset.ftwFilter);
      return;
    }
    if (e.target.closest("[data-close-drawer]")) {
      closeDrawers();
      return;
    }
    if (e.target.classList.contains("ftw-drawer")) {
      closeDrawers();
      return;
    }
    const tab = e.target.closest("[data-ftw-tab]");
    if (tab) {
      setTab(tab.dataset.ftwTab);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheetOpen) {
      closeSheet();
    }
  });

  $("#contact-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    toast("YOU'RE ON THE LIST.");
    e.target.reset();
    closeDrawers();
  });

  updateTrayCart(Number(root.dataset.cartCount || 0));
  if (!isLocal) renderCart();
  applyFilters();
})();
