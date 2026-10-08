/* BIZIBOIZ XP shop — window manager + catalog */
(() => {
  const PRODUCTS = {
    2026: [
      { id: "t26-1", name: "FTW Box Tee", price: 1290, tag: "01", status: "live" },
      { id: "t26-2", name: "Shadow Hoodie", price: 2490, tag: "02", status: "live" },
      { id: "t26-3", name: "Alcatraz Cap", price: 790, tag: "03", status: "hot" },
      { id: "t26-4", name: "Night Crew", price: 1890, tag: "04", status: "live" },
      { id: "t26-5", name: "Track Suit Bottom", price: 2190, tag: "05", status: "live" },
      { id: "t26-6", name: "Zip Shell", price: 2690, tag: "06", status: "hot" },
      { id: "t26-7", name: "Longsleeve Stamp", price: 1490, tag: "07", status: "live" },
      { id: "t26-8", name: "Beanie Blackout", price: 690, tag: "08", status: "sold" },
    ],
    2025: [
      { id: "t25-1", name: "Deadstock Tee", price: 990, tag: "A1", status: "archive" },
      { id: "t25-2", name: "Old Money LS", price: 1190, tag: "A2", status: "archive" },
      { id: "t25-3", name: "Vault Zip", price: 2290, tag: "A3", status: "sold" },
      { id: "t25-4", name: "Camp Cap Dirty", price: 690, tag: "A4", status: "archive" },
      { id: "t25-5", name: "Matchday Jersey", price: 1590, tag: "A5", status: "archive" },
      { id: "t25-6", name: "Bootleg Tote", price: 490, tag: "A6", status: "archive" },
    ],
  };

  const money = (n) =>
    new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
      maximumFractionDigits: 0,
    }).format(n);

  const cart = [];
  let zTop = 40;
  let dragState = null;
  let selectedSize = "M";
  let iconDrag = null;
  let marqueeState = null;
  let suppressIconClick = false;

  const ICON_W = 86;
  const ICON_H = 78;
  const ICON_GAP = 10;
  const DRAG_THRESHOLD = 4;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function toast(msg) {
    const el = $("#toast");
    $("#toast-body").textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-on"), 2200);
  }

  function cartCount() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function updateTrayCart() {
    const countEl = $("#cart-count");
    if (!countEl) return;
    countEl.textContent = String(cartCount());
  }

  function findProduct(id) {
    for (const year of Object.keys(PRODUCTS)) {
      const hit = PRODUCTS[year].find((p) => p.id === id);
      if (hit) return { ...hit, year };
    }
    return null;
  }

  function renderGrids() {
    for (const year of ["2026", "2025"]) {
      const grid = $(`#grid-${year}`);
      if (!grid) continue;
      grid.innerHTML = PRODUCTS[year]
        .map(
          (p) => `
        <button class="product-item" type="button" data-product="${p.id}" ${
            p.status === "sold" ? 'data-sold="1"' : ""
          }>
          <div class="product-thumb ${p.status === "sold" ? "is-sold" : ""}">
            <img class="product-thumb__img" src="./assets/panacek_2.png" alt="" width="168" height="210">
          </div>
          <div class="product-name">${p.name}</div>
          <div class="product-price">${
            p.status === "sold" ? "SOLD OUT" : money(p.price)
          }</div>
        </button>`
        )
        .join("");
    }
  }

  function renderCart() {
    const body = $("#cart-body");
    if (!cart.length) {
      body.innerHTML = `<div class="cart-empty">BAG EMPTY.<br>Secure a piece from the live drop.</div>`;
      return;
    }
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    body.innerHTML = `
      <table class="cart-table">
        <thead>
          <tr><th>Piece</th><th>Size</th><th>Qty</th><th>Price</th></tr>
        </thead>
        <tbody>
          ${cart
            .map(
              (i) => `<tr>
              <td>${i.name}</td>
              <td>${i.size}</td>
              <td>${i.qty}</td>
              <td>${money(i.price * i.qty)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div class="cart-footer">
        <strong>TOTAL: ${money(total)}</strong>
        <button class="xp-btn xp-btn--primary" type="button" id="checkout-btn">SECURE THE BAG</button>
      </div>`;
    $("#checkout-btn")?.addEventListener("click", () => {
      toast("ALMOST. Wire Shopify to take real money.");
    });
  }

  function openProduct(id) {
    const p = findProduct(id);
    if (!p) return;
    if (p.status === "sold") {
      toast("TOO SLOW. That one already cooked.");
      return;
    }
    selectedSize = "M";
    $("#product-titlebar").textContent = `${p.name.toUpperCase()} — DROP #${p.tag}`;
    $("#product-body").innerHTML = `
      <div class="detail">
        <div class="detail__media">#${p.tag}<small>${p.year} DROP</small></div>
        <div class="detail__info">
          <div class="detail__tag">${p.status === "hot" ? "GOING FAST" : "LIMITED"}</div>
          <h2>${p.name}</h2>
          <div class="detail__price">${money(p.price)}</div>
          <p class="detail__meta">Season: ${p.year}<br>Status: ${String(p.status).toUpperCase()}<br>Path: C:\\DROPS\\${p.year}\\</p>
          <div class="size-row" id="size-row">
            ${["S", "M", "L", "XL"]
              .map(
                (s) =>
                  `<button type="button" data-size="${s}" class="${
                    s === "M" ? "is-selected" : ""
                  }">${s}</button>`
              )
              .join("")}
          </div>
          <button class="xp-btn xp-btn--primary" type="button" id="add-cart" data-id="${p.id}">
            ADD TO BAG
          </button>
        </div>
      </div>`;
    openWindow("product");
  }

  function addToCart(id) {
    const p = findProduct(id);
    if (!p) return;
    const existing = cart.find((c) => c.id === id && c.size === selectedSize);
    if (existing) existing.qty += 1;
    else cart.push({ ...p, size: selectedSize, qty: 1 });
    renderCart();
    updateTrayCart();
    toast(`${p.name.toUpperCase()} (${selectedSize}) — IN THE BAG.`);
    openWindow("cart");
  }

  function syncTaskbar() {
    const bar = $("#task-buttons");
    const openWins = $$(".xp-window").filter((w) => !w.hidden);
    bar.innerHTML = openWins
      .map((w) => {
        const id = w.dataset.window;
        const title = $(".xp-titlebar__text", w)?.textContent || id;
        const active = w.classList.contains("is-active") ? " is-active" : "";
        const minimized = w.classList.contains("is-minimized") ? "" : "";
        void minimized;
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

  $("#start-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = $("#account-menu");
    setAccountMenu(!!menu?.hidden);
  });

  function desktopEl() {
    return $("#desktop");
  }

  function ensureMarquee() {
    let box = $(".desk-marquee");
    if (box) return box;
    box = document.createElement("div");
    box.className = "desk-marquee";
    box.hidden = true;
    desktopEl()?.appendChild(box);
    return box;
  }

  function clearIconSelection() {
    $$(".desk-icon.is-selected").forEach((el) => el.classList.remove("is-selected"));
  }

  function clampIconPos(left, top) {
    const desk = desktopEl();
    if (!desk) return { left, top };
    const maxL = Math.max(0, desk.clientWidth - ICON_W);
    const maxT = Math.max(0, desk.clientHeight - 30 - ICON_H);
    return {
      left: Math.max(0, Math.min(maxL, left)),
      top: Math.max(0, Math.min(maxT, top)),
    };
  }

  function layoutDesktopIcons() {
    const grid = $(".icon-grid");
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
    const desk = desktopEl().getBoundingClientRect();
    const sel = {
      left: desk.left + boxRect.left,
      top: desk.top + boxRect.top,
      right: desk.left + boxRect.left + boxRect.width,
      bottom: desk.top + boxRect.top + boxRect.height,
    };
    $$(".desk-icon").forEach((icon) => {
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

  // events
  document.addEventListener("click", (e) => {
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
      openProduct(product.dataset.product);
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
      addToCart(e.target.closest("#add-cart").dataset.id);
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

  $("#account-open")?.addEventListener("click", () => {
    toast("ACCOUNT SETTINGS — preview only.");
  });

  $("#account-addresses")?.addEventListener("click", () => {
    toast("ADDRESSES — preview only.");
  });

  $("#account-orders-all")?.addEventListener("click", () => {
    toast("ALL ORDERS — preview only.");
  });

  $("#account-logout")?.addEventListener("click", () => {
    toast("LOCKED OUT. Hit account to come back.");
    setAccountMenu(false);
  });

  let selectedWallpaper = $(".wallpaper-tile.is-active")?.dataset.wallpaper || null;

  document.addEventListener("click", (e) => {
    const tile = e.target.closest("[data-wallpaper]");
    if (!tile || !tile.closest("#win-wallpaper")) return;
    $$(".wallpaper-tile").forEach((t) => t.classList.remove("is-active"));
    tile.classList.add("is-active");
    selectedWallpaper = tile.dataset.wallpaper;
  });

  $("#wallpaper-apply")?.addEventListener("click", () => {
    if (!selectedWallpaper) return;
    const desk = desktopEl();
    if (!desk) return;
    desk.style.setProperty("--xp-wallpaper", `url("${selectedWallpaper}")`);
    try {
      localStorage.setItem("biziboiz-wallpaper", selectedWallpaper);
    } catch (_) {}
    toast("WALLPAPER SET. FOR THE WIN.");
  });

  try {
    const savedWp = localStorage.getItem("biziboiz-wallpaper");
    if (savedWp) {
      desktopEl()?.style.setProperty("--xp-wallpaper", `url("${savedWp}")`);
      selectedWallpaper = savedWp;
      $$(".wallpaper-tile").forEach((t) => {
        t.classList.toggle("is-active", t.dataset.wallpaper === savedWp);
      });
    }
  } catch (_) {}

  $("#contact-form").addEventListener("submit", (e) => {
    e.preventDefault();
    toast("MESSAGE SENT INTO THE VOID. We'll hit you back.");
    e.target.reset();
  });

  // drag windows + desktop icons + marquee
  document.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;

    const bar = e.target.closest("[data-drag]");
    if (bar && !e.target.closest(".xp-ctrl")) {
      const win = bar.closest(".xp-window");
      if (win && win.dataset.maxed !== "1") {
        focusWindow(win.dataset.window);
        const rect = win.getBoundingClientRect();
        dragState = {
          win,
          ox: e.clientX - rect.left,
          oy: e.clientY - rect.top,
        };
        win.setPointerCapture?.(e.pointerId);
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
      const selected = $$(".desk-icon.is-selected");
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

    if (!e.target.closest(".desktop")) return;
    clearIconSelection();
    const desk = desktopEl().getBoundingClientRect();
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
      const x = Math.max(0, e.clientX - ox);
      const y = Math.max(0, e.clientY - oy);
      win.style.left = `${x}px`;
      win.style.top = `${y}px`;
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
      const desk = desktopEl().getBoundingClientRect();
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

  // boot
  layoutDesktopIcons();
  renderGrids();
  renderCart();
  updateTrayCart();
  openWindow("shop2026");
  maximizeWindow("shop2026");
})();
