export function renderDesktopStockWarnings(inventory) {
  const tbody = document.getElementById('admin-stock-warnings-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const parLevels = {
    'inv_cin': 15,
    'inv_viski': 15,
    'inv_tonik': 30,
    'inv_kahve': 5,
    'inv_sut': 20,
    'inv_limon': 50
  };

  let count = 0;
  inventory.forEach(item => {
    const minLevel = item.par_level || 10;
    if (item.stock < minLevel) {
      count++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td><span class="text-danger bold">${item.stock} ${item.unit}</span></td>
        <td>${minLevel} ${item.unit}</td>
        <td><span class="room-badge dirty_vacant" style="font-size:9px; padding:2px 6px;">KRİTİK STOK</span></td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (count === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted small padding-md">Kritik stok seviyesinde hammadde bulunmamaktadır.</td></tr>`;
  }
}

export function renderStockWarnings(inventory) {
  const tbody = document.getElementById('admin-stock-warnings-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  let count = 0;
  inventory.forEach(item => {
    const minLevel = item.par_level || 10;
    if (item.stock < minLevel) {
      count++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.name}</strong></td>
        <td><span class="text-danger bold">${item.stock} ${item.unit}</span></td>
        <td>${minLevel} ${item.unit}</td>
        <td><span class="room-badge dirty_vacant" style="font-size:9px; padding:2px 6px;">KRİTİK STOK</span></td>
      `;
      tbody.appendChild(tr);
    }
  });

  if (count === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted small padding-md">Kritik stok seviyesinde hammadde bulunmamaktadır.</td></tr>`;
  }
}

export function renderVarianceReports(audits) {
  const tbody = document.getElementById('admin-variances-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (audits.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted small padding-md">Kör sayım denetim kaydı bulunmuyor.</td></tr>`;
    return;
  }

  audits.forEach(audit => {
    const tr = document.createElement('tr');
    const colorClass = audit.variance < 0 ? 'text-danger bold' : (audit.variance > 0 ? 'text-success bold' : 'text-muted');
    const sign = audit.variance > 0 ? '+' : '';
    
    tr.innerHTML = `
      <td><span class="text-xs text-muted">${new Date(audit.created_at).toLocaleDateString()}</span></td>
      <td><strong>${audit.inventory_name}</strong></td>
      <td>${audit.expected_amount} ${audit.unit}</td>
      <td>${audit.physical_amount} ${audit.unit}</td>
      <td><span class="${colorClass}">${sign}${audit.variance} ${audit.unit}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
