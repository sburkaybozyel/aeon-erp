import { state, logEvent } from '../state.js';
import { esc } from './utils.js';
import { loadAdminDashboardData } from './dispatch.js';

export async function renderPatronPanel(requests, audits, inventory, catalog) {
  // 1. Calculate Average completion speed (difference between created_at and completed_at)
  let totalSpeedMs = 0;
  let completedCount = 0;
  const closedRequests = requests.filter(r => r.status === 'completed' && r.completed_at);

  closedRequests.forEach(req => {
    const start = new Date(req.created_at);
    const end = new Date(req.completed_at);
    const diff = end - start;
    if (diff > 0) {
      totalSpeedMs += diff;
      completedCount++;
    }
  });

  const avgSpeedEl = document.getElementById('patron-kpi-speed');
  if (avgSpeedEl) {
    if (completedCount > 0) {
      const avgMinutes = Math.round((totalSpeedMs / completedCount) / 1000 / 60);
      avgSpeedEl.textContent = `${avgMinutes} Dakika`;
    } else {
      avgSpeedEl.textContent = 'Veri Yok';
    }
  }

  // 2. Calculate prevented leakage/loss (TL) from audits variance
  let totalLeakVal = 0;
  const inventoryMap = {};
  inventory.forEach(i => {
    inventoryMap[i.id] = i;
  });

  audits.forEach(aud => {
    const inv = inventoryMap[aud.inventory_id];
    if (inv) {
      totalLeakVal += Math.abs(aud.variance * inv.unit_cost);
    }
  });

  const leakEl = document.getElementById('patron-kpi-leak');
  if (leakEl) {
    leakEl.textContent = `${totalLeakVal.toFixed(2)} TL`;
  }

  // 3. Render Audit Speed Logs table
  const auditLogsBody = document.getElementById('patron-audit-speed-tbody');
  if (auditLogsBody) {
    auditLogsBody.innerHTML = '';
    if (closedRequests.length === 0) {
      auditLogsBody.innerHTML = '<tr><td colspan="9" class="text-muted text-center text-xs">Kapatılmış hizmet talebi kaydı bulunmuyor.</td></tr>';
    } else {
      closedRequests.forEach(req => {
        const start = new Date(req.created_at);
        const end = new Date(req.completed_at);
        const diffMs = end - start;
        const diffMinutes = diffMs > 0 ? Math.round(diffMs / 1000 / 60) : 0;
        const speedClass = diffMinutes < 10 ? 'text-success' : (diffMinutes < 30 ? 'text-warning' : 'text-danger');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="text-xs text-muted">${esc(start.toLocaleDateString())}</span></td>
          <td><strong>${esc(req.target_identifier)}</strong></td>
          <td><span class="text-sm">${esc(req.details || req.type)}</span></td>
          <td><span class="room-badge clean_vacant" style="font-size:9px;">TAMAMLANDI</span></td>
          <td>${esc(req.created_by || '-')}</td>
          <td>${esc(req.completed_by || '-')}</td>
          <td>${esc(start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</td>
          <td>${esc(end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</td>
          <td><span class="bold ${speedClass}">${diffMinutes} dk</span></td>
        `;
        auditLogsBody.appendChild(tr);
      });
    }
  }

  // 4. Fetch and render campaigns list
  try {
    const campRes = await fetch(`/api/campaigns?tenant_id=${state.currentTenant}`);
    if (campRes.ok) {
      const campaigns = await campRes.json();
      
      const activeCount = campaigns.filter(c => c.active === 1).length;
      const activeCampEl = document.getElementById('patron-kpi-active-campaigns');
      if (activeCampEl) activeCampEl.textContent = activeCount;

      const campBody = document.getElementById('patron-campaigns-tbody');
      if (campBody) {
        campBody.innerHTML = '';
        if (campaigns.length === 0) {
          campBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center text-xs">Aktif tanımlı kampanya bulunmuyor.</td></tr>';
        } else {
          campaigns.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${esc(c.title)}</strong></td>
              <td>${esc(c.catalog_item_name)}</td>
              <td>%${c.discount_rate * 100}</td>
              <td><span class="room-badge ${c.active ? 'clean_vacant' : 'dirty_vacant'}" style="font-size:9px;">${c.active ? 'AKTİF' : 'PASİF'}</span></td>
              <td>
                <button class="btn ${c.active ? 'btn-danger' : 'btn-success'} btn-xs" style="padding: 2px 6px; font-size:10px; font-weight:700;" onclick="toggleCampaignLive('${c.id}', ${c.active ? 0 : 1})">
                  ${c.active ? 'Kapat' : 'Aç'}
                </button>
                <button class="btn btn-glass btn-xs" style="padding: 2px 4px;" onclick="deleteCampaignLive('${c.id}')"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            `;
            campBody.appendChild(tr);
          });
        }
      }
    }
  } catch (err) {
    console.error(err);
  }

  // 5. Run AI Campaign Suggestion Engine
  runAiRecommendationEngine(requests, audits, inventory, catalog);
}

function runAiRecommendationEngine(requests, audits, inventory, catalog) {
  const recommendationsList = document.getElementById('patron-ai-recommendations-list');
  if (!recommendationsList) return;
  recommendationsList.innerHTML = '';

  const recommendations = [];

  // Rule 1: High stock + slow sales recommendation
  inventory.forEach(inv => {
    if (inv.stock > inv.par_level * 1.2) {
      catalog.forEach(item => {
        const match = Array.isArray(item.ingredients) && item.ingredients.find(ing => ing.name === inv.name);
        if (match) {
          recommendations.push({
            type: 'stock_excess',
            title: `Fazla Stok Alarmı: ${esc(inv.name)}`,
            desc: `Deponuzdaki ${esc(inv.name)} stoğu (${inv.stock} ${inv.unit}) par seviyesinin oldukça üzerinde. Nakit akışı ve tüketimi artırmak için bu hammaddeyi kullanan <strong>${esc(item.name)}</strong> ürününe saatlik %15 indirimli kampanya uygulayabilirsiniz.`,
            actionLabel: '%15 İndirim Kampanyası Öner',
            catalogItemId: item.id,
            discountRate: 0.15,
            campaignTitle: `Saatlik Fırsat: ${esc(item.name)} %15 İndirimli!`
          });
        }
      });
    }
  });

  // Rule 2: Happy Hour suggestion (based on bar items in the evening)
  const hour = new Date().getHours();
  if (hour >= 17 && hour <= 23) {
    const drinks = catalog.filter(c => c.category === 'drink');
    if (drinks.length > 0) {
      const luckyDrink = drinks[Math.floor(Math.random() * drinks.length)];
      recommendations.push({
        type: 'happy_hour',
        title: `Happy Hour Kampanyası (Saat ${hour}:00)`,
        desc: `Akşam saatleri yoğunluğu başladı. Barda ciroyu maksimize etmek için popüler alkollü/alkolsüz içeceğimiz olan <strong>${esc(luckyDrink.name)}</strong> için saatlik %20 indirim tanımlayabilirsiniz.`,
        actionLabel: '%20 Happy Hour Etkinleştir',
        catalogItemId: luckyDrink.id,
        discountRate: 0.20,
        campaignTitle: `Happy Hour: ${esc(luckyDrink.name)} %20 İndirimli!`
      });
    }
  }

  if (recommendations.length === 0) {
    recommendationsList.innerHTML = `
      <div style="background: rgba(228, 211, 167,0.02); border: 1px dashed rgba(228, 211, 167,0.1); padding: 12px; border-radius: 6px; text-align: center;">
        <span class="text-muted text-xs">Şu an sistem tarafından algılanan acil bir kampanya önerisi bulunmuyor. Depo ve satışlar dengeli görünüyor.</span>
      </div>
    `;
    return;
  }

  recommendations.forEach((rec, index) => {
    const div = document.createElement('div');
    div.style.background = rec.type === 'stock_excess' ? 'rgba(255,193,7,0.05)' : 'rgba(40,167,69,0.05)';
    div.style.border = rec.type === 'stock_excess' ? '1px solid rgba(255,193,7,0.15)' : '1px solid rgba(40,167,69,0.15)';
    div.style.padding = '12px';
    div.style.borderRadius = '8px';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '8px';

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="font-size:12px; color: ${rec.type === 'stock_excess' ? 'var(--color-warning)' : 'var(--color-success)'};"><i class="fa-solid fa-wand-magic-sparkles"></i> ${rec.title}</strong>
        <span class="text-xs text-muted" style="font-size: 10px;">AI Önerisi</span>
      </div>
      <p class="text-xs" style="line-height:1.4; color:rgba(228, 211, 167,0.85);">${rec.desc}</p>
      <button class="btn btn-primary btn-xs" style="align-self: flex-start; margin-top:4px;" onclick="createCampaignFromSuggestion('${rec.campaignTitle}', ${rec.discountRate}, '${rec.catalogItemId}')">
        <i class="fa-solid fa-bolt"></i> ${rec.actionLabel}
      </button>
    `;
    recommendationsList.appendChild(div);
  });
}

window.createCampaignFromSuggestion = async (title, discountRate, catalogItemId) => {
  const res = await fetch(`/api/campaigns?tenant_id=${state.currentTenant}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, discount_rate: discountRate, catalog_item_id: catalogItemId })
  });
  if (res.ok) {
    const data = await res.json();
    await fetch(`/api/campaigns/${data.id}/toggle?tenant_id=${state.currentTenant}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: 1 })
    });
    logEvent('system', `AI Kampanyası Aktifleştirildi: <strong>${title}</strong>`);
    
    const configRes = await fetch(`/api/catalog/availability?tenant_id=${state.currentTenant}`);
    if (configRes.ok) state.availableCatalog = await configRes.json();

    loadAdminDashboardData();
  }
};

window.toggleCampaignLive = async (id, active) => {
  const res = await fetch(`/api/campaigns/${id}/toggle?tenant_id=${state.currentTenant}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active })
  });
  if (res.ok) {
    logEvent('system', `Kampanya durumu güncellendi.`);
    const configRes = await fetch(`/api/catalog/availability?tenant_id=${state.currentTenant}`);
    if (configRes.ok) state.availableCatalog = await configRes.json();
    loadAdminDashboardData();
  }
};

window.deleteCampaignLive = async (id) => {
  if (confirm("Bu kampanyayı silmek istediğinize emin misiniz?")) {
    const res = await fetch(`/api/campaigns/${id}?tenant_id=${state.currentTenant}`, { method: 'DELETE' });
    if (res.ok) {
      logEvent('system', 'Kampanya silindi.');
      const configRes = await fetch(`/api/catalog/availability?tenant_id=${state.currentTenant}`);
      if (configRes.ok) state.availableCatalog = await configRes.json();
      loadAdminDashboardData();
    }
  }
};
