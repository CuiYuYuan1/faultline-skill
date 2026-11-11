// An intentionally small fixture, not a production checkout implementation.
export async function createOrder({ inventory, recommendations, payments }, cart) {
  const reservation = await inventory.reserve(cart);
  const payment = await payments.authorize(reservation.total);
  let suggestions;
  try {
    suggestions = await recommendations.forCart(cart);
  } catch {
    // Recommendation failure must not prevent an otherwise valid order.
    suggestions = [];
  }
  return { orderId: reservation.id, paymentId: payment.id, suggestions };
}

export async function browseCatalog({ inventory }) {
  return inventory.list();
}

export async function checkout(dependencies, cart) {
  return createOrder(dependencies, cart);
}

export async function browse(dependencies) {
  return browseCatalog(dependencies);
}
