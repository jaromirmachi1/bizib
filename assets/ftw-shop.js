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
        body.innerHTML = `<div class="ftw-empty">CART EMPTY.</div>`;
        return;
      }
      body.innerHTML = `
        <table class="cart-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
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
          <a class="ftw-btn ftw-btn--primary" href="/checkout">CHECKOUT</a>
        </div>`;
    } catch {
      body.innerHTML = `<div class="ftw-empty">Couldn't load cart.</div>`;
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

  function applyFilters() {
    const q = searchQuery.trim().toLowerCase();
    let visible = 0;
    $$(".ftw-product", root).forEach((card) => {
      const drop = card.dataset.drop || "new";
      const filter = normalize(card.dataset.filter);
      const title = (card.dataset.title || card.textContent || "").toLowerCase();
      let show = true;

      if (activeFilter === "archive") {
        show = drop === "archive";
      } else if (activeFilter === "all" || activeFilter === "new") {
        show = drop !== "archive";
      } else {
        show = filter === normalize(activeFilter) || title.includes(activeFilter.replace(/-/g, " "));
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
      empty.textContent = q ? "NO MATCHES." : "NO PRODUCTS IN THIS SECTION.";
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

  function openSheet(card) {
    const sheet = $("#ftw-sheet");
    if (!sheet || !card) return;

    closeDrawers();
    setNavOpen(false);

    const title = card.dataset.title || "";
    const price = card.dataset.price || "";
    const image = card.dataset.image || card.querySelector("img")?.src || "";
    const desc = card.dataset.description || "";
    const available = card.dataset.available !== "0";
    const variants = parseVariants(card.dataset.variants);
    sheetVariants = variants;

    $("#ftw-sheet-title").textContent = title;
    $("#ftw-sheet-price").textContent = available ? price : "SOLD OUT";
    $("#ftw-sheet-desc").textContent = desc || "Limited drop. No restocks.";
    const img = $("#ftw-sheet-image");
    img.src = image;
    img.alt = title;

    const sizes = $("#ftw-sheet-sizes");
    const addBtn = $("#ftw-sheet-add");
    sizes.innerHTML = "";

    const usable = variants.filter((v) => v.title && v.title !== "Default Title");
    if (usable.length > 1) {
      sizes.hidden = false;
      usable.forEach((v, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ftw-sheet__size";
        btn.textContent = v.title;
        btn.disabled = !v.available;
        btn.dataset.variantId = String(v.id);
        if (v.available && (String(v.id) === card.dataset.variantId || i === 0)) {
          btn.classList.add("is-active");
          selectedVariantId = v.id;
          if (v.price) $("#ftw-sheet-price").textContent = v.price;
        }
        sizes.appendChild(btn);
      });
      if (!selectedVariantId) {
        const first = usable.find((v) => v.available);
        selectedVariantId = first ? first.id : null;
      }
    } else {
      sizes.hidden = true;
      selectedVariantId = Number(card.dataset.variantId) || (variants[0] && variants[0].id) || null;
    }

    addBtn.disabled = !available || !selectedVariantId;
    addBtn.textContent = available ? "ADD TO CART" : "SOLD OUT";

    sheet.hidden = false;
    document.body.classList.add("ftw-sheet-open");
    requestAnimationFrame(() => {
      sheet.classList.add("is-open");
      sheetOpen = true;
      $("#ftw-sheet .ftw-sheet__close")?.focus();
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
  }

  async function addToCart() {
    const addBtn = $("#ftw-sheet-add");
    if (!selectedVariantId || addBtn?.disabled) return;

    if (isLocal) {
      const count = Number($("#cart-count")?.textContent || 0) + 1;
      updateTrayCart(count);
      toast("ADDED TO CART.");
      closeSheet();
      return;
    }

    addBtn.disabled = true;
    try {
      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ id: selectedVariantId, quantity: 1 }),
      });
      if (!res.ok) throw new Error("add failed");
      const cart = await fetchCart();
      updateTrayCart(cart.item_count);
      toast("ADDED TO CART.");
      closeSheet();
    } catch {
      toast("COULDN'T ADD. TRY AGAIN.");
      addBtn.disabled = false;
    }
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

  $("#ftw-search-input")?.addEventListener("input", (e) => {
    searchQuery = e.target.value || "";
    applyFilters();
  });

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-sheet]")) {
      closeSheet();
      return;
    }

    const sizeBtn = e.target.closest(".ftw-sheet__size");
    if (sizeBtn && !sizeBtn.disabled) {
      $$(".ftw-sheet__size", root).forEach((b) => b.classList.remove("is-active"));
      sizeBtn.classList.add("is-active");
      selectedVariantId = Number(sizeBtn.dataset.variantId);
      const match = sheetVariants.find((v) => String(v.id) === String(selectedVariantId));
      if (match?.price) $("#ftw-sheet-price").textContent = match.price;
      return;
    }

    const product = e.target.closest(".ftw-product");
    if (product && root.contains(product)) {
      e.preventDefault();
      openSheet(product);
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
