const ENABLE_STOCK_ALGORITHM = process.env.ENABLE_STOCK_ALGORITHM !== 'false';

/**
 * Checks all catalog items that have recipes and auto-toggles in_stock
 * based on whether all required ingredients have sufficient stock (>0).
 * Called after every stock mutation (order deduction, stock add, movement, audit).
 */
export async function syncMenuAvailability(db) {
  if (!ENABLE_STOCK_ALGORITHM) return;
  try {
    const recipes = await db.all('SELECT * FROM recipes');
    const inventory = await db.all('SELECT id, stock, module_type FROM inventory');
    const catalogItems = await db.all('SELECT id, in_stock, category FROM catalog_items');

    const invMap = Object.fromEntries(inventory.map(i => [i.id, i]));
    // Group recipes by catalog_item_id
    const recipeMap = {};
    for (const r of recipes) {
      if (!recipeMap[r.catalog_item_id]) recipeMap[r.catalog_item_id] = [];
      recipeMap[r.catalog_item_id].push(r);
    }

    for (const item of catalogItems) {
      const itemRecipes = recipeMap[item.id];
      if (!itemRecipes || itemRecipes.length === 0) continue; // No recipe = manual control

      let canProduce = true;
      for (const r of itemRecipes) {
        const inv = invMap[r.inventory_id];
        if (!inv || Number(inv.stock || 0) < r.amount_needed) {
          canProduce = false;
          break;
        }
      }

      const shouldBeInStock = canProduce ? 1 : 0;
      if (Number(item.in_stock) !== shouldBeInStock) {
        await db.run('UPDATE catalog_items SET in_stock = ? WHERE id = ?', [shouldBeInStock, item.id]);
      }
    }
  } catch (e) {
    console.error('[syncMenuAvailability] Error:', e.message);
  }
}

export function initMenu({ app }) {
  // Catalog & Availability
  app.get('/api/catalog', async (req, res) => {
    try {
      const catalog = await req.db.all("SELECT c.*, COALESCE(p.station_id, '') AS kitchen_station_id, COALESCE(p.course, 'main') AS course, COALESCE(p.allergens, '') AS allergens FROM catalog_items c LEFT JOIN menu_kitchen_profiles p ON p.catalog_item_id = c.id WHERE c.in_stock <> 0 AND (p.active IS NULL OR p.active = 1)");
      res.json(catalog);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/catalog/availability', async (req, res) => {
    try {
      const catalogItems = await req.db.all("SELECT * FROM catalog_items");
      const kitchenProfiles = await req.db.all("SELECT catalog_item_id, active FROM menu_kitchen_profiles");
      const inactiveProfileIds = new Set(kitchenProfiles.filter(p => Number(p.active) === 0).map(p => p.catalog_item_id));
      const recipes = ENABLE_STOCK_ALGORITHM ? await req.db.all("SELECT * FROM recipes") : [];
      const inventory = ENABLE_STOCK_ALGORITHM ? await req.db.all("SELECT * FROM inventory") : [];

      // Fetch active campaigns
      let activeCampaigns = [];
      try {
        activeCampaigns = await req.db.all("SELECT * FROM campaigns WHERE active = 1");
      } catch (e) {
        // Table might not exist in old test databases, fallback
      }
      const campaignMap = {};
      activeCampaigns.forEach(c => {
        campaignMap[c.catalog_item_id] = c;
      });

      const inventoryMap = {};
      inventory.forEach(inv => {
        inventoryMap[inv.id] = inv;
      });

      const availability = catalogItems.map(item => {
        const itemRecipes = recipes.filter(r => r.catalog_item_id === item.id);

        let maxServings = Infinity;
        const ingredientStatus = [];

        for (const r of itemRecipes) {
          const inv = inventoryMap[r.inventory_id];
          if (!inv) {
            maxServings = 0;
            ingredientStatus.push({ name: 'Unknown Ingredient', stock: 0, required: r.amount_needed });
            continue;
          }

          // Apply 6% spillage/evaporation factor if it's a bar item (module_type = 'bar')
          const multiplier = inv.module_type === 'bar' ? 1.06 : 1.0;
          const effectiveAmount = r.amount_needed * multiplier;

          const maxServingsForIngredient = Math.floor(inv.stock / effectiveAmount);
          if (maxServingsForIngredient < maxServings) {
            maxServings = maxServingsForIngredient;
          }
          ingredientStatus.push({
            name: inv.name,
            stock: inv.stock,
            required: r.amount_needed,
            effectiveRequired: effectiveAmount,
            unit: inv.unit
          });
        }

        const soldOut86 = Number(item.in_stock) === 0 || inactiveProfileIds.has(item.id);
        if (soldOut86) maxServings = 0;

        const campaign = campaignMap[item.id];
        const originalPrice = item.price;
        let price = originalPrice;
        let campaignTitle = '';
        let discountRate = 0;

        if (campaign) {
          discountRate = campaign.discount_rate;
          price = Math.round(originalPrice * (1 - discountRate) * 100) / 100;
          campaignTitle = campaign.title;
        }

        return {
          ...item,
          price,
          originalPrice,
          discountRate,
          campaignTitle,
          maxServings: soldOut86 ? 0 : (ENABLE_STOCK_ALGORITHM && itemRecipes.length > 0 ? (maxServings === Infinity ? 0 : maxServings) : Infinity),
          bom_ingredients: ENABLE_STOCK_ALGORITHM ? ingredientStatus : [],
          ingredients: typeof item.ingredients === 'string' ? item.ingredients : ''
        };
      });

      res.json(availability.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        in_stock: Number(item.in_stock),
        originalPrice: item.originalPrice,
        category: item.category,
        module_type: item.module_type,
        image_url: item.image_url || '',
        discountRate: item.discountRate,
        campaignTitle: item.campaignTitle,
        maxServings: item.maxServings <= 0 ? 0 : 99,
        ingredients: typeof item.ingredients === 'string' ? item.ingredients : '',
        calories: Number(item.calories || 0),
        protein: Number(item.protein || 0),
        carbs: Number(item.carbs || 0),
        fat: Number(item.fat || 0),
        bom_ingredients: req.actor ? item.bom_ingredients : undefined
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/catalog', async (req, res) => {
    const { name, price, category, module_type, ingredients, calories, protein, carbs, fat } = req.body;
    try {
      const id = 'c_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO catalog_items (id, name, price, category, module_type, ingredients, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          name,
          parseFloat(price) || 0,
          category || 'drink',
          module_type || 'dining',
          ingredients || '',
          parseFloat(calories) || 0,
          parseFloat(protein) || 0,
          parseFloat(carbs) || 0,
          parseFloat(fat) || 0
        ]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/catalog/:id', async (req, res) => {
    const itemId = req.params.id;
    const { name, price, ingredients, calories, protein, carbs, fat } = req.body;
    const fields = [];
    const values = [];

    if (typeof name === 'string' && name.trim()) {
      fields.push('name = ?');
      values.push(name.trim());
    }

    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Geçerli bir fiyat girin' });
      }
      fields.push('price = ?');
      values.push(parsedPrice);
    }

    if (ingredients !== undefined) {
      fields.push('ingredients = ?');
      values.push(String(ingredients));
    }

    if (calories !== undefined) {
      fields.push('calories = ?');
      values.push(Number(calories) || 0);
    }

    if (protein !== undefined) {
      fields.push('protein = ?');
      values.push(Number(protein) || 0);
    }

    if (carbs !== undefined) {
      fields.push('carbs = ?');
      values.push(Number(carbs) || 0);
    }

    if (fat !== undefined) {
      fields.push('fat = ?');
      values.push(Number(fat) || 0);
    }

    if (!fields.length) {
      return res.status(400).json({ error: 'Güncellenecek alan yok' });
    }

    try {
      values.push(itemId);
      await req.db.run(`UPDATE catalog_items SET ${fields.join(', ')} WHERE id = ?`, values);
      const item = await req.db.get("SELECT * FROM catalog_items WHERE id = ?", [itemId]);
      if (!item) {
        return res.status(404).json({ error: 'Ürün bulunamadı' });
      }
      res.json({ success: true, item });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/catalog/:id', async (req, res) => {
    const itemId = req.params.id;
    try {
      await req.db.run("DELETE FROM catalog_items WHERE id = ?", [itemId]);
      await req.db.run("DELETE FROM recipes WHERE catalog_item_id = ?", [itemId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/recipes', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Recipe management is disabled for this deployment.' });
    try {
      const recipes = await req.db.all(`
        SELECT r.*, i.name as inventory_name, i.unit 
        FROM recipes r
        JOIN inventory i ON r.inventory_id = i.id
      `);
      res.json(recipes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/recipes', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Recipe management is disabled for this deployment.' });
    const { catalog_item_id, inventory_id, amount_needed } = req.body;
    try {
      const id = 'rec_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO recipes (id, catalog_item_id, inventory_id, amount_needed) VALUES (?, ?, ?, ?)",
        [id, catalog_item_id, inventory_id, parseFloat(amount_needed) || 0]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/recipes/:catalogItemId/:inventoryId', async (req, res) => {
    if (!ENABLE_STOCK_ALGORITHM) return res.status(410).json({ error: 'Recipe management is disabled for this deployment.' });
    const { catalogItemId, inventoryId } = req.params;
    try {
      await req.db.run(
        "DELETE FROM recipes WHERE catalog_item_id = ? AND inventory_id = ?",
        [catalogItemId, inventoryId]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/campaigns', async (req, res) => {
    try {
      const campaigns = await req.db.all(`
        SELECT c.*, ci.name as catalog_item_name 
        FROM campaigns c
        JOIN catalog_items ci ON c.catalog_item_id = ci.id
        ORDER BY c.created_at DESC
      `);
      res.json(campaigns);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/campaigns', async (req, res) => {
    const { title, discount_rate, catalog_item_id } = req.body;
    try {
      const id = 'camp_' + Math.random().toString(36).substr(2, 9);
      await req.db.run(
        "INSERT INTO campaigns (id, title, discount_rate, catalog_item_id, active) VALUES (?, ?, ?, ?, 0)",
        [id, title, parseFloat(discount_rate) || 0, catalog_item_id]
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/campaigns/:id/toggle', async (req, res) => {
    const id = req.params.id;
    const { active } = req.body;
    try {
      await req.db.run("UPDATE campaigns SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/campaigns/:id', async (req, res) => {
    const id = req.params.id;
    try {
      await req.db.run("DELETE FROM campaigns WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
