import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductModule, listProductModules } from '../lib/product-modules.js';

test('commercial product modules stay separated', () => {
  const restaurantKitchen = getProductModule('restaurant-kitchen');
  const reception = getProductModule('reception');

  assert.deepEqual(restaurantKitchen.staffFacing, ['restaurant', 'kitchen']);
  assert.ok(restaurantKitchen.customerFacing.includes('guest-qr'));
  assert.ok(restaurantKitchen.excludedSurfaces.includes('reception'));
  assert.deepEqual(reception.staffFacing, ['reception']);
  assert.ok(reception.customerFacing.includes('precheckin'));
  assert.ok(reception.excludedSurfaces.includes('restaurant'));
  assert.notEqual(restaurantKitchen.entryPath, reception.entryPath);
});

test('product module catalog exposes only sellable copies', () => {
  assert.deepEqual(listProductModules().map(module => module.id), ['restaurant-kitchen', 'reception']);
});
