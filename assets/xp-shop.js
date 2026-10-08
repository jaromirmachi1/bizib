/* BIZIBOIZ XP — Shopify window manager + cart */
(() => {
  const root = document.querySelector(".xp-desktop");
  if (!root) return;

  const routes = window.routes || {};
  const cartAddUrl = routes.cart_add_url || "/cart/add";
  const cartUrl = routes.cart_url || "/cart.js";
  const moneyFormat = root.dataset.moneyFormat || "{{amount}}";

  let zTop = 40;
  let dragState = null;
  let selectedSize = "M";
  let selectedVariantId = null;
  let iconDrag = null;
  let marqueeState = null;
  let suppressIconClick = false;

  const ICON_W = 86;
  const ICON_H = 78;
  const ICON_GAP = 10;
  const DRAG_THRESHOLD = 4;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

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

  async function renderCart() {
    const body = $("#cart-body");
    if (!body) return;
    try {
      const cart = await fetchCart();
      updateTrayCart(cart.item_count);
      if (!cart.item_count) {
        body.innerHTML = `<div class="cart-empty">BAG EMPTY.<br>Secure a piece from the live drop.</div>`;
        return;
      }
      body.innerHTML = `
        <table class="cart-table">
          <thead><tr><th>Piece</th><th>Qty</th><th>Price</th></tr></thead>
          <tbody>
            ${cart.items
              .map(
                (i) => `<tr>
                <td>${i.product_title}${i.variant_title && i.variant_title !== "Default Title" ? ` — ${i.variant_title}` : ""}</td>
                <td>${i.quantity}</td>
                <td>${formatMoney(i.final_line_price)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="cart-footer">
          <strong>TOTAL: ${formatMoney(cart.total_price)}</strong>
          <a class="xp-btn xp-btn--primary" href="/checkout">SECURE THE BAG</a>
        </div>`;
    } catch (err) {
      body.innerHTML = `<div class="cart-empty">Couldn't load bag. Try again.</div>`;
    }
  }

  function openProductFromEl(el) {
    if (el.dataset.sold === "1") {
      toast("TOO SLOW. That one already cooked.");
      return;
    }
    const title = el.dataset.title || "DROP";
    const price = el.dataset.price || "";
    const image = el.dataset.image || "";
    const available = el.dataset.available === "1";
    selectedVariantId = el.dataset.variantId || null;
    selectedSize = "M";

    $("#product-titlebar").textContent = `${title.toUpperCase()} — DROP`;
    $("#product-body").innerHTML = `
      <div class="detail">
        <div class="detail__media">
          ${image ? `<img src="${image}" alt="" style="max-width:100%;max-height:280px;object-fit:contain">` : "BB"}
        </div>
        <div class="detail__info">
          <div class="detail__tag">${available ? "LIMITED" : "SOLD OUT"}</div>
          <h2>${title}</h2>
          <div class="detail__price">${price}</div>
          <p class="detail__meta">BIZIBOIZ DROP<br>Path: C:\\DROPS\\LIVE\\</p>
          ${
            available
              ? `<button class="xp-btn xp-btn--primary" type="button" id="add-cart">ADD TO BAG</button>`
              : `<button class="xp-btn" type="button" disabled>SOLD OUT</button>`
          }
          <p style="margin-top:12px"><a href="${el.dataset.url || "#"}" style="color:#245edb">Pick size / full page →</a></p>
        </div>
      </div>`;
    openWindow("product");
  }

  async function addToCart() {
    const id = selectedVariantId;
    if (!id) {
      toast("No variant. Open full product page.");
      return;
    }
    try {
      const res = await fetch(cartAddUrl + ".js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ items: [{ id: Number(id), quantity: 1 }] }),
      });
      if (!res.ok) throw new Error("add failed");
      toast("IN THE BAG.");
      await renderCart();
      openWindow("cart");
    } catch {
      toast("Couldn't add. Try full product page.");
    }
  }

  function syncTaskbar() {
    const bar = $("#task-buttons");
    if (!bar) return;
    const openWins = $$(".xp-window").filter((w) => !w.hidden);
    bar.innerHTML = openWins
      .map((w) => {
        const id = w.dataset.window;
        const title = $(".xp-titlebar__text", w)?.textContent || id;
        const active = w.classList.contains("is-active") ? " is-active" : "";
        return `<button class="task-btn${active}" type="button" data-focus="${id}">${title}</button>`;
      })
      .join("");
  }

  function focusWindow(id) {
    const win = $(`#win-${id}`);
    if (!win || win.hidden) return;
    win.classList.remove("is-minimized");
    $$(".xp-window").forEach((w) => w.classList.remove("is-active"));
    win.classList.add("is-active");
    zTop += 1;
    win.style.zIndex = String(zTop);
    syncTaskbar();
  }

  function openWindow(id) {
    const win = $(`#win-${id}`);
    if (!win) return;
    win.hidden = false;
    win.classList.remove("is-minimized");
    focusWindow(id);
    if (id === "cart") renderCart();
  }

  function closeWindow(id) {
    const win = $(`#win-${id}`);
    if (!win) return;
    win.hidden = true;
    win.classList.remove("is-active", "is-minimized");
    syncTaskbar();
  }

  function minimizeWindow(id) {
    const win = $(`#win-${id}`);
    if (!win) return;
    win.classList.add("is-minimized");
    win.classList.remove("is-active");
    syncTaskbar();
  }

  function maximizeWindow(id) {
    const win = $(`#win-${id}`);
    if (!win) return;
    if (win.dataset.maxed === "1") {
      win.style.left = win.dataset.prevLeft || "120px";
      win.style.top = win.dataset.prevTop || "40px";
      win.style.width = win.dataset.prevW || "720px";
      win.style.height = win.dataset.prevH || "460px";
      win.dataset.maxed = "0";
    } else {
      win.dataset.prevLeft = win.style.left;
      win.dataset.prevTop = win.style.top;
      win.dataset.prevW = win.style.width;
      win.dataset.prevH = win.style.height;
      win.style.left = "0px";
      win.style.top = "0px";
      win.style.width = "100%";
      win.style.height = `calc(100% - var(--taskbar-h))`;
      win.dataset.maxed = "1";
    }
    focusWindow(id);
  }

  function setAccountMenu(open) {
    const menu = $("#account-menu");
    const btn = $("#start-btn");
    if (!menu || !btn) return;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
      menu.style.animation = "none";
      void menu.offsetWidth;
      menu.style.animation = "";
    }
  }

  function setAccountTab(id) {
    const menu = $("#account-menu");
    if (!menu) return;
    $$("[data-account-tab]", menu).forEach((tab) => {
      const on = tab.dataset.accountTab === id;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", String(on));
    });
    $$("[data-account-panel]", menu).forEach((panel) => {
      const on = panel.dataset.accountPanel === id;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
  }

  function ensureMarquee() {
    let box = $(".desk-marquee", root);
    if (box) return box;
    box = document.createElement("div");
    box.className = "desk-marquee";
    box.hidden = true;
    root.appendChild(box);
    return box;
  }

  function clearIconSelection() {
    $$(".desk-icon.is-selected", root).forEach((el) => el.classList.remove("is-selected"));
  }

  function clampIconPos(left, top) {
    const maxL = Math.max(0, root.clientWidth - ICON_W);
    const maxT = Math.max(0, root.clientHeight - 30 - ICON_H);
    return {
      left: Math.max(0, Math.min(maxL, left)),
      top: Math.max(0, Math.min(maxT, top)),
    };
  }

  function layoutDesktopIcons() {
    const grid = $(".icon-grid", root);
    if (!grid) return;
    try {
      localStorage.removeItem("biziboiz-icon-pos");
    } catch (_) {}
    $$(".desk-icon", grid).forEach((icon, i) => {
      const label = $(".desk-icon__label", icon)?.textContent?.trim() || `icon-${i}`;
      icon.dataset.iconId = label.toLowerCase().replace(/\s+/g, "-");
      const placed = clampIconPos(8, 12 + i * (ICON_H + ICON_GAP));
      icon.style.left = `${placed.left}px`;
      icon.style.top = `${placed.top}px`;
    });
  }

  function rectsIntersect(a, b) {
    return !(
      a.right < b.left ||
      a.left > b.right ||
      a.bottom < b.top ||
      a.top > b.bottom
    );
  }

  function updateMarqueeSelection(boxRect) {
    const desk = root.getBoundingClientRect();
    const sel = {
      left: desk.left + boxRect.left,
      top: desk.top + boxRect.top,
      right: desk.left + boxRect.left + boxRect.width,
      bottom: desk.top + boxRect.top + boxRect.height,
    };
    $$(".desk-icon", root).forEach((icon) => {
      const r = icon.getBoundingClientRect();
      icon.classList.toggle(
        "is-selected",
        rectsIntersect(sel, {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
        })
      );
    });
  }

  $("#start-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = $("#account-menu");
    setAccountMenu(!!menu?.hidden);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".xp-desktop")) return;

    if (suppressIconClick) {
      e.preventDefault();
      e.stopPropagation();
      suppressIconClick = false;
      return;
    }

    const tab = e.target.closest("[data-account-tab]");
    if (tab) {
      e.preventDefault();
      setAccountTab(tab.dataset.accountTab);
      return;
    }

    if (!e.target.closest("#account-menu") && !e.target.closest("#start-btn")) {
      setAccountMenu(false);
    }

    const openBtn = e.target.closest("[data-open]");
    if (openBtn) {
      e.preventDefault();
      setAccountMenu(false);
      openWindow(openBtn.dataset.open);
      return;
    }

    const product = e.target.closest("[data-product]");
    if (product) {
      e.preventDefault();
      openProductFromEl(product);
      return;
    }

    const sizeBtn = e.target.closest("[data-size]");
    if (sizeBtn) {
      selectedSize = sizeBtn.dataset.size;
      $$("#size-row button").forEach((b) => b.classList.remove("is-selected"));
      sizeBtn.classList.add("is-selected");
      return;
    }

    if (e.target.closest("#add-cart")) {
      addToCart();
      return;
    }

    const focusBtn = e.target.closest("[data-focus]");
    if (focusBtn) {
      const id = focusBtn.dataset.focus;
      const win = $(`#win-${id}`);
      if (win?.classList.contains("is-minimized") || win?.hidden) openWindow(id);
      else focusWindow(id);
      return;
    }

    const win = e.target.closest(".xp-window");
    if (win && !win.hidden) focusWindow(win.dataset.window);

    if (e.target.closest("[data-close]")) {
      closeWindow(e.target.closest(".xp-window").dataset.window);
      return;
    }
    if (e.target.closest("[data-min]")) {
      minimizeWindow(e.target.closest(".xp-window").dataset.window);
      return;
    }
    if (e.target.closest("[data-max]")) {
      maximizeWindow(e.target.closest(".xp-window").dataset.window);
      return;
    }

  });

  let selectedWallpaper = $(".wallpaper-tile.is-active", root)?.dataset.wallpaper || null;

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".xp-desktop")) return;
    const tile = e.target.closest("[data-wallpaper]");
    if (!tile || !tile.closest("#win-wallpaper")) return;
    $$(".wallpaper-tile", root).forEach((t) => t.classList.remove("is-active"));
    tile.classList.add("is-active");
    selectedWallpaper = tile.dataset.wallpaper;
  });

  $("#wallpaper-apply")?.addEventListener("click", () => {
    if (!selectedWallpaper) return;
    root.style.setProperty("--xp-wallpaper", `url("${selectedWallpaper}")`);
    try {
      localStorage.setItem("biziboiz-wallpaper", selectedWallpaper);
    } catch (_) {}
    toast("WALLPAPER SET. FOR THE WIN.");
  });

  try {
    const savedWp = localStorage.getItem("biziboiz-wallpaper");
    if (savedWp) {
      root.style.setProperty("--xp-wallpaper", `url("${savedWp}")`);
      selectedWallpaper = savedWp;
      $$(".wallpaper-tile", root).forEach((t) => {
        t.classList.toggle("is-active", t.dataset.wallpaper === savedWp);
      });
    }
  } catch (_) {}

  $("#contact-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    toast("MESSAGE QUEUED. We'll hit you back.");
    e.target.reset();
  });

  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".xp-desktop")) return;
    if (e.button != null && e.button !== 0) return;

    const bar = e.target.closest("[data-drag]");
    if (bar && !e.target.closest(".xp-ctrl")) {
      const win = bar.closest(".xp-window");
      if (win && win.dataset.maxed !== "1") {
        focusWindow(win.dataset.window);
        const rect = win.getBoundingClientRect();
        dragState = { win, ox: e.clientX - rect.left, oy: e.clientY - rect.top };
        return;
      }
    }

    if (e.target.closest(".xp-window, .taskbar, .account-menu, .xp-toast")) return;

    const icon = e.target.closest(".desk-icon");
    if (icon) {
      const additive = e.metaKey || e.ctrlKey;
      if (additive) {
        icon.classList.toggle("is-selected");
      } else if (!icon.classList.contains("is-selected")) {
        clearIconSelection();
        icon.classList.add("is-selected");
      }
      const selected = $$(".desk-icon.is-selected", root);
      const movers = selected.length ? selected : [icon];
      iconDrag = {
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        items: movers.map((el) => ({
          el,
          x: parseInt(el.style.left, 10) || 0,
          y: parseInt(el.style.top, 10) || 0,
        })),
      };
      movers.forEach((el) => el.classList.add("is-dragging"));
      e.preventDefault();
      return;
    }

    clearIconSelection();
    const desk = root.getBoundingClientRect();
    const x = e.clientX - desk.left;
    const y = e.clientY - desk.top;
    const box = ensureMarquee();
    marqueeState = { x0: x, y0: y };
    box.hidden = false;
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = "0px";
    box.style.height = "0px";
    e.preventDefault();
  });

  document.addEventListener("pointermove", (e) => {
    if (dragState) {
      const { win, ox, oy } = dragState;
      win.style.left = `${Math.max(0, e.clientX - ox)}px`;
      win.style.top = `${Math.max(0, e.clientY - oy)}px`;
      return;
    }

    if (iconDrag) {
      const dx = e.clientX - iconDrag.startX;
      const dy = e.clientY - iconDrag.startY;
      if (!iconDrag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      iconDrag.moved = true;
      suppressIconClick = true;
      iconDrag.items.forEach(({ el, x, y }) => {
        const next = clampIconPos(x + dx, y + dy);
        el.style.left = `${next.left}px`;
        el.style.top = `${next.top}px`;
      });
      return;
    }

    if (marqueeState) {
      const desk = root.getBoundingClientRect();
      const x = e.clientX - desk.left;
      const y = e.clientY - desk.top;
      const left = Math.min(marqueeState.x0, x);
      const top = Math.min(marqueeState.y0, y);
      const width = Math.abs(x - marqueeState.x0);
      const height = Math.abs(y - marqueeState.y0);
      const box = ensureMarquee();
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      updateMarqueeSelection({ left, top, width, height });
    }
  });

  document.addEventListener("pointerup", () => {
    if (iconDrag) {
      iconDrag.items.forEach(({ el }) => el.classList.remove("is-dragging"));
      iconDrag = null;
    }
    if (marqueeState) {
      const box = ensureMarquee();
      box.hidden = true;
      marqueeState = null;
    }
    dragState = null;
  });

  layoutDesktopIcons();
  updateTrayCart(Number(root.dataset.cartCount || 0));
  renderCart();
  openWindow("shop2026");
  maximizeWindow("shop2026");
})();
