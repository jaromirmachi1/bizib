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
    const menu = $("#start-menu");
    if (menu) menu.hidden = true;
    $("#start-btn")?.setAttribute("aria-expanded", "false");
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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".xp-desktop")) return;

    const openBtn = e.target.closest("[data-open]");
    if (openBtn) {
      e.preventDefault();
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

    if (!e.target.closest("#start-menu") && !e.target.closest("#start-btn")) {
      const menu = $("#start-menu");
      if (menu) menu.hidden = true;
      $("#start-btn")?.setAttribute("aria-expanded", "false");
    }
  });

  $("#start-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = $("#start-menu");
    if (!menu) return;
    const open = menu.hidden;
    menu.hidden = !open;
    $("#start-btn").setAttribute("aria-expanded", String(open));
  });

  $("#log-off")?.addEventListener("click", () => {
    toast("LOCKED OUT. Hit account if you still got it.");
    $("#start-menu").hidden = true;
  });

  $("#turn-off")?.addEventListener("click", () => {
    const desktop = $("#desktop") || root;
    desktop.style.opacity = "0";
    setTimeout(() => {
      desktop.style.opacity = "1";
      toast("NAH. BIZIBOIZ NEVER SLEEPS.");
    }, 700);
    $("#start-menu").hidden = true;
  });

  $("#contact-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    toast("MESSAGE QUEUED. We'll hit you back.");
    e.target.reset();
  });

  document.addEventListener("pointerdown", (e) => {
    const bar = e.target.closest("[data-drag]");
    if (!bar || e.target.closest(".xp-ctrl")) return;
    const win = bar.closest(".xp-window");
    if (!win || win.dataset.maxed === "1") return;
    focusWindow(win.dataset.window);
    const rect = win.getBoundingClientRect();
    dragState = { win, ox: e.clientX - rect.left, oy: e.clientY - rect.top };
  });

  document.addEventListener("pointermove", (e) => {
    if (!dragState) return;
    const { win, ox, oy } = dragState;
    win.style.left = `${Math.max(0, e.clientX - ox)}px`;
    win.style.top = `${Math.max(0, e.clientY - oy)}px`;
  });

  document.addEventListener("pointerup", () => {
    dragState = null;
  });

  updateTrayCart(Number(root.dataset.cartCount || 0));
  renderCart();
  toast("DROP IS LIVE. HIT NEW DROP.");
})();
