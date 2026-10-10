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
          <button type="button" class="ftw-btn" id="ftw-outfit-open">OUTFIT CHECKER</button>
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
    setNavOpen(false);
    $$(".ftw-drawer", root).forEach((d) => {
      d.hidden = d.id !== id;
    });
    $("#ftw-bag-btn")?.setAttribute("aria-expanded", String(id === "ftw-bag"));
    $$("#ftw-account-btn, #ftw-account-top-btn, #ftw-account-side-btn", root).forEach((btn) => {
      btn.setAttribute("aria-expanded", String(id === "ftw-account"));
    });
    if (id === "ftw-bag") renderCart();
  }

  function closeDrawers() {
    $$(".ftw-drawer", root).forEach((d) => {
      d.hidden = true;
    });
    $("#ftw-bag-btn")?.setAttribute("aria-expanded", "false");
    $$("#ftw-account-btn, #ftw-account-top-btn, #ftw-account-side-btn", root).forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function toggleAccountDrawer() {
    const account = $("#ftw-account");
    if (account?.hidden) openDrawer("ftw-account");
    else closeDrawers();
  }

  let outfitPieceId = 0;
  let outfitDrag = null;

  function collectOutfitPieces() {
    const seen = new Set();
    const pieces = [];

    const push = (title, image, idHint) => {
      if (!image) return;
      const key = `${title}::${image}`;
      if (seen.has(key)) return;
      seen.add(key);
      pieces.push({
        id: idHint || key,
        title: title || "Piece",
        image,
      });
    };

    $$(".ftw-cart-line", root).forEach((line) => {
      const img = line.querySelector("img")?.src;
      const title = line.querySelector(".ftw-cart-line__title")?.textContent?.trim();
      push(title, img);
    });

    getUpsellPool().forEach((p) => push(p.title, p.image, p.handle || p.id));

    $$(".ftw-product", root).forEach((card) => {
      if (card.dataset.available === "0") return;
      push(card.dataset.title, card.dataset.image || card.querySelector("img")?.src, card.dataset.product);
    });

    return pieces.slice(0, 24);
  }

  function syncOutfitHint() {
    const hint = $("#ftw-outfit-hint");
    const stage = $("#ftw-outfit-stage");
    if (!hint || !stage) return;
    const hasPieces = !!stage.querySelector(".ftw-outfit__piece");
    hint.hidden = hasPieces;
  }

  function buildOutfitRack() {
    const rack = $("#ftw-outfit-rack");
    if (!rack) return;
    const pieces = collectOutfitPieces();
    if (!pieces.length) {
      rack.innerHTML = `<p class="ftw-outfit__empty">ADD PIECES TO CART OR BROWSE THE DROP.</p>`;
      return;
    }
    rack.innerHTML = pieces
      .map(
        (p) => `<button type="button" class="ftw-outfit__rack-item" data-outfit-src="${escapeHtml(p.image)}" data-outfit-title="${escapeHtml(p.title)}" aria-label="Add ${escapeHtml(p.title)}">
          <img src="${escapeHtml(p.image)}" alt="" width="72" height="72" draggable="false" loading="lazy">
          <span>${escapeHtml(p.title)}</span>
        </button>`
      )
      .join("");
  }

  function placeOutfitPiece(src, title, clientX, clientY) {
    const stage = $("#ftw-outfit-stage");
    if (!stage || !src) return;
    const rect = stage.getBoundingClientRect();
    const piece = document.createElement("div");
    piece.className = "ftw-outfit__piece";
    piece.dataset.pieceId = String(++outfitPieceId);
    const left = Math.min(Math.max(clientX - rect.left - 48, 8), rect.width - 96);
    const top = Math.min(Math.max(clientY - rect.top - 48, 8), rect.height - 96);
    piece.style.left = `${left}px`;
    piece.style.top = `${top}px`;
    piece.innerHTML = `
      <img src="${escapeHtml(src)}" alt="${escapeHtml(title || "")}" draggable="false">
      <button type="button" class="ftw-outfit__piece-kill" aria-label="Remove piece">×</button>`;
    stage.appendChild(piece);
    syncOutfitHint();
  }

  function clearOutfitStage() {
    $$(".ftw-outfit__piece", root).forEach((el) => el.remove());
    syncOutfitHint();
  }

  function openOutfitChecker() {
    const outfit = $("#ftw-outfit");
    if (!outfit) return;
    closeSheet(true);
    closeDrawers();
    setNavOpen(false);
    buildOutfitRack();
    syncOutfitHint();
    outfit.hidden = false;
    document.body.classList.add("ftw-outfit-open");
    requestAnimationFrame(() => {
      outfit.classList.add("is-open");
      $("#ftw-outfit-close")?.focus();
    });
  }

  function closeOutfitChecker() {
    const outfit = $("#ftw-outfit");
    if (!outfit || outfit.hidden) return;
    outfit.classList.remove("is-open");
    document.body.classList.remove("ftw-outfit-open");
    setTimeout(() => {
      outfit.hidden = true;
      outfitDrag = null;
    }, 200);
  }

  function startOutfitDrag(e, mode, payload) {
    if (e.button != null && e.button !== 0) return;
    const pointerId = e.pointerId;
    outfitDrag = { mode, ...payload, pointerId, moved: false };
    try {
      e.currentTarget.setPointerCapture?.(pointerId);
    } catch (_) {}
  }

  function onOutfitPointerMove(e) {
    if (!outfitDrag || e.pointerId !== outfitDrag.pointerId) return;
    outfitDrag.moved = true;
    if (outfitDrag.mode === "move" && outfitDrag.el) {
      const stage = $("#ftw-outfit-stage");
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const left = Math.min(Math.max(e.clientX - rect.left - outfitDrag.ox, 0), rect.width - 40);
      const top = Math.min(Math.max(e.clientY - rect.top - outfitDrag.oy, 0), rect.height - 40);
      outfitDrag.el.style.left = `${left}px`;
      outfitDrag.el.style.top = `${top}px`;
    }
  }

  function onOutfitPointerUp(e) {
    if (!outfitDrag || e.pointerId !== outfitDrag.pointerId) return;
    const drag = outfitDrag;
    outfitDrag = null;

    if (drag.mode === "rack") {
      const stage = $("#ftw-outfit-stage");
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const over =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (over || !drag.moved) {
        const x = over ? e.clientX : rect.left + rect.width / 2;
        const y = over ? e.clientY : rect.top + rect.height * 0.42;
        placeOutfitPiece(drag.src, drag.title, x, y);
      }
    }
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
    $("#ftw-menu-btn")?.setAttribute("aria-expanded", String(!!open));
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
      if (sourceBtn && sourceBtn.hasAttribute("data-ftw-quick-add")) {
        sourceBtn.disabled = false;
        sourceBtn.textContent = "+ ADD";
      }
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

  $("#ftw-account-btn")?.addEventListener("click", toggleAccountDrawer);
  $("#ftw-account-top-btn")?.addEventListener("click", toggleAccountDrawer);
  $("#ftw-account-side-btn")?.addEventListener("click", toggleAccountDrawer);

  $("#ftw-contact-open")?.addEventListener("click", () => openDrawer("ftw-contact"));
  $("#ftw-menu-btn")?.addEventListener("click", () => setNavOpen(!root.classList.contains("is-nav-open")));
  $("#ftw-nav-scrim")?.addEventListener("click", () => setNavOpen(false));
  $("#ftw-sheet-add")?.addEventListener("click", addToCart);
  $("#ftw-theme-btn")?.addEventListener("click", () => {
    setTheme(getTheme() === "dark" ? "light" : "dark");
  });
  $("#ftw-outfit-close")?.addEventListener("click", closeOutfitChecker);
  $("#ftw-outfit-clear")?.addEventListener("click", clearOutfitStage);

  function onSearchInput(e) {
    searchQuery = e.target.value || "";
    const otherId = e.target.id === "ftw-search-input" ? "ftw-search-input-side" : "ftw-search-input";
    const other = $(`#${otherId}`);
    if (other && other.value !== searchQuery) other.value = searchQuery;
    applyFilters();
  }

  $("#ftw-search-input")?.addEventListener("input", onSearchInput);
  $("#ftw-search-input-side")?.addEventListener("input", onSearchInput);

  root.addEventListener("pointermove", onOutfitPointerMove);
  root.addEventListener("pointerup", onOutfitPointerUp);
  root.addEventListener("pointercancel", onOutfitPointerUp);

  root.addEventListener("pointerdown", (e) => {
    const kill = e.target.closest(".ftw-outfit__piece-kill");
    if (kill) return;

    const rackItem = e.target.closest(".ftw-outfit__rack-item");
    if (rackItem) {
      e.preventDefault();
      startOutfitDrag(e, "rack", {
        src: rackItem.dataset.outfitSrc,
        title: rackItem.dataset.outfitTitle,
      });
      return;
    }

    const piece = e.target.closest(".ftw-outfit__piece");
    if (piece) {
      e.preventDefault();
      const rect = piece.getBoundingClientRect();
      startOutfitDrag(e, "move", {
        el: piece,
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
      });
    }
  });

  root.addEventListener("click", (e) => {
    if (e.target.closest("#ftw-outfit-open")) {
      openOutfitChecker();
      return;
    }

    const pieceKill = e.target.closest(".ftw-outfit__piece-kill");
    if (pieceKill) {
      pieceKill.closest(".ftw-outfit__piece")?.remove();
      syncOutfitHint();
      return;
    }

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

    const quickAdd = e.target.closest("[data-ftw-quick-add]");
    if (quickAdd) {
      e.preventDefault();
      e.stopPropagation();
      const card = quickAdd.closest(".ftw-product");
      if (!card || card.classList.contains("is-sold")) return;
      const variants = parseVariants(card.dataset.variants);
      const available = variants.find((v) => v.available);
      const variantId = available?.id || Number(card.dataset.variantId);
      if (!variantId) {
        toast("UNAVAILABLE.");
        return;
      }
      addVariantToCart(variantId, { openBag: false, sourceBtn: quickAdd });
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
    if (e.key !== "Escape") return;
    if (!$("#ftw-outfit")?.hidden) {
      closeOutfitChecker();
      return;
    }
    if (sheetOpen) closeSheet();
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
