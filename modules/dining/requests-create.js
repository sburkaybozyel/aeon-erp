import { syncMenuAvailability } from './menu.js';

const ENABLE_STOCK_ALGORITHM = process.env.ENABLE_STOCK_ALGORITHM !== 'false';

export function initRequestCreate({ app, eventBus, broadcastSSE, normalizeTargetIdentifier, ensureRequestDepartments }) {
  app.post('/api/requests', async (req, res) => {
    const { type, details, payment_method } = req.body;
    let idempotencyId = '';
    try {
      const allowedTypes = new Set(['order', 'waiter_call', 'bill_call', 'room_service_call', 'towel_request', 'cleaning_request', 'linen_request', 'amenity_request', 'maintenance_request', 'water_request', 'transport_request', 'room_dnd_change']);
      if (!allowedTypes.has(type)) return res.status(400).json({ error: 'Desteklenmeyen talep tipi.' });
      const rawTarget = String(req.body.target_identifier || '').trim();
      const publicRoomOrder = !req.actor && type === 'order' && rawTarget.startsWith('Room-');
      const effectivePaymentMethod = publicRoomOrder ? 'room_charge' : payment_method || null;
      if (!req.actor) {
        const tableTypeAllowed = ['order', 'waiter_call', 'bill_call'].includes(type);
        const roomTypeAllowed = ['order', 'room_service_call', 'towel_request', 'cleaning_request', 'linen_request', 'amenity_request', 'maintenance_request', 'water_request', 'transport_request'].includes(type);
        const publicPaymentAllowed = !payment_method || ['cash', 'card', 'pay_at_counter', 'room_charge'].includes(payment_method);
        const publicTargetAllowed = rawTarget.startsWith('Table-') ? tableTypeAllowed : rawTarget.startsWith('Room-') && roomTypeAllowed;
        if (!publicTargetAllowed || !publicPaymentAllowed) {
          return res.status(403).json({ error: 'Bu talep için geçerli misafir veya personel oturumu gereklidir.' });
        }
      }
      const actorRole = String(req.actor?.role || '').toLocaleLowerCase('tr-TR');
      const actorDepartment = String(req.actor?.department || '').toLocaleLowerCase('tr-TR');
      const management = ['admin', 'manager', 'yönetici'].includes(actorRole);

      const actorName = req.actor?.name || 'Misafir QR';
      const idempotencyKey = String(req.get('idempotency-key') || '').trim();
      idempotencyId = idempotencyKey ? `request:${idempotencyKey}` : '';
      const requestFingerprint = JSON.stringify({ ...req.body, payment_method: effectivePaymentMethod });
      if (idempotencyId) {
        const prior = await req.db.get("SELECT request_hash, response_json FROM idempotency_records WHERE id = ?", [idempotencyId]);
        if (prior && prior.request_hash !== requestFingerprint) return res.status(409).json({ error: 'Aynı idempotency anahtarı farklı bir taleple kullanılmış.' });
        if (prior && prior.response_json) return res.status(200).json(JSON.parse(prior.response_json));
        if (prior && !prior.response_json) return res.status(409).json({ error: 'Bu talep hâlâ işleniyor, lütfen kısa süre sonra tekrar deneyin.' });
      }
      const target_identifier = await normalizeTargetIdentifier(req.db, req.body.target_identifier);
      if (!target_identifier) return res.status(400).json({ error: 'Hedef bilgisi zorunludur.' });
      let targetRoom = null;
      if (target_identifier.startsWith('Table-')) {
        const table = await req.db.get("SELECT id FROM tables WHERE table_number = ?", [target_identifier.slice(6)]);
        if (!table) return res.status(404).json({ error: 'Masa bulunamadı.' });
        if (effectivePaymentMethod === 'room_charge') return res.status(400).json({ error: 'Oda hesabına yazma yalnızca aktif konaklaması bulunan oda için kullanılabilir.' });
      } else if (target_identifier.startsWith('Room-')) {
        targetRoom = await req.db.get("SELECT id, status FROM rooms WHERE room_number = ?", [target_identifier.slice(5)]);
        if (!targetRoom) return res.status(404).json({ error: 'Oda bulunamadı.' });
        if (type === 'order' && effectivePaymentMethod === 'room_charge') {
          const activeStay = await req.db.get("SELECT s.id, s.folio_id FROM stays s JOIN folios f ON f.id = s.folio_id AND f.status = 'open' WHERE s.room_id = ? AND s.status = 'checked_in' ORDER BY s.checkin_at DESC LIMIT 1", [targetRoom.id]);
          if (targetRoom.status !== 'occupied' || !activeStay?.folio_id) {
            return res.status(409).json({ error: 'Oda siparişi için dolu oda, aktif konaklama ve açık folyo gereklidir.' });
          }
        }
      } else {
        return res.status(400).json({ error: 'Hedef masa (Table-) veya oda (Room-) biçiminde olmalıdır.' });
      }
      const requestId = 'req_' + Math.random().toString(36).substr(2, 9);
      let totalAmount = 0.0;
      let orderDetails = [];
      let catalogMap = {};
      let orderHasFood = false;
      let orderHasDrinks = false;
      
      if (type === 'order') {
        try {
          orderDetails = Array.isArray(details) ? details.map(item => ({ ...item })) : JSON.parse(details);
        } catch (error) {
          return res.status(400).json({ error: 'Sipariş detayları geçerli bir dizi olmalıdır.' });
        }
        if (!Array.isArray(orderDetails) || orderDetails.length === 0 || orderDetails.length > 50) {
          return res.status(400).json({ error: 'Sipariş 1 ile 50 kalem arasında olmalıdır.' });
        }
        for (const orderItem of orderDetails) {
          const quantity = Number(orderItem?.quantity);
          if (typeof orderItem?.itemId !== 'string' || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
            return res.status(400).json({ error: 'Her sipariş kalemi geçerli ürün kimliği ve 1-99 arası adet içermelidir.' });
          }
          orderItem.quantity = quantity;
          // Stable per-line reference so a cancelled kitchen/bar ticket can be matched back to the
          // exact detail line it came from, even when two lines share the same catalog item id
          // (e.g. same drink with different modifiers).
          orderItem.lineRef = 'line_' + Math.random().toString(36).slice(2, 11);
        }

        const catalogItems = await req.db.all("SELECT c.* FROM catalog_items c LEFT JOIN menu_kitchen_profiles p ON p.catalog_item_id = c.id WHERE c.in_stock <> 0 AND (p.active IS NULL OR p.active = 1)");
        const recipes = ENABLE_STOCK_ALGORITHM ? await req.db.all("SELECT * FROM recipes") : [];
        const inventory = ENABLE_STOCK_ALGORITHM ? await req.db.all("SELECT * FROM inventory") : [];

        catalogItems.forEach(ci => catalogMap[ci.id] = ci);

        const inventoryMap = {};
        inventory.forEach(inv => inventoryMap[inv.id] = inv);

        const stockUpdates = {};
        for (const orderItem of orderDetails) {
          const item = catalogMap[orderItem.itemId];
          if (!item) {
            return res.status(409).json({ error: `Ürün ${orderItem.itemId} bulunamadı veya satışa kapalı.` });
          }
          orderItem.price = item.price;
          orderItem.name = item.name;
          totalAmount += item.price * orderItem.quantity;

          if (item.category === 'food') orderHasFood = true;
          if (item.category === 'drink') orderHasDrinks = true;

          const itemRecipes = recipes.filter(r => r.catalog_item_id === item.id);
          for (const r of itemRecipes) {
            const inv = inventoryMap[r.inventory_id];
            if (inv) {
              const multiplier = inv.module_type === 'bar' ? 1.06 : 1.0;
              const deduction = r.amount_needed * multiplier * orderItem.quantity;
              
              if (!stockUpdates[r.inventory_id]) {
                stockUpdates[r.inventory_id] = 0;
              }
              stockUpdates[r.inventory_id] += deduction;
            }
          }
        }

        // Quick pre-check for a clear, fast error on the common case; the actual guarantee
        // against overselling comes from the conditional UPDATE below, not this snapshot read.
        for (const [invId, deduction] of Object.entries(stockUpdates)) {
          if (Number(inventoryMap[invId]?.stock || 0) < deduction) {
            return res.status(409).json({ error: `Stok kalemi ${invId} için yeterli stok yok.` });
          }
        }
        try {
          await req.db.transaction(async tx => {
            if (idempotencyId) {
              // Reserve only now that every validation check has passed, so a legitimate
              // 400/404/409 above never leaves a stuck 'processing' record blocking future
              // retries with this key.
              await tx.run("INSERT INTO idempotency_records (id, operation, request_hash, response_json) VALUES (?, ?, ?, NULL)", [idempotencyId, 'request.create', requestFingerprint], {
                undoSql: "DELETE FROM idempotency_records WHERE id = ? AND response_json IS NULL", undoParams: [idempotencyId]
              });
            }
            // Sufficiency check baked into the WHERE clause so it and the write are one atomic
            // statement — closing the read-check-write race where two concurrent orders both
            // pass the JS snapshot check above and both deduct. If any single item comes up
            // short, tx.run throws and everything already deducted in this loop (and the
            // idempotency reservation above) is automatically put back by the transaction helper.
            for (const [invId, deduction] of Object.entries(stockUpdates)) {
              await tx.run("UPDATE inventory SET stock = stock - ? WHERE id = ? AND stock >= ?", [deduction, invId, deduction], {
                requireChange: true,
                failureMessage: `Stok kalemi ${invId} için yeterli stok yok (eşzamanlı sipariş nedeniyle stok tükendi).`,
                undoSql: "UPDATE inventory SET stock = stock + ? WHERE id = ?", undoParams: [deduction, invId]
              });
            }
          });
        } catch (stockError) {
          return res.status(409).json({ error: stockError.message });
        }

        // Auto-toggle menu item availability after stock deduction
        await syncMenuAvailability(req.db);
      }

      let finalDepartment = 'Reception';
      if (type === 'towel_request' || type === 'cleaning_request' || type === 'linen_request' || type === 'amenity_request') {
        finalDepartment = 'Housekeeping';
      } else if (type === 'maintenance_request') {
        finalDepartment = 'Maintenance';
      } else if (type === 'room_service_call') {
        finalDepartment = 'Restaurant';
      } else if (type === 'transport_request') {
        finalDepartment = 'Reception';
      } else if (type === 'order' && target_identifier.startsWith('Room-')) {
        finalDepartment = orderHasFood ? 'Kitchen' : orderHasDrinks ? 'Bar' : 'Restaurant';
      } else if (type === 'order' && target_identifier.startsWith('Table-')) {
        finalDepartment = 'Restaurant';
      } else if (type === 'water_request') {
        finalDepartment = 'Housekeeping';
      } else if (target_identifier.startsWith('Table-')) {
        finalDepartment = 'Restaurant';
      }

      const workflowDepartments = new Set([finalDepartment]);
      if (type === 'order') {
        workflowDepartments.add('Restaurant');
        if (orderHasFood) workflowDepartments.add('Kitchen');
        if (orderHasDrinks) workflowDepartments.add('Bar');
      }
      const routedDepartments = Array.from(workflowDepartments);

      const initialStatus = type === 'order' && !orderHasFood && !orderHasDrinks ? 'ready' : 'pending';
      await ensureRequestDepartments(req.db);
      await req.db.transaction(async tx => {
        if (idempotencyId && type !== 'order') {
          // Non-order request types have no stock-deduction step, so their first mutation is the
          // requests insert below; reserve the key here (order-type reservation already happened
          // earlier, right before its stock deduction).
          await tx.run("INSERT INTO idempotency_records (id, operation, request_hash, response_json) VALUES (?, ?, ?, NULL)", [idempotencyId, 'request.create', requestFingerprint], {
            undoSql: "DELETE FROM idempotency_records WHERE id = ? AND response_json IS NULL", undoParams: [idempotencyId]
          });
        }
        await tx.run(
          "INSERT INTO requests (id, type, target_identifier, status, details, total_amount, payment_method, created_by, department, departments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            requestId,
            type,
            target_identifier,
            initialStatus,
            JSON.stringify(orderDetails.length > 0 ? orderDetails : details),
            totalAmount,
            effectivePaymentMethod,
            actorName,
            finalDepartment,
            JSON.stringify(routedDepartments)
          ],
          { undoSql: 'DELETE FROM requests WHERE id = ?', undoParams: [requestId] }
        );

        if (targetRoom && ['cleaning_request', 'towel_request', 'linen_request', 'amenity_request', 'water_request'].includes(type)) {
          const taskType = type === 'cleaning_request' ? 'cleaning_request' : type === 'amenity_request' ? 'amenity' : type === 'water_request' ? 'water' : 'linen';
          const taskDetails = String(details || '').trim() || ({ towel_request: 'Ekstra temiz havlu talebi', linen_request: 'Ekstra çarşaf veya yastık talebi', amenity_request: 'Banyo seti talebi', water_request: 'Odaya su talebi' }[type] || 'Misafir oda talebi');
          const taskId = `hkt_${requestId}`;
          await tx.run("INSERT INTO reception_tasks (id, task_type, department, room_id, priority, details, created_by) VALUES (?, ?, 'Housekeeping', ?, 'normal', ?, ?)", [taskId, taskType, targetRoom.id, taskDetails, actorName], {
            undoSql: 'DELETE FROM reception_tasks WHERE id = ?', undoParams: [taskId]
          });
        }

        if (targetRoom && type === 'maintenance_request') {
          const summary = String(details || '').trim() || 'Misafir QR teknik servis talebi';
          const workOrderId = `wo_${requestId}`;
          await tx.run("INSERT INTO technical_work_orders (id, request_id, room_id, category, priority, status, summary, assigned_to) VALUES (?, ?, ?, 'guest_request', 'normal', 'reported', ?, ?)", [workOrderId, requestId, targetRoom.id, summary, actorName], {
            undoSql: 'DELETE FROM technical_work_orders WHERE id = ?', undoParams: [workOrderId]
          });
        }

        if (type === 'order') {
          const stations = await tx.all('SELECT * FROM kitchen_stations WHERE active = 1 ORDER BY sort_order');
          const profiles = await tx.all('SELECT * FROM menu_kitchen_profiles');
          const profileMap = Object.fromEntries(profiles.map(profile => [profile.catalog_item_id, profile]));
          const stationByName = Object.fromEntries(stations.map(station => [String(station.name).toLocaleLowerCase('tr-TR'), station.id]));
          const defaultStation = stationByName['sıcak'] || stations[0]?.id;
          for (const item of orderDetails) {
            const catalogItem = catalogMap[item.itemId];
            if (!catalogItem) continue;
            if (catalogItem.category === 'drink') {
              const ticketId = 'btl_' + Math.random().toString(36).slice(2, 11);
              await tx.run("INSERT INTO bar_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, unit_price, status, line_ref) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)", [ticketId, requestId, item.itemId, catalogItem.name, item.quantity, Number(item.price ?? catalogItem.price), item.lineRef || null], {
                undoSql: 'DELETE FROM bar_ticket_lines WHERE id = ?', undoParams: [ticketId]
              });
            }
            if (catalogItem.category === 'food') {
              const profile = profileMap[item.itemId];
              const name = String(catalogItem.name || '').toLocaleLowerCase('tr-TR');
              const stationId = profile?.station_id || (/(meze|humus|cacık|salata|soğuk)/.test(name) ? stationByName['soğuk & meze'] : /(ızgara|çipura|levrek|ahtapot)/.test(name) ? stationByName['ızgara'] : /(tatlı|baklava|dondurma)/.test(name) ? stationByName['tatlı'] : defaultStation);
              if (!stationId) continue;
              if (!profile) await tx.run("INSERT OR IGNORE INTO menu_kitchen_profiles (catalog_item_id, station_id, course, allergens, prep_minutes, active) VALUES (?, ?, 'main', '', 15, 1)", [item.itemId, stationId]);
              const ticketId = 'ktl_' + Math.random().toString(36).slice(2, 11);
              await tx.run("INSERT INTO kitchen_ticket_lines (id, request_id, catalog_item_id, item_name, quantity, station_id, course, modifiers, allergen_notes, priority, line_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [ticketId, requestId, item.itemId, catalogItem.name, item.quantity, stationId, profile?.course || item.course || 'main', String(item.modifiers || ''), String(item.allergen_notes || ''), item.priority === 'urgent' ? 'urgent' : 'normal', item.lineRef || null], {
                undoSql: 'DELETE FROM kitchen_ticket_lines WHERE id = ?', undoParams: [ticketId]
              });
            }
          }
        }
      });

      if (type === 'order' && effectivePaymentMethod === 'room_charge' && target_identifier.startsWith('Room-')) {
        await eventBus.emit('room_charge_request', {
          tenantId: req.tenantId,
          targetIdentifier: target_identifier,
          amount: totalAmount,
          requestId,
          createdBy: actorName,
          department: finalDepartment,
          description: `${finalDepartment === 'Bar' ? 'Bar' : 'Restoran'} siparişi`
        });
      }

      if (type === 'order') {
        const printPayload = {
          target: target_identifier,
          created_by: actorName,
          lines: orderDetails.map(item => ({ name: item.name, quantity: item.quantity, modifiers: item.modifiers || '', allergen_notes: item.allergen_notes || '' }))
        };
        await Promise.all([
          eventBus.emit('print_job_enqueue', { tenantId: req.tenantId, station: 'kitchen', requestId, payload: { ...printPayload, title: 'SİPARİŞ FİŞİ' } }),
          eventBus.emit('print_job_enqueue', { tenantId: req.tenantId, station: 'reception', requestId, payload: { ...printPayload, title: 'SİPARİŞ FİŞİ' } })
        ]);
      }

      if (targetRoom && ['cleaning_request', 'towel_request', 'linen_request', 'amenity_request', 'water_request'].includes(type)) {
        const taskType = type === 'cleaning_request' ? 'cleaning_request' : type === 'amenity_request' ? 'amenity' : type === 'water_request' ? 'water' : 'linen';
        const taskDetails = String(details || '').trim() || ({ towel_request: 'Ekstra temiz havlu talebi', linen_request: 'Ekstra çarşaf veya yastık talebi', amenity_request: 'Banyo seti talebi', water_request: 'Odaya su talebi' }[type] || 'Misafir oda talebi');
        broadcastSSE && broadcastSSE(req.tenantId, 'hk_task_updated', { id: `hkt_${requestId}`, status: 'open', requestId, type, target_identifier, details: taskDetails });
      }

      if (targetRoom && type === 'maintenance_request') {
        broadcastSSE && broadcastSSE(req.tenantId, 'maintenance_updated', { id: `wo_${requestId}`, status: 'reported' });
      }

      if (type === 'order' && effectivePaymentMethod === 'apa_charge') {
        await eventBus.emit('apa_charge_request', {
          tenantId: req.tenantId,
          amount: totalAmount,
          description: `Sipariş: #${requestId} (${target_identifier})`
        });
      }

      if (target_identifier.startsWith('Table-')) {
        const tableNumber = target_identifier.replace('Table-', '').trim();
        let tableStatus = 'occupied';
        if (type === 'waiter_call') tableStatus = 'requested_service';
        else if (type === 'bill_call') tableStatus = 'requested_bill';
        
        await req.db.run("UPDATE tables SET status = ? WHERE table_number = ?", [tableStatus, tableNumber]);
      }

      const pushTitle = type === 'order' ? 'Yeni Sipariş' : 'Yeni Misafir Talebi';
      const pushBody = type === 'order'
        ? `${target_identifier} - ${orderDetails.map(item => `${item.quantity}x ${item.name}`).join(', ')}`
        : `${target_identifier} - ${typeof details === 'string' ? details : JSON.stringify(details)}`;
      await eventBus.emit('staff_push', {
        tenantId: req.tenantId,
        payload: {
          title: pushTitle,
          body: pushBody,
          url: `/login.html?tenant_id=${req.tenantId}&inbox=orders`,
          tag: requestId,
          requestId,
          type,
          target_identifier
        },
        targetRoles: [],
        targetDepartments: routedDepartments
      });

      const logId = 'log_' + Math.random().toString(36).substr(2, 9);
      const staffName = actorName;
      let actionText = '';
      let logDetails = '';
      if (type === 'order') {
        actionText = 'Sipariş Oluşturuldu';
        logDetails = `${target_identifier} için sipariş: ${orderDetails.map(item => `${item.quantity}x ${item.name}`).join(', ')} - Tutar: ${totalAmount} TL`;
      } else if (type === 'waiter_call') {
        actionText = 'Garson Çağrısı';
        logDetails = `${target_identifier} garson çağırdı.`;
      } else if (type === 'bill_call') {
        actionText = 'Hesap Çağrısı';
        logDetails = `${target_identifier} hesap istedi.`;
      } else {
        actionText = 'Talep Gönderildi';
        logDetails = `${target_identifier} - Tip: ${type}, Detay: ${typeof details === 'string' ? details : JSON.stringify(details)}`;
      }
      await req.db.run(
        "INSERT INTO audit_logs (id, staff_name, action, details) VALUES (?, ?, ?, ?)",
        [logId, staffName, actionText, logDetails]
      );

      broadcastSSE && broadcastSSE(req.tenantId, 'request_created', { requestId, type, target_identifier, status: initialStatus, departments: routedDepartments });
      const response = { success: true, requestId, totalAmount, payment_method: effectivePaymentMethod };
      if (idempotencyId) {
        await req.db.run("UPDATE idempotency_records SET response_json = ? WHERE id = ?", [JSON.stringify(response), idempotencyId]);
      }
      res.status(201).json(response);
    } catch (err) {
      if (idempotencyId) {
        // Release the reservation on failure so a retry after a genuine error (as opposed to a
        // concurrent in-flight retry, which is rejected above) can attempt fresh rather than
        // being permanently stuck behind a pending record with no response.
        await req.db.run("DELETE FROM idempotency_records WHERE id = ? AND response_json IS NULL", [idempotencyId]).catch(() => {});
      }
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
}
