// Generic placeholder demo ingredient/recipe seed. Replace with the client's own data during onboarding.
export const AEON_INGREDIENT_SEED = [
  { id: 'inv_demo_tea_leaves', name: 'Black Tea', unit: 'g', stock: 5000, par_level: 1000, unit_cost: 0.02, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'beverage' },
  { id: 'inv_demo_coffee_beans', name: 'Coffee Beans', unit: 'g', stock: 5000, par_level: 1000, unit_cost: 0.05, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'beverage' },
  { id: 'inv_demo_milk', name: 'Milk', unit: 'ml', stock: 10000, par_level: 2000, unit_cost: 0.01, module_type: 'dining', purchase_unit: 'l', purchase_unit_amount: 1000, sub_category: 'dairy' },
  { id: 'inv_demo_orange', name: 'Orange', unit: 'g', stock: 8000, par_level: 1500, unit_cost: 0.015, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'produce' },
  { id: 'inv_demo_lettuce', name: 'Lettuce', unit: 'g', stock: 4000, par_level: 800, unit_cost: 0.01, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'produce' },
  { id: 'inv_demo_chicken_breast', name: 'Chicken Breast', unit: 'g', stock: 10000, par_level: 2000, unit_cost: 0.06, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'protein' },
  { id: 'inv_demo_seabass', name: 'Seabass Fillet', unit: 'g', stock: 6000, par_level: 1200, unit_cost: 0.09, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'protein' },
  { id: 'inv_demo_beef_patty', name: 'Beef Patty', unit: 'g', stock: 8000, par_level: 1500, unit_cost: 0.08, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'protein' },
  { id: 'inv_demo_mozzarella', name: 'Mozzarella', unit: 'g', stock: 5000, par_level: 1000, unit_cost: 0.05, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'dairy' },
  { id: 'inv_demo_cream_cheese', name: 'Cream Cheese', unit: 'g', stock: 4000, par_level: 800, unit_cost: 0.04, module_type: 'dining', purchase_unit: 'kg', purchase_unit_amount: 1000, sub_category: 'dairy' }
];

export const AEON_RECIPE_SEED = [
  { catalog_item_id: 'menu_demo_tea', inventory_id: 'inv_demo_tea_leaves', amount_needed: 5 },
  { catalog_item_id: 'menu_demo_filter_coffee', inventory_id: 'inv_demo_coffee_beans', amount_needed: 15 },
  { catalog_item_id: 'menu_demo_cappuccino', inventory_id: 'inv_demo_coffee_beans', amount_needed: 15 },
  { catalog_item_id: 'menu_demo_cappuccino', inventory_id: 'inv_demo_milk', amount_needed: 120 },
  { catalog_item_id: 'menu_demo_fresh_orange_juice', inventory_id: 'inv_demo_orange', amount_needed: 300 },
  { catalog_item_id: 'menu_demo_garden_salad', inventory_id: 'inv_demo_lettuce', amount_needed: 100 },
  { catalog_item_id: 'menu_demo_caesar_salad', inventory_id: 'inv_demo_lettuce', amount_needed: 120 },
  { catalog_item_id: 'menu_demo_grilled_chicken', inventory_id: 'inv_demo_chicken_breast', amount_needed: 220 },
  { catalog_item_id: 'menu_demo_grilled_seabass', inventory_id: 'inv_demo_seabass', amount_needed: 250 },
  { catalog_item_id: 'menu_demo_beef_burger', inventory_id: 'inv_demo_beef_patty', amount_needed: 180 },
  { catalog_item_id: 'menu_demo_margherita_pizza', inventory_id: 'inv_demo_mozzarella', amount_needed: 150 },
  { catalog_item_id: 'menu_demo_cheesecake', inventory_id: 'inv_demo_cream_cheese', amount_needed: 120 }
];
