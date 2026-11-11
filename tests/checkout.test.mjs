import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, browseCatalog } from '../examples/checkout/app.mjs';

function dependencies() {
  return {
    inventory: { reserve: async () => ({ id: 'order-1', total: 20 }), list: async () => ['book'] },
    payments: { authorize: async () => ({ id: 'payment-1' }) },
    recommendations: { forCart: async () => ['bookmark'] },
  };
}

test('an order survives recommendation failure with an explicit fallback', async () => {
  const deps = dependencies();
  deps.recommendations.forCart = async () => { throw new Error('recommendations offline'); };
  assert.deepEqual(await createOrder(deps, ['book']), {
    orderId: 'order-1', paymentId: 'payment-1', suggestions: [],
  });
});

test('inventory failure propagates to both user journeys', async () => {
  const deps = dependencies();
  deps.inventory.reserve = deps.inventory.list = async () => { throw new Error('inventory offline'); };
  await assert.rejects(createOrder(deps, ['book']), /inventory offline/);
  await assert.rejects(browseCatalog(deps), /inventory offline/);
});
