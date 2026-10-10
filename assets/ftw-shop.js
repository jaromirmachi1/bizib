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
    const isDark = theme === "dark";
    $$("[data-ftw-theme]", root).forEach((btn) => {
      btn.setAttribute("aria-pressed", isDark ? "true" : "false");
      btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      if (!btn.querySelector("svg")) {
        btn.textContent = isDark ? "LIGHT MODE" : "DARK MODE";
      }
    });
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

  const UPSELL_COLLECTION_RE =
    /(^|[\s,/|-])(accessories?|hats?|caps?|beanies?|t-shirts?|tees?|tee)([\s,/|-]|$)/i;

  function isUpsellAllowed(product) {
    const blob = [product.collections, product.handle, product.title].filter(Boolean).join(" ");
    return UPSELL_COLLECTION_RE.test(blob);
  }

  function getUpsellPool() {
    const raw = $("#ftw-upsell-data")?.textContent;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.filter((p) => p && p.variantId && isUpsellAllowed(p));
        }
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
        collections: card.dataset.collections || "",
        variantId: Number(card.dataset.variantId),
        available: true,
      }))
      .filter((p) => p.variantId && isUpsellAllowed(p));
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

  const FREE_SHIP_CZK = Math.max(
    1,
    Number(root.dataset.freeShippingCzk || 4000) || 4000
  );
  const FREE_SHIP_CENTS = FREE_SHIP_CZK * 100;

  function cartSubtotal(cart) {
    const n = Number(cart?.items_subtotal_price ?? cart?.total_price ?? 0);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function renderShippingProgress(cart) {
    const host = $("#cart-shipping");
    if (!host) return;
    const spent = cartSubtotal(cart);
    const pct = Math.min(100, Math.round((spent / FREE_SHIP_CENTS) * 100));
    const unlocked = spent >= FREE_SHIP_CENTS;
    const left = Math.max(0, FREE_SHIP_CENTS - spent);
    const msg = unlocked
      ? "FREE CZ SHIPPING UNLOCKED."
      : spent > 0
        ? `${formatMoney(left)} AWAY FROM FREE SHIPPING`
        : `FREE CZ SHIPPING FROM ${FREE_SHIP_CZK.toLocaleString("cs-CZ")} KČ`;

    host.hidden = false;
    host.classList.toggle("is-unlocked", unlocked);
    host.innerHTML = `
      <div class="ftw-ship__label">${escapeHtml(msg)}</div>
      <div
        class="ftw-ship__track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${pct}"
        aria-label="Free shipping progress"
      >
        <span class="ftw-ship__fill" style="transform: scaleX(${pct / 100})"></span>
      </div>
      <div class="ftw-ship__meta">
        <span>${formatMoney(spent)}</span>
        <span>${FREE_SHIP_CZK.toLocaleString("cs-CZ")} KČ</span>
      </div>`;
  }

  function renderCartFooter(cart) {
    const footer = $("#cart-footer");
    if (!footer) return;
    const empty = !cart?.item_count;
    footer.hidden = false;
    footer.innerHTML = `
      <strong>${empty ? "TOTAL: —" : `TOTAL: ${formatMoney(cart.total_price)}`}</strong>
      <button type="button" class="ftw-btn" id="ftw-outfit-open">OUTFIT CHECKER</button>
      ${
        empty
          ? `<button type="button" class="ftw-btn ftw-btn--primary" disabled aria-disabled="true">CHECKOUT</button>`
          : `<a class="ftw-btn ftw-btn--primary" href="/checkout">CHECKOUT</a>`
      }`;
  }

  async function renderCart() {
    const body = $("#cart-body");
    const upsell = $("#cart-upsell");
    if (!body) return;
    try {
      const cart = await fetchCart();
      updateTrayCart(cart.item_count);
      renderShippingProgress(cart);
      if (!cart.item_count) {
        body.innerHTML = `<div class="ftw-empty">CART EMPTY.</div>`;
        if (upsell) {
          upsell.hidden = true;
          upsell.innerHTML = "";
        }
        renderCartFooter(cart);
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
      renderCartFooter(cart);
    } catch {
      body.innerHTML = `<div class="ftw-empty">Couldn't load cart.</div>`;
      if (upsell) {
        upsell.hidden = true;
        upsell.innerHTML = "";
      }
      renderShippingProgress({ item_count: 0, items_subtotal_price: 0, total_price: 0 });
      renderCartFooter({ item_count: 0 });
    }
  }

  function openDrawer(id) {
    closeSheet(true);
    setNavOpen(false);
    $$(".ftw-drawer", root).forEach((d) => {
      d.hidden = d.id !== id;
    });
    $("#ftw-bag-btn")?.setAttribute("aria-expanded", String(id === "ftw-bag"));
    $$("#ftw-account-top-btn, [data-ftw-account]", root).forEach((btn) => {
      btn.setAttribute("aria-expanded", String(id === "ftw-account"));
    });
    if (id === "ftw-bag") renderCart();
  }

  function closeDrawers() {
    $$(".ftw-drawer", root).forEach((d) => {
      d.hidden = true;
    });
    $("#ftw-bag-btn")?.setAttribute("aria-expanded", "false");
    $$("#ftw-account-top-btn, [data-ftw-account]", root).forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function toggleAccountDrawer() {
    const account = $("#ftw-account");
    if (account?.hidden) openDrawer("ftw-account");
    else closeDrawers();
  }

  const OUTFIT_SLOTS = ["head", "top", "bottom"];
  const OUTFIT_SLOT_LAYOUT = {
    head: { x: 0.5, y: 0.1, scale: 0.72 },
    top: { x: 0.5, y: 0.34, scale: 1 },
    bottom: { x: 0.5, y: 0.62, scale: 1.05 },
  };

  function outfitFrames(stage) {
    const stageW = stage?.clientWidth || 800;
    const stageH = stage?.clientHeight || 700;
    const col = Math.round(Math.min(480, Math.max(230, Math.min(stageW, stageH) * 0.42)));
    const headW = Math.round(col * 0.42);
    const headH = Math.round(col * 0.36);
    const topW = col;
    const topH = Math.round(col * 1.08);
    const botW = Math.round(col * 0.9);
    const botH = Math.round(col * 0.78);
    const stack = headH * 0.35 + topH * 0.7 + botH * 0.55;
    const start = Math.max(12, (stageH - stack) / 2);
    const cx = stageW / 2;
    const topTop = start + headH * 0.22;
    return {
      head: { width: headW, height: headH, left: cx - headW / 2, top: start + headH * 0.08 },
      top: { width: topW, height: topH, left: cx - topW / 2, top: topTop },
      bottom: { width: botW, height: botH, left: cx - botW / 2, top: topTop + topH * 0.58 },
    };
  }

  function fitContainedImage(img, target = 0.94) {
    const box = img.parentElement;
    if (!box || !img.naturalWidth || !img.naturalHeight) return;
    const boxW = box.clientWidth;
    const boxH = box.clientHeight;
    if (!boxW || !boxH) return;
    const bounds = productContentBounds(img);
    if (!bounds) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = boxW / boxH;
    const drawW = imgRatio > boxRatio ? boxW : boxH * imgRatio;
    const drawH = imgRatio > boxRatio ? boxW / imgRatio : boxH;
    const scale = Math.min(
      2.6,
      Math.max(0.85, Math.min((boxW * target) / (drawW * bounds.w), (boxH * target) / (drawH * bounds.h)))
    );
    img.style.transform = `scale(${scale})`;
  }
  let outfitDefaults = [];
  let outfitPieceId = 0;
  let outfitDrag = null;
  let outfitSelected = null;
  let outfitSeeded = false;

  function inferOutfitSlot(collections, title) {
    const blob = `${collections || ""} ${title || ""}`.toLowerCase();
    if (/(^|[\s,-])(hat|hats|cap|caps|beanie|beanies|headwear)([\s,-]|$)/.test(blob)) return "head";
    if (/(bottom|bottoms|pant|pants|short|shorts|trouser|jeans|track|skirt|bikini)/.test(blob)) return "bottom";
    if (/(jacket|jackets|hoodie|hoodies|sweat|tee|t-shirt|tshirt|shirt|top|crew|longsleeve|shell|coat)/.test(blob)) {
      return "top";
    }
    return "top";
  }

  function colorOptionIndex(options) {
    return options.findIndex((o) => /^(color|colour|barva|farbe|couleur)$/i.test(String(o?.name || "").trim()));
  }

  function collectOutfitPieces() {
    const seen = new Set();
    const seenImages = new Set();
    const pieces = [];

    const push = (title, image, idHint, collections, price, variantId) => {
      if (!image) return;
      if (seenImages.has(image)) return;
      const key = `${title}::${image}`;
      if (seen.has(key)) return;
      seen.add(key);
      seenImages.add(image);
      pieces.push({
        id: String(idHint || key),
        title: title || "Piece",
        image,
        price: price || "",
        variantId: variantId ? String(variantId) : "",
        slot: inferOutfitSlot(collections, title),
      });
    };

    $$(".ftw-cart-line", root).forEach((line) => {
      const img = line.querySelector("img")?.src;
      const title = line.querySelector(".ftw-cart-line__title")?.textContent?.trim();
      const price = line.querySelector(".ftw-cart-line__price")?.textContent?.trim() || "";
      const variantId = line.dataset.variantId || "";
      push(title, img, `cart-${title}`, "", price, variantId);
    });

    $$(".ftw-product", root).forEach((card) => {
      if (card.dataset.available === "0") return;
      const collections = card.dataset.collections || "";
      const baseTitle = card.dataset.title || "Piece";
      const handle = card.dataset.product || baseTitle;
      const basePrice = card.dataset.price || "";
      const options = parseVariants(card.dataset.options);
      const variants = parseVariants(card.dataset.variants);
      const colorIdx = colorOptionIndex(options);
      let added = 0;

      variants.forEach((v) => {
        if (!v?.image) return;
        const color = colorIdx >= 0 ? v.options?.[colorIdx] : null;
        const title = color ? `${baseTitle} — ${String(color).toUpperCase()}` : baseTitle;
        push(title, v.image, `${handle}-${color || v.id}`, collections, v.price || basePrice, v.id);
        added += 1;
      });

      if (added) return;

      const gallery = parseImages(card.dataset.images, card.dataset.outfitImage || "");
      if (gallery.length === 1) {
        push(baseTitle, gallery[0], handle, collections, basePrice, card.dataset.variantId);
      }
    });

    return pieces.slice(0, 36);
  }

  function pickOutfitDefaults(pieces) {
    const defaults = [];
    OUTFIT_SLOTS.forEach((slot) => {
      const piece = pieces.find((p) => p.slot === slot);
      if (piece) defaults.push({ ...piece, slot });
    });
    if (!defaults.some((p) => p.slot === "top") && pieces[0]) {
      defaults.push({ ...pieces[0], slot: "top" });
    }
    if (!defaults.some((p) => p.slot === "bottom")) {
      const fallback = pieces.find((p) => !defaults.some((d) => d.id === p.id));
      if (fallback) defaults.push({ ...fallback, slot: "bottom" });
    }
    return defaults;
  }

  function syncOutfitHint() {
    const hint = $("#ftw-outfit-hint");
    const layer = $("#ftw-outfit-layer");
    if (!hint || !layer) return;
    hint.hidden = !!layer.querySelector(".ftw-outfit__piece");
  }

  function syncOutfitRackActive() {
    const worn = new Set(
      $$(".ftw-outfit__piece", root).map((el) => el.dataset.outfitSrc).filter(Boolean)
    );
    $$(".ftw-outfit__rack-item", root).forEach((btn) => {
      btn.classList.toggle("is-worn", worn.has(btn.dataset.outfitSrc));
    });
  }

  function renderOutfitBag() {
    const bag = $("#ftw-outfit-bag");
    if (!bag) return;
    const pieces = $$(".ftw-outfit__piece", root);
    if (!pieces.length) {
      bag.innerHTML = `<p class="ftw-outfit__empty">CLICK A PIECE TO BUILD THE FIT.</p>`;
      return;
    }

    const seen = new Set();
    const rows = [];
    pieces.forEach((piece) => {
      const key = piece.dataset.variantId || piece.dataset.outfitSrc || piece.dataset.pieceId;
      if (!key || seen.has(key)) return;
      seen.add(key);
      rows.push(piece);
    });

    bag.innerHTML = rows
      .map((piece) => {
        const title = piece.dataset.outfitTitle || "Piece";
        const price = piece.dataset.outfitPrice || "";
        const src = piece.dataset.outfitSrc || "";
        const variantId = piece.dataset.variantId || "";
        const canAdd = Boolean(variantId);
        return `<article class="ftw-outfit__bag-item">
          <img src="${escapeHtml(src)}" alt="" width="72" height="72" loading="lazy">
          <div class="ftw-outfit__bag-meta">
            <div class="ftw-outfit__bag-title">${escapeHtml(title)}</div>
            ${price ? `<div class="ftw-outfit__bag-price">${escapeHtml(price)}</div>` : ""}
            <button
              type="button"
              class="ftw-outfit__bag-add"
              data-outfit-add="${escapeHtml(variantId)}"
              ${canAdd ? "" : "disabled"}
            >${canAdd ? "ADD TO CART" : "UNAVAILABLE"}</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function syncOutfitLists() {
    syncOutfitHint();
    syncOutfitRackActive();
    renderOutfitBag();
  }

  function selectOutfitPiece(piece) {
    $$(".ftw-outfit__piece", root).forEach((el) => el.classList.remove("is-selected"));
    outfitSelected = piece || null;
    if (piece) piece.classList.add("is-selected");
  }

  function setOutfitPieceScale(piece, scale) {
    if (!piece) return;
    const next = Math.min(1.8, Math.max(0.4, scale));
    piece.dataset.scale = String(next);
    piece.style.setProperty("--outfit-scale", String(next));
  }

  function bindOutfitImage(img, src) {
    const fit = () => fitContainedImage(img, 0.94);
    img.crossOrigin = "anonymous";
    img.alt = img.alt || "";
    img.style.transform = "";
    if (img.getAttribute("src") === src && img.complete && img.naturalWidth) {
      fit();
      return;
    }
    img.addEventListener("load", fit, { once: true });
    img.src = src;
  }

  function placeOutfitPiece(meta, frame) {
    const layer = $("#ftw-outfit-layer");
    const stage = $("#ftw-outfit-stage");
    const src = meta?.image || meta?.src;
    if (!layer || !stage || !src) return null;
    const slot = meta.slot || "top";
    const box = frame || outfitFrames(stage)[slot] || outfitFrames(stage).top;

    const piece = document.createElement("div");
    piece.className = "ftw-outfit__piece";
    piece.dataset.pieceId = String(++outfitPieceId);
    piece.dataset.outfitId = meta.id || src;
    piece.dataset.outfitSrc = src;
    piece.dataset.outfitTitle = meta.title || "Piece";
    piece.dataset.outfitPrice = meta.price || "";
    piece.dataset.variantId = meta.variantId ? String(meta.variantId) : "";
    piece.dataset.slot = slot;
    piece.style.width = `${box.width}px`;
    piece.style.height = `${box.height}px`;
    piece.style.left = `${box.left}px`;
    piece.style.top = `${box.top}px`;
    setOutfitPieceScale(piece, 1);
    piece.innerHTML = `
      <button type="button" class="ftw-outfit__piece-resize" aria-label="Drag to resize">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>
          <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/>
        </svg>
      </button>
      <img alt="${escapeHtml(meta.title || "")}" draggable="false">
      <button type="button" class="ftw-outfit__piece-kill" aria-label="Remove piece">×</button>`;
    layer.appendChild(piece);
    const img = piece.querySelector("img");
    if (img) bindOutfitImage(img, src);
    selectOutfitPiece(piece);
    syncOutfitLists();
    return piece;
  }

  function wearOutfitPiece(meta) {
    const layer = $("#ftw-outfit-layer");
    const stage = $("#ftw-outfit-stage");
    const src = meta?.image || meta?.src;
    if (!layer || !stage || !src) return null;
    const slot = meta.slot || "top";
    const existing = layer.querySelector(`.ftw-outfit__piece[data-slot="${slot}"]`);
    if (!existing) return placeOutfitPiece(meta, outfitFrames(stage)[slot]);

    existing.dataset.outfitId = meta.id || src;
    existing.dataset.outfitSrc = src;
    existing.dataset.outfitTitle = meta.title || "Piece";
    existing.dataset.outfitPrice = meta.price || "";
    existing.dataset.variantId = meta.variantId ? String(meta.variantId) : "";
    const img = existing.querySelector("img");
    if (img) {
      img.alt = meta.title || "";
      bindOutfitImage(img, src);
    }
    selectOutfitPiece(existing);
    syncOutfitLists();
    return existing;
  }

  function clearOutfitLayer() {
    const layer = $("#ftw-outfit-layer");
    if (layer) layer.innerHTML = "";
    outfitSelected = null;
    syncOutfitLists();
  }

  function seedDefaultOutfit() {
    clearOutfitLayer();
    ["bottom", "top", "head"].forEach((slot) => {
      const piece = outfitDefaults.find((p) => p.slot === slot);
      if (piece) wearOutfitPiece(piece);
    });
    selectOutfitPiece($(".ftw-outfit__piece[data-slot='top']", root) || $(".ftw-outfit__piece", root));
    outfitSeeded = true;
  }

  function buildOutfitRack() {
    const rack = $("#ftw-outfit-rack");
    if (!rack) return;
    const pieces = collectOutfitPieces();
    outfitDefaults = pickOutfitDefaults(pieces);
    if (!pieces.length) {
      rack.innerHTML = `<p class="ftw-outfit__empty">ADD PIECES TO CART OR BROWSE THE DROP.</p>`;
      if (!outfitSeeded) clearOutfitLayer();
      return;
    }
    rack.innerHTML = pieces
      .map(
        (p) => `<button type="button" class="ftw-outfit__rack-item" data-outfit-id="${escapeHtml(p.id)}" data-outfit-src="${escapeHtml(p.image)}" data-outfit-title="${escapeHtml(p.title)}" data-outfit-price="${escapeHtml(p.price || "")}" data-outfit-variant="${escapeHtml(p.variantId || "")}" data-outfit-slot="${escapeHtml(p.slot)}" aria-label="Swap in ${escapeHtml(p.title)}">
          <img src="${escapeHtml(p.image)}" alt="" width="72" height="72" draggable="false" loading="lazy">
          <span>${escapeHtml(p.title)}</span>
        </button>`
      )
      .join("");
    syncOutfitRackActive();
  }

  function resetOutfitStage() {
    seedDefaultOutfit();
  }

  function openOutfitChecker() {
    const outfit = $("#ftw-outfit");
    if (!outfit) return;
    closeSheet(true);
    closeDrawers();
    setNavOpen(false);
    buildOutfitRack();
    outfit.hidden = false;
    document.body.classList.add("ftw-outfit-open");
    requestAnimationFrame(() => {
      outfit.classList.add("is-open");
      if (!outfitSeeded || !$("#ftw-outfit-layer")?.querySelector(".ftw-outfit__piece")) {
        seedDefaultOutfit();
      } else {
        syncOutfitLists();
      }
      $("#ftw-outfit-close")?.focus();
    });
  }

  function closeOutfitChecker() {
    const outfit = $("#ftw-outfit");
    if (!outfit || outfit.hidden) return;
    outfit.classList.remove("is-open");
    document.body.classList.remove("ftw-outfit-open");
    outfitDrag = null;
    setTimeout(() => {
      outfit.hidden = true;
    }, 200);
  }

  function startOutfitDrag(e, mode, payload) {
    if (e.button != null && e.button !== 0) return;
    outfitDrag = {
      mode,
      ...payload,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch (_) {}
  }

  function onOutfitPointerMove(e) {
    if (!outfitDrag || e.pointerId !== outfitDrag.pointerId) return;
    const dx = e.clientX - outfitDrag.startX;
    const dy = e.clientY - outfitDrag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) outfitDrag.moved = true;

    if (outfitDrag.mode === "move" && outfitDrag.el) {
      const stage = $("#ftw-outfit-stage");
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const el = outfitDrag.el;
      const scale = Number(el.dataset.scale || 1);
      const baseW = el.offsetWidth || 120;
      const baseH = el.offsetHeight || 120;
      const overflowX = Math.max(0, (baseW * (scale - 1)) / 2);
      const overflowY = Math.max(0, (baseH * (scale - 1)) / 2);
      let left = outfitDrag.originLeft + (e.clientX - outfitDrag.startX);
      let top = outfitDrag.originTop + (e.clientY - outfitDrag.startY);
      left = Math.min(Math.max(left, -overflowX), rect.width - baseW + overflowX);
      top = Math.min(Math.max(top, -overflowY), rect.height - baseH + overflowY);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      return;
    }

    if (outfitDrag.mode === "resize" && outfitDrag.el) {
      const dist = Math.hypot(e.clientX - outfitDrag.cx, e.clientY - outfitDrag.cy);
      const ratio = outfitDrag.startDist > 8 ? dist / outfitDrag.startDist : 1;
      setOutfitPieceScale(outfitDrag.el, outfitDrag.startScale * ratio);
    }
  }

  function onOutfitPointerUp(e) {
    if (!outfitDrag || e.pointerId !== outfitDrag.pointerId) return;
    const drag = outfitDrag;
    outfitDrag = null;

    if (drag.mode === "rack") return;

    if (drag.mode === "move" && drag.el && !drag.moved) {
      selectOutfitPiece(drag.el);
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

  const TYPE_FILTER = {
    "t-shirts": "t-shirts",
    "t-shirt": "t-shirts",
    tshirts: "t-shirts",
    shirts: "t-shirts",
    shirt: "t-shirts",
    "tank-tops": "t-shirts",
    "tank-top": "t-shirts",
    tanktops: "t-shirts",
    womens: "womens",
    women: "womens",
    bottoms: "bottoms",
    lifestyle: "lifestyle",
    hats: "hats",
    hat: "hats",
    "hoodies-sweatshirts": "hoodies-sweatshirts",
    hoodies: "hoodies-sweatshirts",
    sweatshirts: "hoodies-sweatshirts",
    jackets: "jackets",
    jacket: "jackets",
    accessories: "accessories",
    accessory: "accessories",
  };

  function productTypeKeys(card) {
    const keys = new Set();
    [card.dataset.type, card.dataset.category].forEach((value) => {
      const handle = normalize(value);
      if (!handle) return;
      keys.add(TYPE_FILTER[handle] || handle);
    });
    return keys;
  }

  function matchesCategory(cols, active, card) {
    const types = productTypeKeys(card);
    if (types.size) return types.has(active);
    if (cols.includes(active)) return true;
    const alts = FILTER_ALIASES[active] || [];
    return alts.some((a) => cols.includes(a));
  }

  const productFitCache = new Map();

  function productContentBounds(img) {
    const key = img.currentSrc || img.src;
    if (productFitCache.has(key)) return productFitCache.get(key);
    const n = 48;
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(img, 0, 0, n, n);
      const data = ctx.getImageData(0, 0, n, n).data;
      const at = (x, y) => {
        const i = (y * n + x) * 4;
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
      };
      const probes = [at(1, 1), at(n - 2, 1), at(1, n - 2), at(n - 2, n - 2)];
      const bg = probes
        .reduce((sum, px) => [sum[0] + px[0], sum[1] + px[1], sum[2] + px[2]], [0, 0, 0])
        .map((v) => v / probes.length);
      let minX = n;
      let minY = n;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < n; y += 1) {
        for (let x = 0; x < n; x += 1) {
          const i = (y * n + x) * 4;
          const alpha = data[i + 3];
          if (alpha < 18) continue;
          const dist =
            Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
          if (dist < 46) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) {
        productFitCache.set(key, null);
        return null;
      }
      const bounds = {
        w: Math.max(0.08, (maxX - minX + 1) / n),
        h: Math.max(0.08, (maxY - minY + 1) / n),
      };
      productFitCache.set(key, bounds);
      return bounds;
    } catch (_) {
      productFitCache.set(key, null);
      return null;
    }
  }

  function fitProductImage(img) {
    const box = img.closest(".ftw-product__media");
    if (!box || !img.naturalWidth || !img.naturalHeight) return;
    const boxW = box.clientWidth;
    const boxH = box.clientHeight;
    if (!boxW || !boxH) return;
    const bounds = productContentBounds(img);
    if (!bounds) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = boxW / boxH;
    const drawW = imgRatio > boxRatio ? boxW : boxH * imgRatio;
    const drawH = imgRatio > boxRatio ? boxW / imgRatio : boxH;
    const contentW = drawW * bounds.w;
    const contentH = drawH * bounds.h;
    const target = 0.84;
    const scale = Math.min(2.35, Math.max(0.8, Math.min((boxW * target) / contentW, (boxH * target) / contentH)));
    img.style.transform = `scale(${scale})`;
  }

  function fitProductImages() {
    $$(".ftw-product__media img", root).forEach((img) => {
      if (img.complete && img.naturalWidth) {
        fitProductImage(img);
        return;
      }
      if (img.dataset.fitBound) return;
      img.dataset.fitBound = "1";
      img.addEventListener("load", () => fitProductImage(img), { once: true });
    });
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
        show = matchesCategory(cols, active, card);
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
    fitProductImages();
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

  $("#ftw-account-top-btn")?.addEventListener("click", toggleAccountDrawer);
  $$("[data-ftw-account]", root).forEach((btn) => btn.addEventListener("click", toggleAccountDrawer));

  $$("[data-ftw-contact]", root).forEach((btn) =>
    btn.addEventListener("click", () => openDrawer("ftw-contact"))
  );
  $("#ftw-menu-btn")?.addEventListener("click", () => setNavOpen(!root.classList.contains("is-nav-open")));
  $("#ftw-nav-scrim")?.addEventListener("click", () => setNavOpen(false));
  $("#ftw-sheet-add")?.addEventListener("click", addToCart);
  $$("[data-ftw-theme]", root).forEach((btn) =>
    btn.addEventListener("click", () => setTheme(getTheme() === "dark" ? "light" : "dark"))
  );
  $("#ftw-outfit-close")?.addEventListener("click", closeOutfitChecker);
  $("#ftw-outfit-clear")?.addEventListener("click", resetOutfitStage);

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
    if (e.target.closest(".ftw-outfit__piece-kill")) return;

    const resizeHandle = e.target.closest(".ftw-outfit__piece-resize");
    if (resizeHandle) {
      e.preventDefault();
      e.stopPropagation();
      const piece = resizeHandle.closest(".ftw-outfit__piece");
      if (!piece) return;
      selectOutfitPiece(piece);
      const rect = piece.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startDist = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy));
      startOutfitDrag(e, "resize", {
        el: piece,
        cx,
        cy,
        startDist,
        startScale: Number(piece.dataset.scale || 1),
      });
      return;
    }

    const rackItem = e.target.closest(".ftw-outfit__rack-item");
    if (rackItem) {
      e.preventDefault();
      wearOutfitPiece({
        id: rackItem.dataset.outfitId,
        image: rackItem.dataset.outfitSrc,
        title: rackItem.dataset.outfitTitle,
        price: rackItem.dataset.outfitPrice,
        variantId: rackItem.dataset.outfitVariant,
        slot: rackItem.dataset.outfitSlot,
      });
      return;
    }

    const piece = e.target.closest(".ftw-outfit__piece");
    if (piece) {
      e.preventDefault();
      selectOutfitPiece(piece);
      startOutfitDrag(e, "move", {
        el: piece,
        originLeft: parseFloat(piece.style.left) || 0,
        originTop: parseFloat(piece.style.top) || 0,
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
      const piece = pieceKill.closest(".ftw-outfit__piece");
      if (piece === outfitSelected) outfitSelected = null;
      piece?.remove();
      syncOutfitLists();
      return;
    }

    const outfitAdd = e.target.closest("[data-outfit-add]");
    if (outfitAdd) {
      const variantId = outfitAdd.dataset.outfitAdd;
      if (!variantId) return;
      addVariantToCart(variantId, { openBag: false, sourceBtn: outfitAdd }).then((ok) => {
        if (ok) {
          outfitAdd.textContent = "ADDED";
          outfitAdd.disabled = true;
        } else {
          outfitAdd.disabled = false;
          outfitAdd.textContent = "ADD TO CART";
        }
      });
      return;
    }

    if (e.target.closest("#ftw-outfit-stage") && !e.target.closest(".ftw-outfit__piece")) {
      selectOutfitPiece(null);
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

  /* —— Mobile lock intro —— */
  const LOCK_KEY = "ftw-unlocked";
  const lockEl = $("#ftw-lock");
  const lockKnob = $("#ftw-lock-knob");
  const lockSlider = $("#ftw-lock-slider");
  const mobileMq = window.matchMedia("(max-width: 720px)");
  let lockDrag = null;
  let lockClockTimer = null;

  function wasUnlocked() {
    try {
      return sessionStorage.getItem(LOCK_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markUnlocked() {
    try {
      sessionStorage.setItem(LOCK_KEY, "1");
    } catch (_) {}
  }

  function syncLockClock() {
    const clock = $("#ftw-lock-clock");
    const dateEl = $("#ftw-lock-date");
    if (!clock || !dateEl) return;
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    dateEl.textContent = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function setLockProgress(px, maxX) {
    const x = Math.max(0, Math.min(px, maxX));
    const p = maxX > 0 ? x / maxX : 0;
    lockEl?.style.setProperty("--ftw-lock-x", `${x}px`);
    lockEl?.style.setProperty("--ftw-lock-p", String(p));
    if (lockKnob) lockKnob.style.transform = `translateX(${x}px)`;
    lockSlider?.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    return { x, p, maxX };
  }

  function resetLockKnob() {
    if (!lockKnob || !lockEl) return;
    lockKnob.style.transition = "transform 200ms var(--ftw-ease)";
    setLockProgress(0, 1);
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (lockKnob) lockKnob.style.transition = "";
      }, 220);
    });
  }

  function dismissLock() {
    if (!lockEl || lockEl.hidden) return;
    markUnlocked();
    lockEl.classList.add("is-unlocking");
    document.body.classList.remove("ftw-locked");
    if (lockClockTimer) {
      clearInterval(lockClockTimer);
      lockClockTimer = null;
    }
    setTimeout(() => {
      lockEl.hidden = true;
      lockEl.classList.remove("is-unlocking");
    }, 280);
  }

  function showLock() {
    if (!lockEl || !mobileMq.matches || wasUnlocked()) {
      if (lockEl) lockEl.hidden = true;
      document.body.classList.remove("ftw-locked");
      return;
    }
    lockEl.hidden = false;
    document.body.classList.add("ftw-locked");
    syncLockClock();
    setLockProgress(0, 1);
    if (lockClockTimer) clearInterval(lockClockTimer);
    lockClockTimer = setInterval(syncLockClock, 30000);
  }

  function lockMaxX() {
    const track = lockEl?.querySelector(".ftw-lock__track");
    if (!track || !lockKnob) return 0;
    return Math.max(0, track.clientWidth - lockKnob.offsetWidth - 6);
  }

  lockKnob?.addEventListener("pointerdown", (e) => {
    if (!mobileMq.matches || lockEl?.hidden) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const maxX = lockMaxX();
    const startX = e.clientX;
    const current = Number.parseFloat(getComputedStyle(lockEl).getPropertyValue("--ftw-lock-x")) || 0;
    lockDrag = { pointerId: e.pointerId, startX, origin: current, maxX };
    lockKnob.style.transition = "";
    try {
      lockKnob.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  lockKnob?.addEventListener("pointermove", (e) => {
    if (!lockDrag || e.pointerId !== lockDrag.pointerId) return;
    const dx = e.clientX - lockDrag.startX;
    setLockProgress(lockDrag.origin + dx, lockDrag.maxX);
  });

  function endLockDrag(e) {
    if (!lockDrag || (e && e.pointerId !== lockDrag.pointerId)) return;
    const maxX = lockDrag.maxX || lockMaxX();
    const x = Number.parseFloat(getComputedStyle(lockEl).getPropertyValue("--ftw-lock-x")) || 0;
    const { p } = setLockProgress(x, maxX);
    lockDrag = null;
    if (p >= 0.72) {
      setLockProgress(maxX, maxX);
      dismissLock();
    } else {
      resetLockKnob();
    }
  }

  lockKnob?.addEventListener("pointerup", endLockDrag);
  lockKnob?.addEventListener("pointercancel", endLockDrag);

  lockSlider?.addEventListener("keydown", (e) => {
    if (lockEl?.hidden) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      dismissLock();
    }
  });

  lockEl?.querySelector(".ftw-lock__hint")?.addEventListener("click", dismissLock);
  lockEl?.addEventListener("dblclick", dismissLock);

  const onMobileChange = () => {
    if (mobileMq.matches) showLock();
    else {
      if (lockEl) lockEl.hidden = true;
      document.body.classList.remove("ftw-locked");
    }
  };

  if (mobileMq.addEventListener) mobileMq.addEventListener("change", onMobileChange);
  else mobileMq.addListener?.(onMobileChange);

  showLock();
  fitProductImages();
  window.addEventListener("resize", () => fitProductImages());
})();
