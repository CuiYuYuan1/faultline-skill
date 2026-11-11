# Sample checkout

This synthetic fixture illustrates required and optional dependencies. It contains no server, real inventory, customer data or network calls.

`checkout` delegates to `createOrder`. An inventory rejection propagates to checkout; `browse` also requires inventory. Recommendations have an explicit empty-list fallback. `payments` is injected: its concrete adapter is absent, so the effect of an external payment-provider outage is unresolved. The call site alone does not show whether the adapter retries, uses a fallback or rejects when its provider is unavailable.

Run the behavior checks from the repository root with `node --test tests/checkout.test.mjs`.
