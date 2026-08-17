import { state } from '../state.js';
import { activeTarget, cart, currentMenuItems, trackedOrderIds, orderStatusCache, targetIsRoom, setCurrentMenuItems, setTrackedOrderIds } from './portal-state.js';
import { showGuestNotice } from './notices.js';
import { saveTrackedGuestOrders, startGuestOrderPolling, loadGuestOrderTracker } from './tracker.js';
import { loadFolioData } from './folio.js';

export async function loadMenuData() {
  try {
    const res = await fetch('/api/catalog/availability');
    if (res.ok) {
      const menuItems = await res.json();
      state.availableCatalog = menuItems;
      const diningMenu = menuItems.filter(item => item.module_type === 'dining' || (targetIsRoom() && item.module_type === 'hotel' && item.price > 0));
      renderMenu(diningMenu);
      renderPaymentMethods(targetIsRoom());
    }
  } catch (err) {
    console.error(err);
  }
}

function renderPaymentMethods(isRoom) {
  const select = document.getElementById('guest-payment-method');
  if (!select) return;
  select.innerHTML = '';
  
  const options = [
    { id: 'cash', name: 'Nakit' },
    { id: 'card', name: 'Kredi Kartı' }
  ];
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.id;
    el.textContent = opt.name;
    select.appendChild(el);
  });
}

function renderMenu(items) {
  const container = document.getElementById('guest-menu-grid');
  const chipsBar = document.getElementById('guest-menu-chips');
  if (!container) return;
  container.innerHTML = '';
  if (chipsBar) chipsBar.innerHTML = '';
  const uniqueItems = Array.from(items.reduce((unique, item) => {
    const key = `${String(item.module_type || '').toLocaleLowerCase('tr-TR')}:${String(item.category || '').toLocaleLowerCase('tr-TR')}:${String(item.name || '').trim().toLocaleLowerCase('tr-TR')}`;
    const existing = unique.get(key);
    if (!existing || Number(item.maxServings || 0) > Number(existing.maxServings || 0)) unique.set(key, item);
    return unique;
  }, new Map()).values());
  setCurrentMenuItems(uniqueItems);

  if (uniqueItems.length === 0) {
    container.innerHTML = `<div class="aeon-card" style="min-height:100px;"><span class="card-title">Menü yüklenemedi.</span></div>`;
    return;
  }

  const categories = getMenuCategories(uniqueItems);
  categories.forEach(category => {
    const sectionId = `guest-menu-section-${category.id}`;
    const section = document.createElement('section');
    section.className = 'guest-menu-section';
    section.id = sectionId;
    section.innerHTML = `
      <div class="guest-menu-section-head">
        <div>
          <span>${category.eyebrow}</span>
          <h5>${category.title}</h5>
        </div>
        <strong>${category.items.length}</strong>
      </div>
      <div class="guest-menu-section-grid"></div>
    `;
    const grid = section.querySelector('.guest-menu-section-grid');
    category.items.forEach(item => grid.appendChild(renderMenuItemCard(item)));
    container.appendChild(section);

    if (chipsBar) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'guest-menu-chip';
      chip.textContent = category.title;
      chip.addEventListener('click', () => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        chipsBar.querySelectorAll('.guest-menu-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
      chipsBar.appendChild(chip);
    }
  });

  if (chipsBar?.firstElementChild) chipsBar.firstElementChild.classList.add('active');
}

function getMenuCategories(items) {
  const definitions = [
    { id: 'breakfast', eyebrow: 'Güne Başlarken', title: 'Kahvaltı & Yumurta' },
    { id: 'meze', eyebrow: 'Taze & Zeytinyağlı', title: 'Soğuk Mezeler & Salatalar' },
    { id: 'hot_appetizer', eyebrow: 'Sıcak Lezzetler', title: 'Ara Sıcaklar & Atıştırmalıklar' },
    { id: 'main_seafood', eyebrow: 'Taze Balık', title: 'Deniz Ürünleri & Balıklar' },
    { id: 'main_meat', eyebrow: 'Izgara & Tavuk', title: 'Ana Yemekler & Makarna & Burger' },
    { id: 'dessert', eyebrow: 'Kapanış', title: 'Tatlılar & Meyve' },
    { id: 'alcohol', eyebrow: 'Bar & Mahzen', title: 'Rakı, Şarap & Kokteyller' },
    { id: 'soft', eyebrow: 'Ferahlatıcı', title: 'Alkolsüz İçecekler & Kahve' },
    { id: 'minibar', eyebrow: 'Oda', title: 'Minibar' },
    { id: 'other', eyebrow: 'Özel Seçki', title: 'Diğer Hizmet & Menüler' }
  ];
  const grouped = definitions.map(def => ({ ...def, items: [] }));
  items.forEach(item => {
    const groupId = resolveMenuCategoryId(item);
    const group = grouped.find(def => def.id === groupId) || grouped[grouped.length - 1];
    group.items.push(item);
  });
  return grouped.filter(group => group.items.length > 0);
}

function resolveMenuCategoryId(item) {
  const text = `${item.id || ''} ${item.name || ''}`.toLocaleLowerCase('tr-TR');

  if (item.category === 'minibar') return 'minibar';
  if (item.category === 'drink') {
    if (/(rakı|raki|şarap|sarap|whiskey|viski|vodka|votka|cin|gin|kokteyl|mojito|bacardi|chivas|efes|tuborg|bomonti|carlsberg|miller|şampanya|sampanya|kadeh|şişe|sise)/.test(text) && !text.includes('alkolsüz')) {
      return 'alcohol';
    }
    return 'soft';
  }

  // Food categories
  if (/(kahvaltı|kahvalti|omlet|menemen|sucuklu_yumurta|tost)/.test(text)) return 'breakfast';
  if (/(tiramisu|cheesecake|helva|tatlı|tatli|pasta|meyve_tabagi|karpuz|kavun)/.test(text)) return 'dessert';
  if (/(karides|kalamar|midye|börek|borek|mantı|manti|patates|soğan_halkası|bira_tabağı|mantar)/.test(text) && !text.includes('salat') && !text.includes('izgara') && !text.includes('penne')) return 'hot_appetizer';
  if (/(levrek|çipura|cipura|barbun|mezgit|lahoz|balık|balik|ahtapot_izgara|kalamar_izgara|penne)/.test(text)) return 'main_seafood';
  if (/(köfte|kofte|antrikot|kavurma|pirzola|külbastı|kulbasti|tavuk|hamburger|cheeseburger|spaghetti)/.test(text)) return 'main_meat';
  if (/(salata|meze|lakerda|çiroz|ciroz|börülce|borulce|ancho|atom|humus|patlıcan|söğüş|sogus|ordövö|ordovo|ezine|yoğurtlama|yogurtlama|fasulye|pilav)/.test(text)) return 'meze';

  return item.category === 'food' ? 'main_meat' : 'other';
}

function renderMenuItemCard(item) {
  const cartItem = cart.find(c => c.itemId === item.id);
  const cartQty = cartItem ? cartItem.quantity : 0;
  const itemCard = document.createElement('div');
  itemCard.className = 'aeon-card guest-menu-card';
  itemCard.style.padding = '12px';
  itemCard.style.minHeight = '150px';
  itemCard.style.cursor = 'pointer';

  const isOutOfStock = item.maxServings === 0;

  let stockBadgeHtml = '';
  if (isOutOfStock) {
    stockBadgeHtml = `<span class="room-badge maintenance" style="font-size:9px; padding:2px 6px;">TÜKENDİ</span>`;
  } else if (Number.isFinite(item.maxServings) && item.maxServings <= 5) {
    stockBadgeHtml = `<span class="room-badge occupied" style="font-size:9px; padding:2px 6px;">SON ${item.maxServings}</span>`;
  } else {
    stockBadgeHtml = `<span class="room-badge clean" style="font-size:9px; padding:2px 6px;">Mevcut</span>`;
  }

  const iconClass = item.category === 'drink' ? 'fa-glass-water' : item.category === 'minibar' ? 'fa-door-closed' : 'fa-utensils';
  const mediaHtml = item.image_url
    ? `<div class="guest-menu-photo" style="background-image:url('${item.image_url}')"></div>`
    : `<div class="guest-menu-icon"><i class="fa-solid ${iconClass}"></i></div>`;

  const ingredientsText = (typeof item.ingredients === 'string' && item.ingredients)
    ? item.ingredients
    : (Array.isArray(item.ingredients) ? item.ingredients.map(i => typeof i === 'string' ? i : i?.name || '').filter(Boolean).join(', ') : '');

  const safeIngredients = ingredientsText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ingredientsHtml = safeIngredients
    ? `<div class="guest-menu-ingredients" style="font-size:10.5px; color: var(--gl-text-muted, #94a3b8); margin: 4px 12px 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3;"><i class="fa-solid fa-leaf" style="font-size:9px; color:var(--gl-gold, #d4af37); margin-right:4px;"></i>${safeIngredients}</div>`
    : '';

  const macrosHtml = (item.calories > 0)
    ? `<div class="guest-menu-macros" style="display:flex; gap:4px; flex-wrap:wrap; margin: 6px 12px 0; font-size:9.5px;">
        <span style="background:rgba(239,68,68,0.18); color:#fca5a5; padding:2px 5px; border-radius:4px; font-weight:700;"><i class="fa-solid fa-fire"></i> ${item.calories} kcal</span>
        ${item.protein ? `<span style="background:rgba(59,130,246,0.18); color:#93c5fd; padding:2px 5px; border-radius:4px; font-weight:700;">🥩 ${item.protein}g</span>` : ''}
       </div>`
    : '';

  itemCard.innerHTML = `
    <div class="guest-menu-badge">
      ${stockBadgeHtml}
    </div>
    ${mediaHtml}
    <div class="card-title guest-menu-name">${item.name}</div>
    <div class="guest-menu-price">
      ${item.discountRate > 0 ? `
        <span style="color: var(--color-danger); text-decoration: line-through; margin-right: 4px;">${item.originalPrice} TL</span>
        <span style="color: var(--color-success);">${item.price} TL</span>
      ` : `
        <span style="color: var(--color-success);">${item.price} TL</span>
      `}
    </div>
    ${ingredientsHtml}
    ${macrosHtml}
    ${item.discountRate > 0 ? `
      <div class="guest-menu-campaign">
        <i class="fa-solid fa-bolt"></i> ${item.campaignTitle || 'İndirim Fırsatı'}
      </div>
    ` : ''}

    <div class="margin-top-sm guest-menu-cta">
      ${isOutOfStock ? '' : `
        <div class="btn btn-glass btn-xs guest-add-pill" data-add-btn="${item.id}">
          <span class="guest-cart-count" data-item-id="${item.id}">${cartQty > 0 ? `Sepette ${cartQty}` : 'Sepete Ekle'}</span>
        </div>
      `}
    </div>
  `;

  const addPill = itemCard.querySelector('.guest-add-pill');
  if (addPill) {
    addPill.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      addMenuItemToCart(item.id);
    });
  }

  itemCard.addEventListener('click', (e) => {
    if (e.target.closest('.guest-add-pill')) return;
    openItemDetailModal(item);
  });

  return itemCard;
}

function openItemDetailModal(item) {
  const modal = document.getElementById('guest-item-modal');
  if (!modal) return;

  const titleEl = document.getElementById('modal-item-title');
  const catEl = document.getElementById('modal-item-category');
  const priceEl = document.getElementById('modal-item-price');
  const ingredientsEl = document.getElementById('modal-item-ingredients');
  const calEl = document.getElementById('modal-nutr-cal');
  const protEl = document.getElementById('modal-nutr-prot');
  const carbEl = document.getElementById('modal-nutr-carb');
  const fatEl = document.getElementById('modal-nutr-fat');
  const photoBox = document.getElementById('modal-item-photo-box');
  const photoEl = document.getElementById('modal-item-photo');
  const addBtn = document.getElementById('btn-modal-add-cart');

  if (titleEl) titleEl.textContent = item.name || '';
  if (catEl) catEl.textContent = item.category === 'drink' ? 'İçecek' : item.category === 'food' ? 'Yemek / Meze' : 'Servis';
  if (priceEl) priceEl.textContent = `${item.price || 0} TL`;

  const ingredientsText = (typeof item.ingredients === 'string' && item.ingredients)
    ? item.ingredients
    : (Array.isArray(item.ingredients) ? item.ingredients.map(i => typeof i === 'string' ? i : i?.name || '').filter(Boolean).join(', ') : '');

  if (ingredientsEl) ingredientsEl.textContent = ingredientsText || 'Şefin özel tarifiyle taze malzemelerden hazırlanır.';
  if (calEl) calEl.textContent = item.calories ? `${item.calories}` : '0';
  if (protEl) protEl.textContent = item.protein ? `${item.protein}g` : '0g';
  if (carbEl) carbEl.textContent = item.carbs ? `${item.carbs}g` : '0g';
  if (fatEl) fatEl.textContent = item.fat ? `${item.fat}g` : '0g';

  if (item.image_url && photoBox && photoEl) {
    photoEl.src = item.image_url;
    photoBox.style.display = 'block';
  } else if (photoBox) {
    photoBox.style.display = 'none';
  }

  if (addBtn) {
    if (item.maxServings === 0) {
      addBtn.disabled = true;
      addBtn.textContent = 'Tükendi';
    } else {
      addBtn.disabled = false;
      addBtn.innerHTML = `Sepete Ekle <i class="fa-solid fa-cart-plus" style="margin-left: 6px;"></i>`;
      addBtn.onclick = () => {
        addMenuItemToCart(item.id);
        closeItemDetailModal();
      };
    }
  }

  modal.style.display = 'flex';
  modal.classList.add('active');
}

export function closeItemDetailModal() {
  const modal = document.getElementById('guest-item-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 250);
  }
}

function addMenuItemToCart(itemId) {
  const catalogItem = state.availableCatalog?.find(i => i.id === itemId);
  if (!catalogItem) return;

  const cartItem = cart.find(c => c.itemId === itemId);
  const currentQty = cartItem ? cartItem.quantity : 0;
  const newQty = currentQty + 1;
  if (Number.isFinite(catalogItem.maxServings) && newQty > catalogItem.maxServings) {
    showGuestNotice({
      title: 'Stok Sınırı',
      message: 'Bu üründen şu anda daha fazla sipariş alınamıyor.',
      tone: 'warning'
    });
    return;
  }

  if (cartItem) {
    cartItem.quantity = newQty;
  } else {
    cart.push({
      itemId,
      quantity: 1,
      name: catalogItem.name,
      price: Number(catalogItem.price) || 0
    });
  }

  updateMenuItemCartState(itemId);
  updateCartFooter();
}

function updateMenuItemCartState(itemId) {
  const cartItem = cart.find(c => c.itemId === itemId);
  const countEl = Array.from(document.querySelectorAll('.guest-cart-count')).find(el => el.dataset.itemId === itemId);
  if (countEl) {
    countEl.textContent = cartItem ? `Sepette ${cartItem.quantity}` : 'Sepete Ekle';
  }
}

export function clearCart() {
  cart.length = 0;
  currentMenuItems.forEach(item => updateMenuItemCartState(item.id));
  updateCartFooter();
}

export function updateCartFooter() {
  const footer = document.getElementById('guest-cart-footer');
  if (!footer) return;

  if (cart.length === 0) {
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';
  
  let total = 0;
  let count = 0;
  cart.forEach(item => {
    total += item.price * item.quantity;
    count += item.quantity;
  });

  document.getElementById('guest-cart-total').textContent = `${total.toFixed(2)} TL`;
  const summary = document.getElementById('guest-cart-summary');
  if (summary) {
    summary.textContent = `${count} ürün sepette`;
  }
}

export async function submitOrder() {
  if (cart.length === 0) return;

  const btnSubmit = document.getElementById('btn-guest-submit-order');
  if (btnSubmit) {
    if (btnSubmit.disabled) return;
    btnSubmit.disabled = true;
  }

  const paymentMethod = document.getElementById('guest-payment-method').value;

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order',
        target_identifier: activeTarget,
        details: cart,
        payment_method: paymentMethod
      })
    });
    if (res.ok) {
      const result = await res.json();
      setTrackedOrderIds(Array.from(new Set([result.requestId, ...trackedOrderIds])).slice(0, 8));
      saveTrackedGuestOrders();
      orderStatusCache[result.requestId] = 'pending';
      startGuestOrderPolling();
      showGuestNotice({
        title: 'Siparişiniz Alındı',
        message: `Mutfak & Bar ekibine iletildi. Tutar: ${result.totalAmount} TL`,
        tone: 'success'
      });

      clearCart();
      loadGuestOrderTracker();

      if (targetIsRoom()) {
        loadFolioData();
      }
      loadMenuData();
    } else {
      const err = await res.json();
      showGuestNotice({
        title: 'Sipariş Gönderilemedi',
        message: err.error || 'Lütfen tekrar deneyin.',
        tone: 'error'
      });
    }
  } catch (err) {
    console.error(err);
    showGuestNotice({
      title: 'Bağlantı Hatası',
      message: 'Siparişiniz şu anda gönderilemedi, lütfen tekrar deneyin.',
      tone: 'error'
    });
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}
