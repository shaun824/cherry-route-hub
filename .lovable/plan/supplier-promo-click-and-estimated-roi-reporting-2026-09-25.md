# Supplier promo click and estimated ROI reporting

## Goal
Track how riders interact with every supplier offer, show an admin-only performance report, allow CSV download, and let the admin assistant answer questions about promo results.

## What will be tracked
- Record one promo impression per visitor session when an offer is shown.
- Record offer opens, deliberate code copies, and outbound clicks to the supplier website.
- Keep the promo, supplier, current app screen, visitor session, signed-in state, device and timestamp with each signal through the existing app analytics system.
- Treat these as engagement signals only. Do not label clicks or copies as confirmed supplier redemptions or sales.

## Estimated ROI
- Add an optional **Estimated value per supplier-site click** amount to each promo in Admin → Supplier promos.
- Calculate estimated return as outbound clicks × the configured click value.
- Show impressions, unique visitors, offer opens, code copies, outbound clicks, click-through rate and estimated return for each supplier.
- Clearly label the result as an estimate, not confirmed revenue.

## Admin report
- Add a **Promo performance** section to Admin → Analytics with the existing Today / 7 / 30 / 90 day filters.
- Include totals and a supplier-by-supplier table.
- Add a CSV download containing the selected date range and all promo metrics.
- Keep the report aggregated; it will not expose individual rider identities.

## Assistant access
- Add the latest aggregated promo performance to the admin assistant’s private context.
- Admins can ask questions such as “Which supplier promo got the most clicks this month?” or “What is the estimated promo return?”
- Riders and public users will not receive supplier performance data.

## Technical details
- Add a nullable/defaulted estimated click-value field to promos and an admin-only database summary function over existing analytics events.
- Instrument the shared promo card and reminder so all current promo placements report consistently without changing their rider-facing behaviour.
- Add indexes for promo event/date aggregation, update generated database types, and verify anonymous and signed-in tracking plus admin-only reporting.
