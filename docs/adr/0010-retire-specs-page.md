# Retire the Spec & cURL Hub and redirect /specs permanently

- Status: Accepted
- Date: 2026-09-28
- Issue: [#37](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/37), [#28](https://github.com/AiHub-Ecosystem/AiHub-Frontend/issues/28)

The Customer Web had two public API docs surfaces: the **API reference** under `/product` and the Spec & cURL Hub at `/specs`. `/specs` documented Writing Scoring at `POST /ai/v1/ielts/essay-scoring`, authenticated with an `x-client-id` header the AIHUB gateway has never accepted. Its Micro-Exercise entry used a path that disagrees with the Exercise Generation API reference. It also advertised Legal, Fintech and Healthcare API products that are not in the catalog. We retired `/specs` entirely and moved nothing from it into the API reference. The API product catalog and its API references are now the only public API docs.

`/specs` answers with a permanent (308) redirect to `/product` rather than a 404. The page was once linked from the header as "Live", so bookmarks and external links may exist, and a 308 tells browsers and search engines to update to the canonical surface. Browsers cache a 308 indefinitely, so this is hard to undo: a visitor who has followed it once keeps going to `/product` even if `/specs` is later restored. Treat the `/specs` path as retired. Do not reuse it for a new page; give any future docs surface a new path.

## Considered Options

- **Remove only the header link.** Rejected: the page would stay public and keep documenting the wrong path and auth.
- **Fix the Writing Scoring entry in place.** Rejected: this keeps two docs surfaces that can drift apart again, and leaves four entries that are wrong or describe products AIHUB does not sell.
- **Temporary (307) redirect, or a 404.** Rejected: nothing is expected to come back at `/specs`. A 404 would break existing links, and a 307 would never let search engines drop the old URL.
