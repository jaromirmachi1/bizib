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
            <img class="product-thumb__img" src="../assets/panacek_2.png" alt="" width="168" height="210">
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
    $("#start-menu").hidden = true;
    $("#start-btn").setAttribute("aria-expanded", "false");
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

  // events
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open]");
    if (openBtn) {
      e.preventDefault();
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

    if (!e.target.closest("#start-menu") && !e.target.closest("#start-btn")) {
      $("#start-menu").hidden = true;
      $("#start-btn").setAttribute("aria-expanded", "false");
    }
  });

  $("#start-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = $("#start-menu");
    const open = menu.hidden;
    menu.hidden = !open;
    $("#start-btn").setAttribute("aria-expanded", String(open));
  });

  $("#log-off").addEventListener("click", () => {
    toast("LOCKED OUT. Hit start if you still got it.");
    $("#start-menu").hidden = true;
  });

  $("#turn-off").addEventListener("click", () => {
    document.body.style.background = "#000";
    $("#desktop").style.opacity = "0";
    setTimeout(() => {
      $("#desktop").style.opacity = "1";
      toast("NAH. BIZIBOIZ NEVER SLEEPS.");
    }, 700);
    $("#start-menu").hidden = true;
  });

  $("#contact-form").addEventListener("submit", (e) => {
    e.preventDefault();
    toast("MESSAGE SENT INTO THE VOID. We'll hit you back.");
    e.target.reset();
  });

  // drag windows
  document.addEventListener("pointerdown", (e) => {
    const bar = e.target.closest("[data-drag]");
    if (!bar || e.target.closest(".xp-ctrl")) return;
    const win = bar.closest(".xp-window");
    if (!win || win.dataset.maxed === "1") return;
    focusWindow(win.dataset.window);
    const rect = win.getBoundingClientRect();
    dragState = {
      win,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
    };
    win.setPointerCapture?.(e.pointerId);
  });

  document.addEventListener("pointermove", (e) => {
    if (!dragState) return;
    const { win, ox, oy } = dragState;
    const x = Math.max(0, e.clientX - ox);
    const y = Math.max(0, e.clientY - oy);
    win.style.left = `${x}px`;
    win.style.top = `${y}px`;
  });

  document.addEventListener("pointerup", () => {
    dragState = null;
  });

  // boot
  renderGrids();
  renderCart();
  updateTrayCart();
  toast("DROP IS LIVE. HIT NEW DROP.");
})();
