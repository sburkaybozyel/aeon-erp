import { state, logEvent, registerLoader } from './state.js';

export function setupCruiseModule() {
  const formExpense = document.getElementById('form-yacht-expense');
  const currencySelect = document.getElementById('expense-currency');
  const rateInput = document.getElementById('expense-rate');
  
  if (currencySelect) {
    currencySelect.addEventListener('change', () => {
      const val = currencySelect.value;
      if (val === 'EUR') rateInput.value = '1.0000';
      if (val === 'USD') rateInput.value = '0.9250';
      if (val === 'TRY') rateInput.value = '0.0280';
    });
  }
  
  if (formExpense) {
    formExpense.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        amount: parseFloat(document.getElementById('expense-amount').value),
        currency: currencySelect.value,
        exchangeRateToEur: parseFloat(rateInput.value),
        category: document.getElementById('expense-category').value,
        description: document.getElementById('expense-desc').value,
        receiptImagePath: document.getElementById('expense-receipt').value
      };
      
      try {
        const res = await fetch(`/api/apa/ledger?tenant_id=${state.currentTenant}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          logEvent('event', `Cruise APA Defteri: Harcama girildi: ${data.description} (${data.amount} ${data.currency})`);
          formExpense.reset();
          if (rateInput) rateInput.value = '1.0000';
          loadCruiseData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Bind global helper functions to window for viewing APA receipts
  window.viewReceipt = (path, desc, amount, currency) => {
    const modal = document.getElementById('receipt-modal');
    const simulatedReceiptContent = document.getElementById('simulated-receipt-content');
    const tenantSelect = document.getElementById('tenant-select');
    const tenantName = tenantSelect ? tenantSelect.options[tenantSelect.selectedIndex].text.toUpperCase() : 'OMNIFLOW ERP';
    
    if (modal && simulatedReceiptContent) {
      modal.style.display = 'flex';
      simulatedReceiptContent.innerHTML = `
        <div class="receipt-bill">
          <h4>${tenantName}</h4>
          <p>YAT HARCAMA MÜSTELEK FIŞI</p>
          <p>-------------------------</p>
          <p>Kategori: ${translateCategory(desc)}</p>
          <p>Açıklama: ${desc}</p>
          <p>Belge Kayıt: ${path}</p>
          <p>-------------------------</p>
          <h3 style="font-size:18px; margin: 10px 0;">TOPLAM: ${amount} ${currency}</h3>
          <p>Kaptan Teyitlidir. İşlem Tamam.</p>
        </div>
      `;
    }
  };

  const closeModal = document.getElementById('btn-close-modal');
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      const modal = document.getElementById('receipt-modal');
      if (modal) modal.style.display = 'none';
    });
  }
  
  registerLoader('loadCruiseData', loadCruiseData);
}

export async function loadCruiseData() {
  try {
    const summaryRes = await fetch(`/api/apa/summary?tenant_id=${state.currentTenant}`);
    const ledgerRes = await fetch(`/api/apa/ledger?tenant_id=${state.currentTenant}`);
    
    if (summaryRes.ok && ledgerRes.ok) {
      const summary = await summaryRes.json();
      const ledger = await ledgerRes.json();
      
      renderApaSummary(summary);
      renderApaLedger(ledger);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderApaSummary(summary) {
  const totalBudget = document.getElementById('apa-total-budget');
  const remainingBudget = document.getElementById('apa-remaining-budget');
  const spentAmount = document.getElementById('apa-spent-amount');
  const bar = document.getElementById('apa-progress-bar');

  if (totalBudget) totalBudget.textContent = `€${summary.budget.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  if (remainingBudget) remainingBudget.textContent = `€${summary.remainingBudget.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  if (spentAmount) spentAmount.textContent = `€${summary.totalSpentEur.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
  
  const spentPct = (summary.totalSpentEur / summary.budget) * 100;
  
  if (bar) {
    bar.style.width = `${Math.min(spentPct, 100)}%`;
    if (spentPct > 80) {
      bar.style.background = 'var(--color-danger)';
    } else {
      bar.style.background = 'linear-gradient(90deg, var(--color-primary), var(--color-accent))';
    }
  }
}

function renderApaLedger(ledger) {
  const container = document.getElementById('apa-ledger-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (ledger.length === 0) {
    container.innerHTML = `<div class="text-muted small text-center padding-md">Henüz harcama kaydı bulunmuyor.</div>`;
    return;
  }
  
  ledger.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'aeon-card';
    const calculatedEur = entry.amount * entry.exchange_rate_to_eur;
    
    card.innerHTML = `
      <div class="aeon-card-content">
        <div class="aeon-card-header">
          <h4 class="aeon-card-title">${entry.description}</h4>
          <span class="aeon-badge info">${translateCategory(entry.category)}</span>
        </div>
        <div class="aeon-card-body">
          <p class="aeon-card-text">Tutar: <strong>${entry.amount.toFixed(2)} ${entry.currency}</strong> (≈ €${calculatedEur.toFixed(2)})</p>
          <p class="aeon-card-subtitle">${new Date(entry.recorded_at).toLocaleString()}</p>
        </div>
        ${entry.receipt_image_path ? `
        <div class="aeon-card-footer">
          <button class="btn btn-secondary btn-xs" onclick="viewReceipt('${entry.receipt_image_path}', '${entry.description}', '${entry.amount}', '${entry.currency}')">
            <i class="fa-solid fa-receipt"></i> Fişi Gör
          </button>
        </div>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function translateCategory(cat) {
  const map = {
    fuel: 'Yakıt (Fuel)',
    marina_fees: 'Marina Ücreti',
    provisions_guest: 'Kumanya',
    alcohol: 'Bar & Alkol',
    clearance: 'Acente & Gümrük'
  };
  return map[cat] || cat;
}
