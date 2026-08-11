(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const state = {
    user: null,
    config: { pipeline_stages: [], currencies: [], firm_types: [], lead_sources: [], activity_types: [], lost_reasons: [] },
    users: [],
    currentView: 'dashboard',
    searchResults: null,
    currentOfferId: null
  };

  // ─── API CLIENT ─────────────────────────────────────────────────────
  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    let body = null;
    try { body = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok) {
      throw new Error(body?.error || `İstek başarısız (${res.status})`);
    }
    return body;
  }

  // ─── HELPERS ────────────────────────────────────────────────────────
  function toast(message, isError = false) {
    const el = $('#toast');
    el.textContent = message;
    el.style.background = isError ? 'var(--danger)' : 'var(--ink)';
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtAmount(amount, currency) {
    return `${Number(amount || 0).toLocaleString('tr-TR')} ${currency || 'EUR'}`;
  }

  function stageBadge(stage) {
    return `<span class="badge stage-${esc(stage)}">${esc(stage)}</span>`;
  }

  function dateText(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return value;
    return d.toLocaleDateString('tr-TR');
  }

  function isOverdue(dueDate) {
    if (!dueDate) return false;
    return dueDate < new Date().toISOString().slice(0, 10);
  }

  function openModal(title, bodyHtml) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = bodyHtml;
    $('#modal-backdrop').classList.remove('hidden');
  }
  function closeModal() { $('#modal-backdrop').classList.add('hidden'); }

  function userOptions(selectedId) {
    return state.users.map(u =>
      `<option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>${esc(u.name)}</option>`
    ).join('');
  }

  function ownerSelect(selectedId) {
    return `<select name="owner_id">${userOptions(selectedId)}</select>`;
  }

  function submitForm(formEl, onSubmit) {
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(formEl).entries());
      for (const [k, v] of Object.entries(data)) {
        if (v === '') data[k] = null;
      }
      const btn = $('button[type=submit]', formEl);
      const original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Kaydediliyor...';
      try {
        await onSubmit(data);
        closeModal();
        toast('Kaydedildi');
      } catch (err) {
        toast(err.message, true);
      } finally {
        btn.disabled = false; btn.textContent = original;
      }
    });
  }

  // ─── VIEW ROUTER ────────────────────────────────────────────────────
  const views = {
    dashboard: { title: 'Dashboard', subtitle: 'Satış operasyonuna genel bakış', render: renderDashboard },
    pipeline: { title: 'Pipeline', subtitle: 'Fırsatlar ve satış aşamaları', render: renderPipeline },
    leads: { title: 'Lead\'ler', subtitle: 'Potansiyel müşteri havuzu', render: renderLeads },
    firms: { title: 'Firmalar', subtitle: 'Acente ve kurumsal hesap kartları', render: renderFirms },
    contacts: { title: 'Kişiler', subtitle: 'Kontak kartları', render: renderContacts },
    tasks: { title: 'Görevler', subtitle: 'Takip ve hatırlatmalar', render: renderTasks },
    activities: { title: 'Aktiviteler', subtitle: 'Görüşme, e-posta, toplantı ve notlar', render: renderActivities },
    offers: { title: 'Teklifler', subtitle: 'Turizm teklifleri ve versiyonlar', render: renderOffers },
    followups: { title: 'Takip', subtitle: 'Konaklama öncesi/sonrası otomatik takip kuyruğu', render: renderFollowups },
    campaigns: { title: 'Kampanyalar', subtitle: 'İzin kontrollü hedef kitle kampanyaları', render: renderCampaigns },
    reports: { title: 'Raporlar', subtitle: 'Pipeline, dönüşüm, performans ve mutabakat', render: renderReports },
    integration: { title: 'Entegrasyon', subtitle: 'ERP senkronizasyon günlüğü (Faz 3 hazırlık)', render: renderIntegration },
    users: { title: 'Kullanıcılar', subtitle: 'Rol ve hesap yönetimi (yalnızca yönetici)', render: renderUsers }
  };

  async function navigate(view, params) {
    state.currentView = view;
    state.viewParams = params || {};
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    const def = views[view];
    $('#view-title').textContent = def.title;
    $('#view-subtitle').textContent = def.subtitle;
    $('#view-container').innerHTML = '<div class="empty"><div class="big">⏳</div>Yükleniyor...</div>';
    $('#search-results').classList.add('hidden');
    try {
      await def.render();
    } catch (err) {
      $('#view-container').innerHTML = `<div class="card"><div class="alert error">${esc(err.message)}</div></div>`;
    }
  }

  // ─── DASHBOARD ─────────────────────────────────────────────────────
  async function renderDashboard() {
    const data = await api('/api/crm/dashboard');
    const stages = state.config.pipeline_stages;
    const stageHtml = stages.filter(s => s !== 'won' && s !== 'lost').map(s => {
      const c = data.stage_counts.find(x => x.pipeline_stage === s);
      return `<div class="card stat-card"><div class="num">${Number(c?.cnt || 0)}</div><div class="label">${esc(s)}</div></div>`;
    }).join('');

    $('#view-container').innerHTML = `
      <div class="grid cols-4">
        <div class="card stat-card"><div class="num">${data.open_opportunities}</div><div class="label">Açık Fırsat</div></div>
        <div class="card stat-card"><div class="num">${fmtAmount(data.open_pipeline_total)}</div><div class="label">Pipeline Toplamı</div></div>
        <div class="card stat-card"><div class="num">${data.won_opportunities}</div><div class="label">Kazanılan</div></div>
        <div class="card stat-card"><div class="num" style="color:${data.overdue_tasks > 0 ? 'var(--danger)' : 'var(--ink)'}">${data.overdue_tasks}</div><div class="label">Geciken Görev</div></div>
      </div>
      <div class="grid cols-4" style="margin-top:16px">${stageHtml}</div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 16px;">
        <div class="card">
          <div class="section-title">Son Lead'ler</div>
          ${data.recent_leads.length ? `<table class="table">
            <thead><tr><th>Firma</th><th>Kaynak</th><th>Durum</th><th>Sorumlu</th></tr></thead>
            <tbody>${data.recent_leads.map(l => `<tr>
              <td>${esc(l.firm_name || '—')}</td>
              <td>${esc(l.source)}</td>
              <td>${esc(l.status)}</td>
              <td>${esc(l.owner_name || '—')}</td>
            </tr>`).join('')}</tbody>
          </table>` : '<div class="empty">Henüz lead yok</div>'}
        </div>
        <div class="card">
          <div class="section-title">Son Aktiviteler</div>
          ${data.recent_activities.length ? `<ul class="timeline">${data.recent_activities.map(a => `
            <li><div class="dot">${iconFor(a.type)}</div><div><strong>${esc(a.subject)}</strong><div class="muted small">${esc(a.owner_name || '')} · ${dateText(a.activity_at)}</div></div></li>
          `).join('')}</ul>` : '<div class="empty">Henüz aktivite yok</div>'}
        </div>
      </div>
    `;
  }

  function iconFor(type) {
    return { call: '📞', email: '✉️', meeting: '🤝', whatsapp: '💬', note: '📝' }[type] || '📝';
  }

  // ─── PIPELINE ───────────────────────────────────────────────────────
  async function renderPipeline() {
    const opps = await api('/api/crm/opportunities');
    const stages = state.config.pipeline_stages;
    $('#view-container').innerHTML = `
      <div class="kanban">
        ${stages.map(stage => {
          const cards = opps.filter(o => o.pipeline_stage === stage);
          return `<div class="kanban-col">
            <h4>${esc(stage)} <span>(${cards.length})</span></h4>
            ${cards.map(o => `
              <div class="kanban-card" data-opp-id="${o.id}">
                <h5>${esc(o.title)}</h5>
                <div class="meta">${esc(o.firm_name || 'Firma yok')} · ${esc(o.owner_name || '—')}</div>
                <div class="meta" style="margin-top:4px"><strong>${fmtAmount(o.amount, o.currency)}</strong></div>
                ${o.erp_reservation_no ? `<div class="meta erp-badge" style="margin-top:4px"><span class="badge" style="background:#e0e7ff;color:#3730a3">ERP ${esc(o.erp_reservation_no)}</span></div>` : ''}
              </div>
            `).join('') || '<div class="empty small">Boş</div>'}
          </div>`;
        }).join('')}
      </div>
    `;
    $$('.kanban-card').forEach(el => el.addEventListener('click', () => openOpportunityDetail(el.dataset.oppId)));
  }

  // ─── LEADS ──────────────────────────────────────────────────────────
  async function renderLeads() {
    const leads = await api('/api/crm/leads?status=all');
    const sources = state.config.lead_sources;
    const statuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    $('#view-container').innerHTML = `
      <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
        <select id="lead-status-filter" class="small" style="width:auto">
          <option value="all">Tüm Durumlar</option>
          ${statuses.map(s => `<option value="${s}">${esc(s)}</option>`).join('')}
        </select>
        <button class="btn primary" data-action="new-lead">+ Yeni Lead</button>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Firma</th><th>Kaynak</th><th>Sorumlu</th><th>Durum</th><th>Tarih</th><th></th></tr></thead>
          <tbody>${leads.map(l => `<tr data-lead-id="${l.id}">
            <td>${esc(l.firm_name || '—')}</td>
            <td>${esc(l.source)}</td>
            <td>${esc(l.owner_name || '—')}</td>
            <td>${esc(l.status)}</td>
            <td>${dateText(l.created_at)}</td>
            <td class="row-actions">
              <button class="btn small" data-action="qualify" title="Fırsata çevir">→ Fırsat</button>
              <button class="btn small ghost" data-action="edit-lead">✏️</button>
            </td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    $('[data-action=new-lead]').addEventListener('click', openLeadForm);
    $$('tr[data-lead-id]').forEach(tr => {
      $('[data-action=qualify]', tr).addEventListener('click', () => qualifyLead(tr.dataset.leadId));
      $('[data-action=edit-lead]', tr).addEventListener('click', () => openLeadForm(tr.dataset.leadId));
    });
    $('#lead-status-filter').addEventListener('change', async e => {
      const rows = await api(`/api/crm/leads?status=${e.target.value}`);
      // simple client-side refilter to avoid re-render complexity
      renderLeads();
    });
  }

  async function openLeadForm(id) {
    openModal(id ? 'Lead Düzenle' : 'Yeni Lead', `
      <form id="lead-form">
        <div class="form-grid">
          <div><label>Firma ID</label><input name="firm_id" placeholder="Firma seçilebilir"></div>
          <div><label>Kontak ID</label><input name="contact_id" placeholder="Kontak seçilebilir"></div>
          <div><label>Kaynak *</label><select name="source">${state.config.lead_sources.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
          <div><label>Sorumlu</label>${ownerSelect(state.user.id)}</div>
          <div class="full"><label>Not</label><textarea name="notes" placeholder="Lead hakkında kısa not"></textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Kaydet</button></div>
      </form>
    `);
    if (id) {
      // load existing
    }
    submitForm($('#lead-form'), data => api('/api/crm/leads', { method: 'POST', body: JSON.stringify(data) }));
  }

  async function qualifyLead(leadId) {
    const lead = (await api('/api/crm/leads?status=all')).find(l => l.id === leadId);
    openModal('Lead → Fırsat', `
      <form id="opp-form">
        <div class="form-grid">
          <div class="full"><label>Başlık *</label><input name="title" value="${esc(lead?.firm_name || lead?.source || 'Yeni Fırsat')}"></div>
          <div><label>Pipeline Aşaması</label><select name="pipeline_stage">${state.config.pipeline_stages.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
          <div><label>Tutar</label><input name="amount" type="number" step="0.01" value="0"></div>
          <div><label>Para Birimi</label><select name="currency">${state.config.currencies.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
          <div><label>Sorumlu</label>${ownerSelect(state.user.id)}</div>
          <div class="full"><label>Not</label><textarea name="notes">${esc(lead?.notes || '')}</textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Fırsat Oluştur</button></div>
      </form>
    `);
    submitForm($('#opp-form'), data => api('/api/crm/opportunities', { method: 'POST', body: JSON.stringify({ ...data, lead_id: leadId, firm_id: lead?.firm_id, contact_id: lead?.contact_id }) }));
  }

  // ─── FIRMS ──────────────────────────────────────────────────────────
  async function renderFirms() {
    const firms = await api('/api/crm/firms');
    $('#view-container').innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
        <input id="firm-filter" type="search" placeholder="Firma ara..." style="width:280px">
        <button class="btn primary" data-action="new-firm">+ Yeni Firma</button>
      </div>
      <div class="grid cols-2">
        ${firms.map(f => `
          <div class="card" data-firm-id="${f.id}" style="cursor:pointer">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h3>${esc(f.name)}</h3>
              <span class="badge">${esc(f.type)}</span>
            </div>
            <div class="muted small" style="margin-top:8px">
              ${esc(f.city || '')} ${f.country ? '· ' + esc(f.country) : ''}<br>
              ${f.phone ? esc(f.phone) + '<br>' : ''}
              ${f.email ? esc(f.email) + '<br>' : ''}
              ${f.commission_rate ? 'Komisyon: %' + f.commission_rate + '<br>' : ''}
              <strong>${f.contact_count}</strong> kişi
            </div>
            <div style="margin-top:10px"><button class="btn small" data-action="view-firm">Detay</button></div>
          </div>
        `).join('')}
      </div>
    `;
    $('[data-action=new-firm]').addEventListener('click', openFirmForm);
    $$('[data-firm-id]').forEach(card => {
      card.addEventListener('click', e => { if (!e.target.closest('[data-action]')) return; openFirmDetail(card.dataset.firmId); });
      $('[data-action=view-firm]', card).addEventListener('click', () => openFirmDetail(card.dataset.firmId));
    });
    $('#firm-filter').addEventListener('input', async e => {
      const rows = await api('/api/crm/firms?q=' + encodeURIComponent(e.target.value));
      // simplistic re-render
      renderFirms();
    });
  }

  function openFirmForm(id) {
    openModal(id ? 'Firma Düzenle' : 'Yeni Firma', `
      <form id="firm-form">
        <div class="form-grid">
          <div class="full"><label>Firma Adı *</label><input name="name" required></div>
          <div><label>Tip</label><select name="type">${state.config.firm_types.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
          <div><label>Vergi No</label><input name="tax_number"></div>
          <div><label>Telefon</label><input name="phone"></div>
          <div><label>E-posta</label><input name="email" type="email"></div>
          <div><label>Ülke</label><input name="country"></div>
          <div><label>Şehir</label><input name="city"></div>
          <div><label>Web Sitesi</label><input name="website"></div>
          <div><label>Komisyon %</label><input name="commission_rate" type="number" step="0.1"></div>
          <div class="full"><label>Not</label><textarea name="notes"></textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Kaydet</button></div>
      </form>
    `);
    submitForm($('#firm-form'), data => api('/api/crm/firms', { method: 'POST', body: JSON.stringify(data) }));
  }

  async function openFirmDetail(id) {
    const firm = await api(`/api/crm/firms/${id}`);
    openModal(esc(firm.name), `
      <div class="detail-header">
        <div>
          <span class="badge">${esc(firm.type)}</span>
          ${firm.website ? ` <a href="${esc(firm.website)}" target="_blank" class="small">Web</a>` : ''}
          <div class="muted small" style="margin-top:8px">${esc([firm.city, firm.country].filter(Boolean).join(', ') || '—')}</div>
          <div class="small">${firm.phone ? esc(firm.phone) + ' ' : ''}${firm.email ? esc(firm.email) : ''}</div>
          <div class="small">Komisyon: %${Number(firm.commission_rate) || 0}</div>
        </div>
        <button class="btn small ghost" data-action="edit-firm">Düzenle</button>
      </div>
      <div class="section-title">Kişiler (${firm.contacts.length})</div>
      ${firm.contacts.length ? `<table class="table"><thead><tr><th>İsim</th><th>Ünvan</th><th>Telefon</th><th>İzin</th></tr></thead><tbody>${firm.contacts.map(c => `<tr><td>${esc(c.first_name)} ${esc(c.last_name)} ${c.is_primary ? '⭐' : ''}</td><td>${esc(c.title || '—')}</td><td>${esc(c.phone || '—')}</td><td>${c.marketing_consent ? '✅' : '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty small">Kişi yok</div>'}
      <div class="section-title">Fırsatlar (${firm.opportunities.length})</div>
      ${firm.opportunities.map(o => `<div class="small">${esc(o.title)} · ${fmtAmount(o.amount, o.currency)} ${stageBadge(o.pipeline_stage)}</div>`).join('') || '<div class="empty small">Fırsat yok</div>'}
    `);
    $('[data-action=edit-firm]').addEventListener('click', () => openFirmForm(id));
  }

  // ─── CONTACTS ───────────────────────────────────────────────────────
  async function renderContacts() {
    const contacts = await api('/api/crm/contacts');
    $('#view-container').innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
        <input id="contact-filter" type="search" placeholder="Kişi ara..." style="width:280px">
        <button class="btn primary" data-action="new-contact">+ Yeni Kişi</button>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Ad Soyad</th><th>Firma</th><th>Ünvan</th><th>Telefon</th><th>E-posta</th><th>İzin</th><th></th></tr></thead>
          <tbody>${contacts.map(c => `<tr data-contact-id="${c.id}">
            <td><strong>${esc(c.first_name)} ${esc(c.last_name)}</strong> ${c.is_primary ? '⭐' : ''}</td>
            <td>${esc(c.firm_name || '—')}</td>
            <td>${esc(c.title || '—')}</td>
            <td>${esc(c.phone || '—')}</td>
            <td>${esc(c.email || '—')}</td>
            <td>${c.marketing_consent ? '<span class="badge" style="background:#dcfce7;color:#15803d">İzinli</span>' : '<span class="badge">—</span>'}</td>
            <td class="row-actions"><button class="btn small ghost" data-action="edit-contact">✏️</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    $('[data-action=new-contact]').addEventListener('click', openContactForm);
    $$('tr[data-contact-id]').forEach(tr => {
      $('[data-action=edit-contact]', tr).addEventListener('click', () => openContactForm(tr.dataset.contactId));
    });
    $('#contact-filter').addEventListener('input', async e => {
      renderContacts();
    });
  }

  function openContactForm(id) {
    openModal(id ? 'Kişi Düzenle' : 'Yeni Kişi', `
      <form id="contact-form">
        <div class="form-grid">
          <div><label>Ad *</label><input name="first_name" required></div>
          <div><label>Soyad *</label><input name="last_name" required></div>
          <div><label>Firma</label><input name="firm_id" placeholder="Firma ID"></div>
          <div><label>Ünvan</label><input name="title"></div>
          <div><label>Telefon</label><input name="phone"></div>
          <div><label>E-posta</label><input name="email" type="email"></div>
          <div><label>Birincil Kişi</label><select name="is_primary"><option value="0">Hayır</option><option value="1">Evet</option></select></div>
          <div><label>Pazarlama İzni (KVKK)</label><select name="marketing_consent"><option value="0">Yok</option><option value="1">Var</option></select></div>
          <div><label>VIP</label><select name="vip"><option value="0">Hayır</option><option value="1">Evet</option></select></div>
          <div><label>Segment</label><select name="segment">${['direkt', 'acente', 'kurumsal', 'vip', 'tekrar_gelen', 'kaybedilen'].map(s => `<option>${s}</option>`).join('')}</select></div>
          <div><label>Doğum Günü</label><input name="birthday" type="date"></div>
          <div class="full"><label>Alerjiler / Özel Gün / Tercihler</label><input name="allergies" placeholder="ör. alerji, özel gün, tercih"></div>
          <div class="full"><label>Not</label><textarea name="notes"></textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Kaydet</button></div>
      </form>
    `);
    submitForm($('#contact-form'), data => {
      data.is_primary = data.is_primary === '1';
      data.marketing_consent = data.marketing_consent === '1';
      data.kvkk_consent = data.marketing_consent;
      data.vip = data.vip === '1';
      return api('/api/crm/contacts', { method: 'POST', body: JSON.stringify(data) });
    });
  }

  // ─── TASKS ──────────────────────────────────────────────────────────
  async function renderTasks() {
    const tasks = await api('/api/crm/tasks');
    $('#view-container').innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
        <div style="display:flex; gap:10px;">
          <select id="task-filter" style="width:auto"><option value="all">Tümü</option><option value="pending">Açık</option><option value="done">Tamamlandı</option></select>
        </div>
        <button class="btn primary" data-action="new-task">+ Yeni Görev</button>
      </div>
      <div class="grid cols-2">
        ${tasks.map(t => `
          <div class="card" data-task-id="${t.id}" style="${t.status === 'done' ? 'opacity:.6' : ''}">
            <div style="display:flex; justify-content:space-between; gap:10px;">
              <div>
                <strong>${esc(t.title)}</strong>
                ${t.opportunity_title ? `<div class="small muted">Fırsat: ${esc(t.opportunity_title)}</div>` : ''}
                <div class="small muted" style="margin-top:6px">
                  <span class="badge priority-${esc(t.priority)}">${esc(t.priority)}</span>
                  Sorumlu: ${esc(t.owner_name || '—')}
                  ${t.due_date ? ' · Son tarih: ' + dateText(t.due_date) + (isOverdue(t.due_date) && t.status !== 'done' ? ' <span style="color:var(--danger)">⏰</span>' : '') : ''}
                </div>
              </div>
              <div class="row-actions">
                <button class="btn small" data-action="toggle-done">${t.status === 'done' ? '↩️' : '✅'}</button>
                <button class="btn small ghost" data-action="edit-task">✏️</button>
              </div>
            </div>
          </div>
        `).join('') || '<div class="empty">Görev yok</div>'}
      </div>
    `;
    $('[data-action=new-task]').addEventListener('click', openTaskForm);
    $$('[data-task-id]').forEach(card => {
      $('[data-action=toggle-done]', card).addEventListener('click', async () => {
        const status = card.style.opacity === '0.6' ? 'pending' : 'done';
        await api(`/api/crm/tasks/${card.dataset.taskId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
        toast(status === 'done' ? 'Görev tamamlandı' : 'Görev yeniden açıldı');
        renderTasks();
      });
      $('[data-action=edit-task]', card).addEventListener('click', () => openTaskForm(card.dataset.taskId));
    });
  }

  function openTaskForm(id) {
    openModal(id ? 'Görev Düzenle' : 'Yeni Görev', `
      <form id="task-form">
        <div class="form-grid">
          <div class="full"><label>Başlık *</label><input name="title" required></div>
          <div><label>Öncelik</label><select name="priority"><option value="low">Düşük</option><option value="normal" selected>Normal</option><option value="high">Yüksek</option></select></div>
          <div><label>Son Tarih</label><input name="due_date" type="date"></div>
          <div><label>Sorumlu</label>${ownerSelect(state.user.id)}</div>
          <div><label>İlişkili Tip</label><select name="related_type"><option value="">Yok</option><option value="opportunity">Fırsat</option></select></div>
          <div><label>İlişkili ID</label><input name="related_id" placeholder="Fırsat ID"></div>
          <div class="full"><label>Not</label><textarea name="notes"></textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Kaydet</button></div>
      </form>
    `);
    submitForm($('#task-form'), data => api('/api/crm/tasks', { method: 'POST', body: JSON.stringify(data) }));
  }

  // ─── ACTIVITIES ─────────────────────────────────────────────────────
  async function renderActivities() {
    const activities = await api('/api/crm/activities');
    $('#view-container').innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
        <div class="muted small">${activities.length} aktivite</div>
        <button class="btn primary" data-action="new-activity">+ Yeni Aktivite</button>
      </div>
      <div class="card">
        <ul class="timeline">
          ${activities.map(a => `<li>
            <div class="dot">${iconFor(a.type)}</div>
            <div style="flex:1">
              <div style="display:flex; justify-content:space-between; gap:10px">
                <strong>${esc(a.subject)}</strong>
                <span class="badge">${esc(a.type)}</span>
              </div>
              ${a.opportunity_title ? `<div class="small muted">Fırsat: ${esc(a.opportunity_title)}</div>` : ''}
              ${a.notes ? `<div class="small" style="margin-top:4px">${esc(a.notes)}</div>` : ''}
              <div class="small muted" style="margin-top:4px">${esc(a.owner_name || '—')} · ${dateText(a.activity_at)}</div>
            </div>
          </li>`).join('') || '<div class="empty">Aktivite yok</div>'}
        </ul>
      </div>
    `;
    $('[data-action=new-activity]').addEventListener('click', openActivityForm);
  }

  function openActivityForm() {
    openModal('Yeni Aktivite', `
      <form id="activity-form">
        <div class="form-grid">
          <div class="full"><label>Konu *</label><input name="subject" required placeholder="Örn: Tel araması, teklif gönderildi..."></div>
          <div><label>Tip</label><select name="type">${state.config.activity_types.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
          <div><label>Tarih</label><input name="activity_at" type="datetime-local"></div>
          <div><label>Fırsat ID</label><input name="opportunity_id" placeholder="Opsiyonel"></div>
          <div><label>Kontak ID</label><input name="contact_id" placeholder="Opsiyonel"></div>
          <div class="full"><label>Not</label><textarea name="notes"></textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Kaydet</button></div>
      </form>
    `);
    submitForm($('#activity-form'), data => api('/api/crm/activities', { method: 'POST', body: JSON.stringify(data) }));
  }

  // ─── OFFERS ─────────────────────────────────────────────────────────
  async function renderOffers() {
    const offers = await api('/api/crm/offers');
    $('#view-container').innerHTML = `
      <div class="card">
        <table class="table">
          <thead><tr><th>Teklif</th><th>Fırsat</th><th>v.</th><th>Durum</th><th>Kur</th><th>Konaklama</th><th>Toplam</th><th></th></tr></thead>
          <tbody>${offers.map(o => `
            <tr data-offer-id="${o.id}" style="cursor:pointer">
              <td><strong>${esc(o.title)}</strong></td>
              <td>${esc(o.opportunity_title || '—')}</td>
              <td>${o.version}</td>
              <td><span class="badge offer-status">${esc(o.status)}</span></td>
              <td>${esc(o.currency)}</td>
              <td class="small muted">${o.check_in ? dateText(o.check_in) + ' → ' + dateText(o.check_out) + (o.nights ? ' (' + o.nights + ' gece)' : '') : '—'}</td>
              <td><strong>${fmtAmount(o.totals?.total, o.currency)}</strong></td>
              <td class="row-actions"><button class="btn small primary" data-action="open-offer">Aç</button></td>
            </tr>`).join('') || '<tr><td colspan="8" class="empty">Henüz teklif yok</td></tr>'}</tbody>
        </table>
      </div>
    `;
    $$('tr[data-offer-id]').forEach(tr => {
      $('[data-action=open-offer]', tr).addEventListener('click', () => openOfferEditor(tr.dataset.offerId));
    });
  }

  async function openOfferEditor(id) {
    state.currentOfferId = id;
    const offer = await api(`/api/crm/offers/${id}`);
    const statuses = ['draft', 'sent', 'waiting', 'revised', 'approved', 'lost'];
    const categories = ['konaklama', 'transfer', 'tekne_yat', 'restoran', 'etkinlik', 'ozel_istek'];
    const t = offer.totals;

    $('#view-container').innerHTML = `
      <div class="offer-toolbar no-print">
        <button class="btn ghost" data-action="back">← Teklifler</button>
        <div class="spacer"></div>
        <button class="btn" data-action="revision" title="Yeni versiyon">↻ Revizyon</button>
        <button class="btn" data-action="print" title="Yazdır / PDF">🖨 Yazdır</button>
        <select data-action="status" class="small" style="width:auto">
          ${statuses.map(s => `<option value="${s}" ${s === offer.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>

      <div class="offer-doc">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
          <div>
            <h2><input id="offer-title" value="${esc(offer.title)}" style="font-size:22px; font-weight:800; border:none; background:transparent; width:100%"></h2>
            <div class="offer-meta">
              Fırsat: <strong>${esc(offer.opportunity_title)}</strong> · Versiyon <strong>v${offer.version}</strong> ·
              Durum: <span class="badge offer-status">${esc(offer.status)}</span>${offer.opportunity_stage ? ' · Fırsat aşaması: ' + esc(offer.opportunity_stage) : ''}
            </div>
          </div>
          <div class="no-print"><span class="badge">Kur: ${esc(offer.currency)}</span></div>
        </div>

        <div class="section-title">Konaklama</div>
        <div class="form-grid">
          <div><label>Giriş</label><input type="date" id="offer-check_in" value="${esc(offer.check_in || '')}"></div>
          <div><label>Çıkış</label><input type="date" id="offer-check_out" value="${esc(offer.check_out || '')}"></div>
          <div><label>Gece</label><input type="number" id="offer-nights" value="${esc(offer.nights ?? '')}" min="0"></div>
          <div><label>Kişi</label><input type="number" id="offer-guests" value="${esc(offer.guests ?? '')}" min="0"></div>
          <div><label>Oda Tipi</label><input id="offer-room_type" value="${esc(offer.room_type || '')}" placeholder="örn. Deniz Manzaralı"></div>
          <div><label>Pansiyon</label><select id="offer-board_type">
            <option value="">—</option>
            ${['BB', 'HB', 'FB', 'AI', 'UAI'].map(b => `<option value="${b}" ${b === offer.board_type ? 'selected' : ''}>${esc(b)}</option>`).join('')}
          </select></div>
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;" class="no-print">
          <button class="btn small" data-action="save-header">Konaklamayı Kaydet</button>
          <div class="spacer"></div>
        </div>

        <div class="section-title">Kalemler</div>
        <table class="offer-items-table">
          <thead><tr><th>Kategori</th><th>Açıklama</th><th class="num" style="width:80px">Adet</th><th class="num" style="width:110px">Birim Fiyat</th><th class="num" style="width:110px">Toplam</th><th class="no-print" style="width:40px"></th></tr></thead>
          <tbody id="offer-items-body">
            ${offer.items.map(itemRow).join('') || '<tr><td colspan="6" class="empty">Kalem ekle</td></tr>'}
          </tbody>
        </table>
        <div style="display:flex; gap:8px; align-items:center;" class="no-print">
          <select id="new-item-category" style="width:160px">${categories.map(c => `<option>${esc(c)}</option>`).join('')}</select>
          <input id="new-item-desc" placeholder="Kalem açıklaması..." style="flex:1">
          <input id="new-item-qty" type="number" value="1" style="width:70px" min="1">
          <input id="new-item-price" type="number" value="0" style="width:110px" step="0.01">
          <button class="btn primary small" data-action="add-item">+ Kalem</button>
        </div>

        <div class="totals-box">
          <div class="row"><span>Ara Toplam</span><span>${fmtAmount(t.subtotal, offer.currency)}</span></div>
          <div class="row"><span>İndirim (%${Number(offer.discount_rate) || 0})</span><span>− ${fmtAmount(t.discount_amount, offer.currency)}</span></div>
          <div class="row"><span>Vergi (%${Number(offer.tax_rate) || 0})</span><span>+ ${fmtAmount(t.tax_amount, offer.currency)}</span></div>
          <div class="row grand"><span>Genel Toplam</span><span>${fmtAmount(t.total, offer.currency)}</span></div>
        </div>

        <div class="section-title no-print">Ek Ayarlar</div>
        <div class="form-grid no-print">
          <div><label>İndirim %</label><input type="number" id="offer-discount" value="${esc(offer.discount_rate ?? 0)}" min="0" max="100"></div>
          <div><label>Vergi %</label><input type="number" id="offer-tax" value="${esc(offer.tax_rate ?? 0)}" min="0" max="100"></div>
          <div><label>Komisyon %</label><input type="number" id="offer-commission" value="${esc(offer.commission_rate ?? 0)}" min="0"></div>
          <div><label>Geçerlilik</label><input type="date" id="offer-valid" value="${esc(offer.valid_until || '')}"></div>
          <div class="full"><label>Notlar</label><textarea id="offer-notes">${esc(offer.notes || '')}</textarea></div>
        </div>
        <div class="form-actions no-print">
          <button class="btn primary" data-action="save-extra">Ayarları ve Notu Kaydet</button>
        </div>

        <div class="section-title no-print">Versiyonlar</div>
        <div class="version-list no-print">
          ${offer.versions.map(v => `
            <button class="version-chip ${v.id === offer.id ? 'current' : ''}" data-action="open-version" data-id="${v.id}">
              v${v.version} <span class="vstatus">(${esc(v.status)})</span>
            </button>`).join('')}
        </div>
      </div>
    `;

    // Toolbar actions
    $('[data-action=back]').addEventListener('click', () => navigate('offers'));
    $('[data-action=print]').addEventListener('click', () => window.print());
    $('[data-action=revision]').addEventListener('click', async () => {
      try {
        const r = await api(`/api/crm/offers/${id}/revision`, { method: 'POST' });
        toast(`Revizyon oluşturuldu (v${r.version})`);
        openOfferEditor(r.id);
      } catch (e) { toast(e.message, true); }
    });
    $('[data-action=status]').addEventListener('change', async e => {
      const status = e.target.value;
      let lostReason = null;
      if (status === 'lost') {
        lostReason = prompt('Kayıp nedeni (fiyat, tarih, müsaitlik, rakip, cevap_yok)?');
        if (!lostReason) { e.target.value = offer.status; return; }
      }
      try {
        await api(`/api/crm/offers/${id}/status`, { method: 'POST', body: JSON.stringify({ status, lost_reason: lostReason }) });
        toast('Durum güncellendi');
        openOfferEditor(id);
      } catch (e2) { toast(e2.message, true); openOfferEditor(id); }
    });

    // Header save
    $('[data-action=save-header]').addEventListener('click', async () => {
      const payload = {
        check_in: $('#offer-check_in').value || null,
        check_out: $('#offer-check_out').value || null,
        nights: $('#offer-nights').value ? Number($('#offer-nights').value) : null,
        guests: $('#offer-guests').value ? Number($('#offer-guests').value) : null,
        room_type: $('#offer-room_type').value || null,
        board_type: $('#offer-board_type').value || null
      };
      try {
        await api(`/api/crm/offers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Konaklama kaydedildi');
        openOfferEditor(id);
      } catch (e) { toast(e.message, true); }
    });
    $('#offer-title').addEventListener('change', async e => {
      if (!e.target.value.trim()) return;
      await api(`/api/crm/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ title: e.target.value.trim() }) });
    });

    // Extra settings
    $('[data-action=save-extra]').addEventListener('click', async () => {
      const payload = {
        discount_rate: Number($('#offer-discount').value) || 0,
        tax_rate: Number($('#offer-tax').value) || 0,
        commission_rate: Number($('#offer-commission').value) || 0,
        valid_until: $('#offer-valid').value || null,
        notes: $('#offer-notes').value || null
      };
      try {
        await api(`/api/crm/offers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Ayarlar kaydedildi');
        openOfferEditor(id);
      } catch (e) { toast(e.message, true); }
    });

    // Items
    $('[data-action=add-item]').addEventListener('click', async () => {
      const desc = $('#new-item-desc').value.trim();
      if (!desc) return toast('Kalem açıklaması gerekli', true);
      try {
        await api(`/api/crm/offers/${id}/items`, { method: 'POST', body: JSON.stringify({
          category: $('#new-item-category').value,
          description: desc,
          qty: Number($('#new-item-qty').value) || 1,
          unit_price: Number($('#new-item-price').value) || 0
        }) });
        openOfferEditor(id);
      } catch (e) { toast(e.message, true); }
    });

    // Version chips
    $$('[data-action=open-version]').forEach(chip => chip.addEventListener('click', () => openOfferEditor(chip.dataset.id)));
  }

  function itemRow(item) {
    const categories = ['konaklama', 'transfer', 'tekne_yat', 'restoran', 'etkinlik', 'ozel_istek'];
    return `<tr data-item-id="${item.id}">
      <td><select data-edit="category" style="width:130px">${categories.map(c => `<option ${c === item.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
      <td><input data-edit="description" value="${esc(item.description)}"></td>
      <td><input data-edit="qty" type="number" value="${item.qty}" min="0" style="width:70px; text-align:right"></td>
      <td><input data-edit="unit_price" type="number" value="${item.unit_price}" step="0.01" style="width:100px; text-align:right"></td>
      <td class="total-cell">${fmtAmount(item.total_price, '')}</td>
      <td class="no-print"><button class="btn small ghost" data-action="del-item">🗑</button></td>
    </tr>`;
  }

  // Event delegation for offer item edits (registered once in init)
  function bindOfferItemEvents() {
    document.addEventListener('change', async (e) => {
      const input = e.target;
      const row = input.closest?.('[data-item-id]');
      if (!row) return;
      const field = input.dataset?.edit;
      if (!field) return;
      const payload = {};
      if (field === 'category') payload.category = input.value;
      else if (field === 'description') payload.description = input.value;
      else if (field === 'qty') payload.qty = Number(input.value);
      else if (field === 'unit_price') payload.unit_price = Number(input.value);
      try {
        await api(`/api/crm/offer-items/${row.dataset.itemId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Kalem güncellendi');
        openOfferEditor(state.currentOfferId);
      } catch (err) { toast(err.message, true); }
    });

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest?.('[data-action=del-item]');
      if (!btn) return;
      const row = btn.closest('[data-item-id]');
      if (!row) return;
      try {
        await api(`/api/crm/offer-items/${row.dataset.itemId}`, { method: 'DELETE' });
        toast('Kalem silindi');
        openOfferEditor(state.currentOfferId);
      } catch (err) { toast(err.message, true); }
    });
  }

  // ─── FOLLOWUPS (Faz 4) ──────────────────────────────────────────────
  async function renderFollowups() {
    const fups = await api('/api/crm/followups');
    $('#view-container').innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
        <div class="muted small">ERP rezervasyonlarından otomatik üretilir. İletişim izni olmayan misafirler kuyruğa düşmez.</div>
        <button class="btn primary" data-action="generate-followups">⟳ ERP'den Takip Üret</button>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Tip</th><th>Fırsat</th><th>Kontak</th><th>Rezervasyon</th><th>Son Tarih</th><th>Durum</th><th></th></tr></thead>
          <tbody>${fups.map(followupRow).join('') || '<tr><td colspan="7" class="empty">Takip yok — "ERP\'den Takip Üret" ile ERP çıkışlarından kuyruk oluşturun.</td></tr>'}</tbody>
        </table>
      </div>
    `;

        $('[data-action=generate-followups]').addEventListener('click', async () => {
      try {
        const r = await api('/api/crm/followups/generate', { method: 'POST' });
        toast(`Takip üretildi: ${r.created} (${r.skipped} izinsiz atlandı)`);
        renderFollowups();
      } catch (e) { toast(e.message, true); }
    });
    $$('[data-action=fup-done]').forEach(btn => btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      await api(`/api/crm/followups/${tr.dataset.fupId}/action`, { method: 'POST', body: JSON.stringify({ action: 'done' }) });
      toast('Takip tamamlandı');
      renderFollowups();
    }));
    $$('[data-action=fup-snooze]').forEach(btn => btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      await api(`/api/crm/followups/${tr.dataset.fupId}/action`, { method: 'POST', body: JSON.stringify({ action: 'snooze' }) });
      toast('3 gün ertelendi');
      renderFollowups();
    }));
    $$('[data-action=fup-skip]').forEach(btn => btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      await api(`/api/crm/followups/${tr.dataset.fupId}/action`, { method: 'POST', body: JSON.stringify({ action: 'skip' }) });
      toast('Takip atlandı');
      renderFollowups();
    }));
    $$('[data-action=fup-create-opp]').forEach(btn => btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      try {
        const r = await api(`/api/crm/followups/${tr.dataset.fupId}/create-opportunity`, { method: 'POST' });
        toast('Tekrar konaklama fırsatı oluşturuldu');
        renderFollowups();
      } catch (e) { toast(e.message, true); }
    }));
  }

  function followupRow(f) {
    const actions = f.stage === 'pending'
      ? '<button class="btn small primary" data-action="fup-create-opp">⇄ Tekrar Fırsat</button>'
        + '<button class="btn small" data-action="fup-done">✓ Tamamla</button>'
        + '<button class="btn small ghost" data-action="fup-snooze">Ertele</button>'
        + '<button class="btn small ghost" data-action="fup-skip">Atla</button>'
      : '';
    return '<tr data-fup-id="' + f.id + '">'
      + '<td><span class="badge">' + (f.type === 'pre_stay' ? 'Ön Takip' : 'Sonrası') + '</span></td>'
      + '<td class="small">' + esc(f.opportunity_title || '—') + '</td>'
      + '<td class="small">' + esc(f.contact_name || '—') + (f.marketing_consent === 1 ? '' : '<span class="badge" style="background:#fee2e2;color:#b91c1c">izinsiz</span>') + '</td>'
      + '<td class="small">' + esc(f.erp_reservation_no || '—') + '</td>'
      + '<td class="small">' + (f.due_date ? dateText(f.due_date) : '—') + '</td>'
      + '<td><span class="badge">' + esc(f.stage) + '</span></td>'
      + '<td class="row-actions">' + actions + '</td>'
      + '</tr>';
  }

  // ─── CAMPAIGNS (Faz 4) ──────────────────────────────────────────────
  async function renderCampaigns() {
    const camps = await api('/api/crm/campaigns');
    $('#view-container').innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div class="muted small">Kampanyalar yalnızca iletişim izni olan kontaklara gönderilir; izinsizler otomatik atlanır.</div>
        <button class="btn primary" data-action="new-campaign">+ Yeni Kampanya</button>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Kampanya</th><th>Segment</th><th>Durum</th><th>Gönderildi</th><th>Atlandı</th><th>Tarih</th><th></th></tr></thead>
          <tbody>${camps.map(c => `
            <tr data-camp-id="${c.id}">
              <td><strong>${esc(c.name)}</strong></td>
              <td><span class="badge">${esc(c.segment)}</span></td>
              <td><span class="badge">${esc(c.status)}</span></td>
              <td>${c.sent_count}</td>
              <td>${c.skipped_count}</td>
              <td class="small">${dateText(c.created_at)}</td>
              <td class="row-actions">
                ${c.status === 'draft' ? `<button class="btn small primary" data-action="run-campaign">▶ Gönder</button>` : `<button class="btn small ghost" data-action="view-campaign">Detay</button>`}
              </td>
            </tr>`).join('') || '<tr><td colspan="7" class="empty">Kampanya yok</td></tr>'}</tbody>
        </table>
      </div>
    `;
    $('[data-action=new-campaign]').addEventListener('click', () => {
      openModal('Yeni Kampanya', `
        <form id="campaign-form">
          <div class="form-grid">
            <div class="full"><label>Kampanya Adı *</label><input name="name" required></div>
            <div><label>Hedef Segment</label><select name="segment">
              ${['direkt', 'acente', 'kurumsal', 'vip', 'tekrar_gelen', 'kaybedilen'].map(s => `<option>${esc(s)}</option>`).join('')}
            </select></div>
            <div><label>Planlanan Tarih</label><input name="scheduled_at" type="date"></div>
          </div>
          <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Oluştur</button></div>
        </form>
      `);
      submitForm($('#campaign-form'), async data => {
        await api('/api/crm/campaigns', { method: 'POST', body: JSON.stringify(data) });
        closeModal();
        renderCampaigns();
      });
    });
    $$('[data-action=run-campaign]').forEach(btn => btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      try {
        const r = await api(`/api/crm/campaigns/${tr.dataset.campId}/run`, { method: 'POST' });
        toast(`Gönderildi: ${r.sent}, izinsiz atlandı: ${r.skipped}`);
        renderCampaigns();
      } catch (e) { toast(e.message, true); }
    }));
    $$('[data-action=view-campaign]').forEach(btn => btn.addEventListener('click', async () => {
      const tr = btn.closest('tr');
      const rows = await api(`/api/crm/campaigns/${tr.dataset.campId}/contacts`);
      openModal('Kampanya Detayı', `
        <table class="table">
          <thead><tr><th>Kontak</th><th>E-posta</th><th>Durum</th><th>Neden</th></tr></thead>
          <tbody>${rows.map(x => `<tr>
            <td>${esc(x.contact_name || '—')}</td>
            <td class="small">${esc(x.email || '—')}</td>
            <td><span class="badge">${esc(x.status)}</span></td>
            <td class="small">${esc(x.reason || '—')}</td>
          </tr>`).join('') || '<tr><td colspan="4" class="empty">Kayıt yok</td></tr>'}</tbody>
        </table>
      `);
    }));
  }

  // ─── REPORTS (Faz 5) ────────────────────────────────────────────────
  async function renderReports() {
    const [pipe, conv, perf, timing, lost, recon] = await Promise.all([
      api('/api/crm/reports/pipeline'),
      api('/api/crm/reports/conversion'),
      api('/api/crm/reports/performance'),
      api('/api/crm/reports/timing'),
      api('/api/crm/reports/lost-analysis'),
      api('/api/crm/reports/reconciliation').catch(() => null)
    ]);

    const pctRow = (label, value) => `<div class="stat-row"><span>${label}</span><strong>${value}%</strong></div>`;

    $('#view-container').innerHTML = `
      <div class="grid cols-3">
        <div class="card">
          <div class="section-title">Pipeline Dağılımı</div>
          <div class="stat-big">${pipe.total_opportunities} <span>fırsat</span></div>
          <div class="muted small">Toplam: ${fmtAmount(pipe.total_amount, 'EUR')}</div>
          <div class="bar-list">
            ${pipe.breakdown.map(r => `
              <div class="bar-row">
                <span>${esc(r.pipeline_stage)}</span>
                <div class="bar"><div style="width:${pipe.total_opportunities ? Math.max(4, (r.cnt / pipe.total_opportunities) * 100) : 0}%"></div></div>
                <strong>${r.cnt}</strong>
              </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="section-title">Dönüşüm Hunisi</div>
          <div class="funnel">
            ${funnelRow('Lead', conv.leads, 100)}
            ${funnelRow('Fırsat', conv.opportunities, conv.opportunities && conv.leads ? (conv.opportunities / Math.max(conv.leads, 1)) * 100 : 0)}
            ${funnelRow('Teklif', conv.opportunities_with_offer, conv.opportunities_with_offer && conv.opportunities ? (conv.opportunities_with_offer / Math.max(conv.opportunities, 1)) * 100 : 0)}
            ${funnelRow('Kazanılan', conv.won, conv.won && conv.opportunities ? (conv.won / Math.max(conv.opportunities, 1)) * 100 : 0)}
          </div>
          <div style="margin-top:10px">
            ${pctRow('Lead → Fırsat', conv.lead_to_opportunity_rate)}
            ${pctRow('Fırsat → Teklif', conv.opportunity_to_offer_rate)}
            ${pctRow('Kazanma (win rate)', conv.win_rate)}
            ${pctRow('Kayıp (loss rate)', conv.loss_rate)}
          </div>
        </div>

        <div class="card">
          <div class="section-title">Zamanlama (gün)</div>
          <div class="stat-big">${timing.avg_lead_to_opportunity_days ?? '—'} <span>lead→fırsat</span></div>
          <div class="stat-big" style="margin-top:8px">${timing.avg_opportunity_to_won_days ?? '—'} <span>fırsat→satış</span></div>
          <div class="muted small" style="margin-top:8px">Örneklem: ${timing.sample_leads} lead, ${timing.sample_won} kazanılan fırsat</div>
          <div class="section-title" style="margin-top:16px">Kayıp Analizi</div>
          <div class="bar-list">
            ${lost.by_reason.map(r => `
              <div class="bar-row"><span>${esc(r.reason)}</span><div class="bar" style="background:#fee2e2"><div style="width:${lost.total_lost ? Math.max(4, (r.cnt / lost.total_lost) * 100) : 0}%; background:#b91c1c"></div></div><strong>${r.cnt}</strong></div>`).join('') || '<div class="empty small">Kayıp yok</div>'}
          </div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:16px">
        <div class="card">
          <div class="section-title">Temsilci / Kaynak Performansı</div>
          <table class="table">
            <thead><tr><th>Temsilci</th><th>Fırsat</th><th>Toplam</th><th>Kazanılan</th></tr></thead>
            <tbody>${perf.by_owner.map(o => `<tr><td><strong>${esc(o.owner_name || '—')}</strong></td><td>${o.cnt}</td><td>${fmtAmount(o.total_amt, 'EUR')}</td><td>${o.won}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Veri yok</td></tr>'}</tbody>
          </table>
          <div class="section-title" style="margin-top:12px">Kaynak Bazında</div>
          <table class="table">
            <thead><tr><th>Kaynak</th><th>Fırsat</th><th>Toplam</th><th>Kazanılan</th></tr></thead>
            <tbody>${perf.by_source.map(o => `<tr><td>${esc(o.source || '—')}</td><td>${o.cnt}</td><td>${fmtAmount(o.total_amt, 'EUR')}</td><td>${o.won}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Veri yok</td></tr>'}</tbody>
          </table>
        </div>

        <div class="card">
          <div class="section-title">CRM ↔ ERP Gelir Mutabakatı</div>
          ${recon ? `
            <div class="stat-row"><span>CRM toplam</span><strong>${fmtAmount(recon.crm_total, 'EUR')}</strong></div>
            <div class="stat-row"><span>ERP toplam</span><strong>${fmtAmount(recon.erp_total, 'EUR')}</strong></div>
            <div class="stat-row ${Math.abs(recon.difference) < 0.01 ? '' : 'warn'}"><span>Fark</span><strong>${fmtAmount(recon.difference, 'EUR')}</strong></div>
            <div class="muted small" style="margin:8px 0">Mutabakatı tamamlanmamış: <strong>${recon.unreconciled}</strong> / ${recon.count}</div>
            <table class="table">
              <thead><tr><th>Fırsat</th><th>ERP No</th><th>Durum</th><th>CRM</th><th>ERP</th></tr></thead>
              <tbody>${recon.rows.map(r => `<tr>
                <td class="small">${esc(r.title)}</td>
                <td class="small">${esc(r.erp_reservation_no || '—')}</td>
                <td><span class="badge">${esc(r.erp_status || '—')}</span></td>
                <td class="small">${fmtAmount(r.amount, r.currency)}</td>
                <td class="small">${fmtAmount(r.erp_total_amount, r.erp_currency)}</td>
              </tr>`).join('') || '<tr><td colspan="5" class="empty">Dönüştürülmüş fırsat yok</td></tr>'}</tbody>
            </table>` : '<div class="alert error">Mutabakat raporu yönetici yetkisi gerektirir.</div>'}
        </div>
      </div>
    `;
  }

  function funnelRow(label, value, pct) {
    return `<div class="funnel-row">
      <span>${label} <strong>${value ?? 0}</strong></span>
      <div class="bar"><div style="width:${Math.max(6, pct)}%"></div></div>
    </div>`;
  }

  // ─── INTEGRATION LOGS ───────────────────────────────────────────────
  async function renderIntegration() {
    let config = { erp_url: '—', reachable: false, pending_errors: 0 };
    let logs = [];
    try { config = await api('/api/crm/integration/config'); } catch (e) {}
    try { logs = await api('/api/crm/integration/logs'); } catch (e) {}

    $('#view-container').innerHTML = `
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px;">
        <div class="card" style="flex:1; min-width:280px;">
          <div class="section-title">ERP Bağlantısı</div>
          <div style="display:flex; align-items:center; gap:10px; margin:8px 0;">
            <span class="badge" style="background:${config.reachable ? '#dcfce7;color:#15803d' : '#fee2e2;color:#b91c1c'}">${config.reachable ? '● Bağlı' : '○ Bağlantı yok'}</span>
            <span class="small muted">${esc(config.erp_url)}</span>
          </div>
          ${config.health ? `<div class="small muted">ERP: ${esc(config.health.system || '—')} · ${dateText(config.health.time)}</div>` : '<div class="small muted">ERP yanıt vermiyor — sandbox (crm/erp_server.js) veya ERP_API_URL kontrol edin.</div>'}
          <div class="small" style="margin-top:6px;">Bekleyen hata: <strong>${config.pending_errors}</strong></div>
        </div>
        <div class="card" style="flex:1; min-width:280px;">
          <div class="section-title">Müsaitlik / Fiyat Sorgula</div>
          <div class="form-grid">
            <div><label>Giriş</label><input type="date" id="av-check_in"></div>
            <div><label>Çıkış</label><input type="date" id="av-check_out"></div>
            <div><label>Oda Tipi</label><select id="av-room_type">
              <option value="rt_std">Standart</option><option value="rt_dlx" selected>Deluxe</option><option value="rt_suit">Suit</option>
            </select></div>
            <div><label>Pansiyon</label><select id="av-board"><option value="BB">BB</option><option value="HB" selected>HB</option><option value="FB">FB</option><option value="AI">AI</option><option value="UAI">UAI</option></select></div>
            <div><label>Kişi</label><input type="number" id="av-guests" value="2" min="1"></div>
            <div><label>Kur</label><select id="av-currency"><option>EUR</option><option>USD</option><option>TRY</option></select></div>
          </div>
          <div class="form-actions"><button class="btn primary" data-action="check-avail">Sorgula</button></div>
          <div id="av-result"></div>
        </div>
      </div>
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="section-title" style="margin:0;">Entegrasyon Günlüğü</div>
          <button class="btn small ghost" data-action="refresh-int">↻ Yenile</button>
        </div>
        <table class="table">
          <thead><tr><th>İşlem</th><th>Fırsat</th><th>Durum</th><th>Hata</th><th>Retry</th><th>Tarih</th><th></th></tr></thead>
          <tbody>${logs.map(l => `<tr>
            <td>${esc(l.operation)}</td>
            <td class="small">${esc(l.opportunity_title || '—')}</td>
            <td><span class="badge ${l.status === 'success' || l.status === 'resolved' ? '' : 'error'}">${esc(l.status)}</span></td>
            <td class="small">${esc(l.error_message || '—')}</td>
            <td>${l.retry_count}</td>
            <td class="small">${dateText(l.created_at)}</td>
            <td class="row-actions">${l.status === 'error' && l.opportunity_id ? `<button class="btn small primary" data-action="retry-log" data-id="${l.id}">Tekrar Dene</button>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="7" class="empty">Kayıt yok</td></tr>'}</tbody>
        </table>
      </div>
    `;

    $('[data-action=check-avail]').addEventListener('click', async () => {
      const el = $('#av-result');
      el.innerHTML = '<div class="muted small">Sorgulanıyor...</div>';
      try {
        const r = await api('/api/crm/integration/availability', { method: 'POST', body: JSON.stringify({
          check_in: $('#av-check_in').value, check_out: $('#av-check_out').value,
          room_type: $('#av-room_type').value, board: $('#av-board').value,
          guests: Number($('#av-guests').value), currency: $('#av-currency').value
        }) });
        el.innerHTML = r.available
          ? `<div class="alert success">✓ ${esc(r.message)} — ${esc(r.room_name)} · ${r.nights} gece · gece ${fmtAmount(r.nightly, r.currency)} · <strong>toplam ${fmtAmount(r.total, r.currency)}</strong></div>`
          : `<div class="alert error">✗ ${esc(r.message)}</div>`;
      } catch (e) { el.innerHTML = `<div class="alert error">${esc(e.message)}</div>`; }
    });

    $('[data-action=refresh-int]').addEventListener('click', () => renderIntegration());
    $$('[data-action=retry-log]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api(`/api/crm/integration/logs/${btn.dataset.id}/retry`, { method: 'POST' });
        toast('Retry tamamlandı');
        renderIntegration();
      } catch (e) { toast(e.message, true); }
    }));
  }

  // ─── USERS (admin) ──────────────────────────────────────────────────
  async function renderUsers() {
    if (!isManagement()) {
      $('#view-container').innerHTML = '<div class="card"><div class="alert error">Bu görünüm yönetici yetkisi gerektirir.</div></div>';
      return;
    }
    const users = await api('/api/crm/users');
    $('#view-container').innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:14px;">
        <div class="muted small">${users.length} kullanıcı</div>
        <button class="btn primary" data-action="new-user">+ Yeni Kullanıcı</button>
      </div>
      <div class="card">
        <table class="table">
          <thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th>Durum</th><th></th></tr></thead>
          <tbody>${users.map(u => `<tr data-user-id="${u.id}">
            <td><strong>${esc(u.name)}</strong></td>
            <td>${esc(u.email)}</td>
            <td><span class="badge role">${esc(u.role)}</span></td>
            <td>${u.active ? '<span class="badge" style="background:#dcfce7;color:#15803d">Aktif</span>' : '<span class="badge" style="background:#fee2e2;color:#b91c1c">Pasif</span>'}</td>
            <td class="row-actions"><button class="btn small ghost" data-action="toggle-user">${u.active ? 'Pasifleştir' : 'Aktifleştir'}</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    $('[data-action=new-user]').addEventListener('click', openUserForm);
    $$('tr[data-user-id]').forEach(tr => {
      $('[data-action=toggle-user]', tr).addEventListener('click', async () => {
        const u = users.find(x => x.id === tr.dataset.userId);
        await api(`/api/crm/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) });
        toast('Güncellendi');
        renderUsers();
      });
    });
  }

  function openUserForm() {
    openModal('Yeni Kullanıcı', `
      <form id="user-form">
        <div class="form-grid">
          <div><label>Ad Soyad *</label><input name="name" required></div>
          <div><label>E-posta *</label><input name="email" type="email" required></div>
          <div><label>Parola *</label><input name="password" type="password" required></div>
          <div><label>Rol</label><select name="role"><option value="satis">Satış</option><option value="rezervasyon">Rezervasyon</option><option value="acente_yoneticisi">Acente Yöneticisi</option><option value="yönetici">Yönetici</option></select></div>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Kaydet</button></div>
      </form>
    `);
    submitForm($('#user-form'), data => api('/api/crm/users', { method: 'POST', body: JSON.stringify(data) }));
  }

  // ─── OPPORTUNITY DETAIL ─────────────────────────────────────────────
  async function openOpportunityDetail(id) {
    const opp = await api(`/api/crm/opportunities/${id}`);
    const stages = state.config.pipeline_stages;
    openModal(esc(opp.title), `
      <div class="detail-header">
        <div>
          ${stageBadge(opp.pipeline_stage)}
          <div class="small muted" style="margin-top:8px">
            ${opp.firm_name ? esc(opp.firm_name) + ' · ' : ''}${opp.contact_name ? esc(opp.contact_name) + ' · ' : ''}${esc(opp.owner_name || '—')}
          </div>
          <div style="margin-top:6px"><strong>${fmtAmount(opp.amount, opp.currency)}</strong></div>
          ${opp.close_date ? `<div class="small muted">Kapanış: ${dateText(opp.close_date)}</div>` : ''}
          ${opp.lost_reason ? `<div class="small" style="color:var(--danger)">Kayıp nedeni: ${esc(opp.lost_reason)}</div>` : ''}
        </div>
        <select id="stage-select" class="small" style="width:auto">
          ${stages.map(s => `<option value="${s}" ${s === opp.pipeline_stage ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
      </div>
      <div id="stage-message" class="hidden"></div>

      <div class="section-title">ERP Rezervasyonu</div>
      <div id="erp-panel">
        ${opp.erp_reservation_no
          ? `<div class="small" style="margin-bottom:6px">
              <span class="badge" style="background:#e0e7ff;color:#3730a3">${esc(opp.erp_reservation_no)}</span>
              <span class="badge">${esc(opp.erp_status || '—')}</span>
              ${opp.erp_total_amount ? `<span class="muted small">· ${fmtAmount(opp.erp_total_amount, opp.erp_currency)}</span>` : ''}
              ${opp.erp_check_in ? `<span class="muted small">· ${dateText(opp.erp_check_in)} → ${dateText(opp.erp_check_out)}</span>` : ''}
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn small" data-action="refresh-erp">↻ ERP Durumunu Yenile</button>
            </div>`
          : opp.pipeline_stage === 'won'
            ? `<div class="small muted" style="margin-bottom:6px">Bu kazanılmış fırsat henüz ERP rezervasyonuna dönüştürülmedi.</div>
               <button class="btn small primary" data-action="convert-erp">⇄ ERP Rezervasyonuna Dönüştür</button>`
            : `<div class="small muted">Fırsat kazanıldığında ERP rezervasyonuna dönüştürülebilir.</div>`}
      </div>

      <div class="section-title">Görevler</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <input id="quick-task" placeholder="Hızlı görev ekle..." style="flex:1">
        <button class="btn small primary" data-action="add-quick-task">+</button>
      </div>
      <div id="opp-tasks" style="margin-top:8px">
        ${opp.tasks.map(t => `<div class="small" style="padding:4px 0"><label style="display:inline; text-transform:none; letter-spacing:0"><input type="checkbox" ${t.status === 'done' ? 'checked' : ''} onchange="window.__toggleTask('${t.id}', this.checked)"> ${esc(t.title)}</label> <span class="muted">${t.due_date ? dateText(t.due_date) : ''}</span></div>`).join('') || '<div class="empty small">Görev yok</div>'}
      </div>

      <div class="section-title">Aktiviteler</div>
      <div id="opp-activities" class="timeline">
        ${opp.activities.map(a => `<li><div class="dot">${iconFor(a.type)}</div><div><strong>${esc(a.subject)}</strong><div class="muted small">${esc(a.owner_name || '')} · ${dateText(a.activity_at)}</div>${a.notes ? `<div class="small">${esc(a.notes)}</div>` : ''}</div></li>`).join('') || '<div class="empty small">Aktivite yok</div>'}
      </div>
      <div style="display:flex; gap:8px; margin-top:8px">
        <input id="quick-activity" placeholder="Hızlı aktivite..." style="flex:1">
        <select id="quick-activity-type" class="small" style="width:auto">${state.config.activity_types.map(t => `<option>${esc(t)}</option>`).join('')}</select>
        <button class="btn small primary" data-action="add-quick-activity">+</button>
      </div>

      <div class="section-title">Teklifler (${opp.offers.length})</div>
      ${opp.offers.map(o => `<div class="small">v${o.version} ${esc(o.title)} · ${esc(o.status)} · %${Number(o.discount_rate) || 0}</div>`).join('') || '<div class="empty small">Teklif yok</div>'}
      <button class="btn small" data-action="new-offer" style="margin-top:6px">+ Teklif Oluştur</button>
    `);

    $('#stage-select').addEventListener('change', async e => {
      const stage = e.target.value;
      if (stage === 'lost') {
        const reason = prompt('Kayıp nedeni (fiyat, tarih, müsaitlik, rakip, cevap_yok)?');
        if (!reason) { e.target.value = opp.pipeline_stage; return; }
        await api(`/api/crm/opportunities/${id}/stage`, { method: 'POST', body: JSON.stringify({ pipeline_stage: stage, lost_reason: reason }) });
      } else {
        await api(`/api/crm/opportunities/${id}/stage`, { method: 'POST', body: JSON.stringify({ pipeline_stage: stage }) });
      }
      toast('Aşama güncellendi');
      openOpportunityDetail(id);
    });

    $('[data-action=add-quick-task]').addEventListener('click', async () => {
      const title = $('#quick-task').value.trim();
      if (!title) return;
      await api('/api/crm/tasks', { method: 'POST', body: JSON.stringify({ title, related_type: 'opportunity', related_id: id, owner_id: state.user.id }) });
      $('#quick-task').value = '';
      openOpportunityDetail(id);
    });
    $('[data-action=add-quick-activity]').addEventListener('click', async () => {
      const subject = $('#quick-activity').value.trim();
      if (!subject) return;
      await api('/api/crm/activities', { method: 'POST', body: JSON.stringify({ subject, opportunity_id: id, type: $('#quick-activity-type').value }) });
      $('#quick-activity').value = '';
      openOpportunityDetail(id);
    });
    $('[data-action=new-offer]').addEventListener('click', () => {
      const title = prompt('Teklif başlığı?');
      if (!title) return;
      api('/api/crm/offers', { method: 'POST', body: JSON.stringify({ opportunity_id: id, title }) }).then(() => { toast('Teklif oluşturuldu'); openOpportunityDetail(id); }).catch(e => toast(e.message, true));
    });

    const convertBtn = $('[data-action=convert-erp]');
    if (convertBtn) convertBtn.addEventListener('click', async () => {
      convertBtn.disabled = true;
      convertBtn.textContent = 'Dönüştürülüyor...';
      try {
        const r = await api(`/api/crm/integration/opportunities/${id}/convert`, { method: 'POST' });
        toast(r.duplicate ? `Zaten dönüştürülmüş: ${r.reservation_no}` : `ERP rezervasyonu: ${r.reservation_no}`);
        openOpportunityDetail(id);
      } catch (e) {
        toast(e.message, true);
        convertBtn.disabled = false;
        convertBtn.textContent = '⇄ ERP Rezervasyonuna Dönüştür';
      }
    });

    const refreshErp = $('[data-action=refresh-erp]');
    if (refreshErp) refreshErp.addEventListener('click', async () => {
      refreshErp.disabled = true;
      try {
        const r = await api(`/api/crm/integration/opportunities/${id}/refresh-status`, { method: 'POST' });
        toast(`ERP durumu: ${r.erp_status}`);
        openOpportunityDetail(id);
      } catch (e) {
        toast(e.message, true);
        refreshErp.disabled = false;
      }
    });
  }

  // ─── GLOBAL SEARCH ──────────────────────────────────────────────────
  async function runSearch(q) {
    if (q.length < 2) { $('#search-results').classList.add('hidden'); return; }
    const results = await api('/api/crm/search?q=' + encodeURIComponent(q));
    const html = [];
    if (results.firms.length) html.push(`<div class="card"><strong>Firmalar</strong><div>${results.firms.map(f => `<div><a data-goto="firms">${esc(f.name)}</a> <span class="muted small">${esc(f.city || '')}</span></div>`).join('')}</div></div>`);
    if (results.contacts.length) html.push(`<div class="card"><strong>Kişiler</strong><div>${results.contacts.map(c => `<div>${esc(c.name)} <span class="muted small">${esc(c.email || c.phone || '')}</span></div>`).join('')}</div></div>`);
    if (results.opportunities.length) html.push(`<div class="card"><strong>Fırsatlar</strong><div>${results.opportunities.map(o => `<div><a data-goto="pipeline" data-id="${o.id}">${esc(o.title)}</a> ${stageBadge(o.pipeline_stage)}</div>`).join('')}</div></div>`);
    if (results.leads.length) html.push(`<div class="card"><strong>Lead'ler</strong><div>${results.leads.map(l => `<div>${esc(l.source)} <span class="muted small">${esc(l.notes || '')}</span></div>`).join('')}</div></div>`);
    const box = $('#search-results');
    box.innerHTML = html.join('') || '<div class="card muted small">Sonuç yok</div>';
    box.classList.remove('hidden');
    $$('[data-goto]', box).forEach(el => el.addEventListener('click', async () => {
      box.classList.add('hidden');
      await navigate(el.dataset.goto);
    }));
  }

  // ─── AUTH FLOW ──────────────────────────────────────────────────────
  function isManagement() {
    return String(state.user?.role || '').toLocaleLowerCase('tr-TR') === 'yönetici';
  }

  function applyUserVisibility() {
    $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isManagement()));
  }

  async function init() {
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#login-error').classList.add('hidden');
      try {
        await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#login-email').value, password: $('#login-password').value }) });
        await enterApp();
      } catch (err) {
        $('#login-error').textContent = err.message;
        $('#login-error').classList.remove('hidden');
      }
    });

    $('#logout-btn').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      state.user = null;
      $('#app-view').classList.add('hidden');
      $('#login-view').classList.remove('hidden');
    });

    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    $('#quick-new-btn').addEventListener('click', () => {
      const actions = { pipeline: 'Fırsat', leads: 'Lead', firms: 'Firma', contacts: 'Kişi', tasks: 'Görev', activities: 'Aktivite' };
      const target = actions[state.currentView];
      if (!target) return navigate('leads');
      if (state.currentView === 'pipeline') return openOpportunityForm();
      const handlers = { leads: openLeadForm, firms: openFirmForm, contacts: openContactForm, tasks: openTaskForm, activities: openActivityForm };
      handlers[state.currentView]();
    });

    $$('#nav a[data-view]').forEach(a => a.addEventListener('click', () => navigate(a.dataset.view)));
    $('#global-search').addEventListener('input', debounce(e => runSearch(e.target.value), 350));
    bindOfferItemEvents();

    await enterApp();
  }

  function openOpportunityForm() {
    openModal('Yeni Fırsat', `
      <form id="opp-form">
        <div class="form-grid">
          <div class="full"><label>Başlık *</label><input name="title" required></div>
          <div><label>Pipeline Aşaması</label><select name="pipeline_stage">${state.config.pipeline_stages.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
          <div><label>Tutar</label><input name="amount" type="number" step="0.01" value="0"></div>
          <div><label>Para Birimi</label><select name="currency">${state.config.currencies.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>
          <div><label>Sorumlu</label>${ownerSelect(state.user.id)}</div>
          <div><label>Kapanış Tarihi</label><input name="close_date" type="date"></div>
          <div><label>Firma ID</label><input name="firm_id"></div>
          <div><label>Kontak ID</label><input name="contact_id"></div>
          <div class="full"><label>Not</label><textarea name="notes"></textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="btn ghost" onclick="document.querySelector('#modal-close').click()">İptal</button><button type="submit" class="btn primary">Kaydet</button></div>
      </form>
    `);
    submitForm($('#opp-form'), data => api('/api/crm/opportunities', { method: 'POST', body: JSON.stringify(data) }));
  }

  async function enterApp() {
    try {
      const session = await api('/api/auth/session');
      state.user = session.user;
      const meta = await api('/api/crm/config');
      state.config = meta.config;
      state.users = meta.users;
    } catch (e) {
      // not logged in
    }
    if (!state.user) {
      $('#login-view').classList.remove('hidden');
      return;
    }
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    $('#current-user').innerHTML = `<strong>${esc(state.user.name)}</strong><span>${esc(state.user.role)}</span>`;
    applyUserVisibility();
    await navigate('dashboard');
    initSSE();
  }

  function initSSE() {
    const es = new EventSource('/api/events');
    es.addEventListener('crm_data_changed', () => {
      const def = views[state.currentView];
      if (def) def.render().catch(() => {});
    });
    es.onerror = () => { es.close(); setTimeout(initSSE, 3000); };
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  window.__toggleTask = async (id, checked) => {
    await api(`/api/crm/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status: checked ? 'done' : 'pending' }) });
  };

  init();
})();
