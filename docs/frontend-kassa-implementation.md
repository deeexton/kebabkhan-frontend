## Kassa (Cashier) Role — Frontend Implementation Guide

This guide defines the Kassa (cashier) role UI and flow inside the admin dashboard. It aligns with the backend roles and endpoints and focuses on a fast, minimal in-person ordering flow: pick items, then choose payment. No customer details.

References:
- Backend guide: `backend/docs/frontend-kassa-implementation.md`
- Roles: `SUPERADMIN`, `KASSA`, `KITCHEN`

### Role & Access
- The JWT for admin contains `role` as one of: `SUPERADMIN`, `KASSA`, `KITCHEN`.
- In the frontend, `admin/me` now returns `{ id, email, role }` typed as `AdminUser`.
- Kassa users can access a simplified dashboard with tabs:
  - Beställningar (Orders queue)
  - Meny (Order-taking page inside dashboard)
  - Väntetider (read-only for Kassa)

### API Overview (Frontend bindings in src/api.ts)
- Menu: `Api.listMenu()`
- Create Kassa order: `Api.kassaCreateOrder(payload)`
  - Payload:
    ```json
    {
      "type": "TAKEAWAY" | "DINE_IN",
      "items": [
        { "menuItemId": "...", "quantity": 1, "selectedOptions": [ { "groupId": "...", "optionId": "...", "quantity": 1 } ] }
      ],
      "note": "optional",
      "paymentMethod": "CASH" | "CARD"
    }
    ```
  - Response (CASH): `{ orderId, status, orderNumber, paymentMethod: "CASH", clientSecret: null, estimatedWaitMinutes }`
  - Response (CARD): `{ orderId, status, paymentMethod: "CARD", clientSecret, estimatedWaitMinutes }`
- Active orders: `Api.adminListActiveOrders()`
- Mark paid: `Api.adminMarkPaid(orderId, paid)` (fallback if webhook didn’t mark paid)
- Wait times: `Api.adminGetWaitTimes()`

### UI Structure (Dashboard)
Add a new Kassa dashboard mode gated by role:
- Show Kassa tabs if `me.role === 'KASSA'` or `SUPERADMIN`.
- Tabs:
  1) Beställningar: realtime/polled active orders list
  2) Meny: order-taking page (customer-like but embedded)
  3) Väntetider: display-only current estimates

### Meny (Order-taking) — Clean Flow
Goal: Select food quickly, then go directly to payment selection. No customer info.

1) Layout
- Left: scrollable categories and items (reuse `MenuGrid` item cards and option groups, respect min/max availability).
- Right: compact cart with line items: name, options summary, qty +/-; subtotal/total, prominent “Nästa” button.
- Optional single-line note field above totals.

2) Item selection
- Default qty = 1; quick +/- controls.
- Show selected options summary per line.
- Respect option group min/max and availability.

3) Skip customer details
- Do not collect name, phone, email, address, or table on Kassa flow.
- Keep only optional `note` on the cart.

4) Next → Payment
- On “Nästa”, open a payment modal or advance to a payment screen with two buttons:
  - “Kontant” (Cash)
  - “Kort” (Card)
- On selection, immediately call `Api.kassaCreateOrder({ type, items, note, paymentMethod })`.
- For `paymentMethod === 'CASH'`:
  - Show order number returned; clear cart.
  - Optionally show `estimatedWaitMinutes`.
- For `paymentMethod === 'CARD'`:
  - Use Stripe Elements with `clientSecret` to complete payment.
  - On success, optionally call `Api.adminMarkPaid(orderId, true)` if not auto-marked by webhook.
  - Show order number when available (via websocket or refresh `/admin/orders/active`).

5) Errors
- If any item becomes unavailable or option selection invalid, surface a clear error and keep cart intact.
- Highlight offending option group for min/max violations.

### Data Transform (Cart → Kassa payload)
From the embedded cart structure, map to Kassa items:
- `menuItemId = line.item.id`
- `quantity = line.qty`
- `selectedOptions = line.selectedOptions?.map(({ groupId, optionId, quantity }) => ({ groupId, optionId, quantity }))`
- `type` chosen at top (toggle: `DINE_IN` or `TAKEAWAY`), default to `TAKEAWAY` for speed.
- `note` from the cart note field (optional).

### Role-Gated Tabs & Permissions
- Only show Kassa tabs to `role === 'KASSA'` (and `SUPERADMIN`).
- Hide admin-only features (menu management, stats, settings) for `KASSA` users.
- Väntetider tab is read-only for Kassa.

### Minimal Implementation Steps
1) Update admin user typing and role checks
- `src/api.ts`: use `AdminUser` with `role: 'SUPERADMIN' | 'KASSA' | 'KITCHEN'`.
- After login, `Api.adminMe()` determines which dashboard mode to show.

2) Add Kassa tabs in admin dashboard
- If role is `KASSA`, render tabs: Beställningar | Meny | Väntetider.
- Reuse existing `AdminDashboard` orders list for Beställningar with `Api.adminListActiveOrders()`.

3) Implement embedded Meny order-taking
- Reuse `MenuGrid` for listing items and options.
- Implement a compact cart pane with `Nästa` button.
- On `Nästa`, show payment choice, then call `Api.kassaCreateOrder` with mapped payload.

4) Card payments
- Integrate Stripe using returned `clientSecret`.
- On success, clear cart and show confirmation; refresh Beställningar.

5) Väntetider
- Read-only panel using `Api.adminGetWaitTimes()`; display dine-in and takeaway minutes.

### UI Copy (Swedish)
- Primary actions: “Lägg till”, “Nästa”, “Kontant”, “Kort”.
- Keep the order page minimal and fast.

### Notes
- Kassa flow bypasses public online ordering gates and customer details.
- Delivery is disabled for Kassa; only `DINE_IN` and `TAKEAWAY`.
