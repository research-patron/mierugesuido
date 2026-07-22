# Design QA — Home and Municipality Search

Date: 2026-07-11

## Scope and constraints

- Priority screens: home (`/`) and municipality search (`/municipalities`).
- Shared shell changes were propagated without removing adjacent routes.
- The implementation remains component/CSS/data-driven SVG UI. No reference screenshot, page capture, bitmap overlay, or static image replacement is used as application UI.
- Database, Prisma schema, migrations, ETL, imported data, and GIS output were protected throughout the pass.

## Reference and implementation evidence

References, both 1491 × 1055:

- Home: `[local reference supplied in prior task]`
- Search: `[local reference supplied in prior task]`

Final implementation captures:

- `artifacts/design-qa/final-home-1491x1055.png`
- `artifacts/design-qa/final-home-hover-aichi-1491x1055.png`
- `artifacts/design-qa/final-search-1491x1055.png`
- `artifacts/design-qa/final-mobile-home-390x844.png`
- `artifacts/design-qa/final-mobile-home-map-390x844.png`
- `artifacts/design-qa/final-mobile-search-390x844.png`
- `artifacts/design-qa/final-mobile-search-filters-open-390x844.png`

Same-input comparison artifacts:

- `artifacts/design-qa/final-home-comparison.png`
- `artifacts/design-qa/final-home-focus-map-comparison.png`
- `artifacts/design-qa/final-search-comparison.png`
- `artifacts/design-qa/final-search-focus-table-comparison.png`

The home comparison uses the same visible state as the reference: an approximately 0.3-second delayed hover over Aichi with the real data popup open. Full-view and focused comparisons were inspected at original resolution.

## Iteration record

1. Rebuilt the shared product shell, dashboard KPI rail, map/selector composition, ranking snapshot, and guide cards against the updated reference.
2. Rebuilt municipality search around a five-column primary filter row, explicit apply action, fixed exclusion state, KPI rail, dense ten-row table, view toggle, sort, full pagination, and page-size control.
3. Corrected data presentation semantics: home now says `収録自治体数`, search explains `流域下水道を除く比較対象`, and flow-sewer businesses are excluded from comparison averages, representative map values, search, and rankings without changing stored data.
4. Tightened visual details after screenshot comparison: full region-tab labels, accessible status colors, readable support text, stable inset placement, thin map boundaries, labelled reset control, and collision-free mobile selector rows.
5. Completed accessibility subtraction: explicit filter submission, native details disclosures, skip link, column scopes, disabled pagination spans, semantic ranking links, fixed-condition text, 44px mobile map controls, and roving keyboard focus on the national map.
6. Re-captured desktop and phone evidence after the final source changes and regenerated the combined reference/implementation comparisons.

## Final visual judgment

### Home

- Header, four KPI cards, exclusion note, map, prefecture selector, ranking, guide cards, and footer align to the reference's first-screen dashboard density.
- All six region tabs render their full labels. Hokkaido is inset in the upper-left and Okinawa in the lower-right; prefecture boundaries remain thin, low-contrast, and stationary on hover.
- Aichi hover displays real values, diagnostic status, revision information, and a working detail link. No persistent default-prefecture card is used.
- Ranking outlier conditions are disclosed and long municipality names retain a full-value affordance.

### Municipality search

- Filter hierarchy, KPI rail, table/card toggle, ten-row table, status pills, row links, pagination, and page-size control match the reference's compact hierarchy.
- Real values are retained even when they differ from the mock reference. The exclusion population and count difference are explicitly explained.
- Business names can be expanded with native `details/summary`; the default table remains dense and readable.

### Responsive layouts

- At the 390px content width, home and search both measured `scrollWidth === clientWidth === 390`; no horizontal overflow was present.
- Mobile home preserves the six-item navigation, 2 × 2 KPI rail, map, all region tabs, selector list, and CTA without overlap.
- Mobile search starts with keyword/action/exclusion controls, collapsed advanced filters, four KPI tiles, view toggle, and first result card. The advanced panel opens by keyboard/touch.
- At 1024px, both home and search also measured no horizontal overflow.

## Interaction verification

- National map hover: Aichi popup appeared after 380ms and disappeared after leaving the map.
- Map zoom/reset: `1.00 → 1.18 → 1.00`.
- Map shape navigation: Aichi opened `/map/23`.
- Prefecture selector navigation: Hokkaido opened `/map/01`.
- National-map keyboard focus: one main-map stop; `ArrowRight` moved code `02 → 03`; Enter/Space activation remains implemented. Hokkaido and Okinawa add two inset stops.
- Keyword search: `札幌` submitted through the visible search action and returned one result.
- View toggle: table-to-card transition rendered a real card grid.
- Sort: `経費回収率が低い順` was selected and applied through the explicit action.
- Pagination: next-page navigation reached page 2 and displayed items 11–20.
- Result navigation: `玄海町` opened `/municipalities/413879`.
- Fresh final loads produced no new browser console errors or warnings; only older pre-fix smooth-scroll warnings remained in the shared browser history.

## Accessibility and independent review

- The smallest audited small-text contrast is 4.738:1, meeting WCAG AA.
- Focus indicators, semantic table headers, status context, disclosure controls, skip navigation, and disabled control states were independently re-audited.
- Final independent accessibility audit: PASS, no remaining P0/P1/P2.
- Final independent visual audit: PASS, no remaining P0/P1; minor non-blocking polish observations do not affect information access or the acceptance criteria.

## Regression and protected-file verification

- `pnpm lint`: passed, 0 errors.
- `pnpm test`: passed, 7/7 files and 35/35 tests.
- `pnpm build`: passed, 17 routes, no compile/type/build errors.
- Clean development server after build: `/` and `/municipalities` both return HTTP 200.
- Protected manifests before and after the work are identical:
  - DB/Prisma, 4 files: `16a062df41b9166fbe684d6051636c45b12739b30661df43af395e958d08e2e6`
  - Imported data, 117 files: `d3ebf2a07e5d512573ba90778c5db3374f78876b465fe54cbfca99d25267ecf5`
  - DB/ETL/GIS scripts, 8 files: `e478ab3c5b4456743a8e92c4eab6aaedbb5bed80737d80addd8f82b194eb5184`
  - GIS output, 1 file: `e362314f0a3cf82a73a80b5df8354c39597679f0d03205a788094fe486781fe2`

## Feature preservation

Header navigation, search, filters, table/card views, sorting, pagination, municipality links, map hover/click/keyboard interactions, zoom/reset, rankings, revision schedule, data sources, and adjacent detail routes remain functional. No core product function was removed.

## Map convergence pass — 2026-07-12

### Scope and evidence

- New flat-map reference: `[local reference supplied in prior task]`.
- Final home: `artifacts/design-qa/maps-2026-07-11/04-home-final-1491x1055.jpg`.
- Final national map: `artifacts/design-qa/maps-2026-07-11/06-national-map-final-fresh-1491x1055.jpg`.
- Final dense-prefecture case: `artifacts/design-qa/maps-2026-07-11/02-prefecture-hokkaido-final-1491x1055.jpg`.
- Final phone map: `artifacts/design-qa/maps-2026-07-11/05-prefecture-niigata-mobile-final-390x844.jpg`.
- The reference and final national map were opened together in one comparison input. Home and `/map` were also opened together from fresh, matching data states.
- The browser viewport was set to 1491 × 1055 and 390 × 844. The in-app capture surface trims its scrollbar/chrome, so some saved JPEGs report 1480 × 1047 or 379 × 820 while DOM `innerWidth`/`innerHeight` remained the requested sizes.

### Iteration record

1. Replaced the divergent `/map` atlas with the same `HomeNationalMap`, legend, selector, inset placement, and three controls used by home.
2. Rebuilt national prefecture rendering as a two-layer silhouette: a 4px ink under-stroke plus a 2.7px diagnosis-color cover. This preserves an approximately 0.65px external prefecture boundary while covering all municipality-ring seams.
3. Re-aligned home, national KPI, prefecture fills, hover values, and detail KPI to one latest comparable municipality representative population: 1,608 national records; Hokkaido 173 records at an average 68.0% on both national and detail views.
4. Rebuilt the prefecture explorer with adaptive labels, rate-consistent colors, working zoom/reset/drag pan, filter-to-map dimming, responsive link rows, mobile map/list switch, roving map focus, explicit thresholds, and one clear comparison table.
5. Corrected the N03 same-name collision for Hokkaido `01403 泊村` at render time: the western current municipality remains interactive and the distant historical polygon is neutral/non-interactive. The protected GIS file was not edited.
6. Changed CSV export from the old 100-row slice to the complete current result, including map name query, municipality kind, and sort order. Regression coverage verifies a 173-item export plus header.
7. Removed unused full-dataset ranking queries and the duplicate nationwide summary query from page loads while preserving returned fields and visible ranking behavior.

### Final visual judgment

- Reference principle: PASS. Each prefecture is one flat diagnostic surface with thin neutral external edges; Hokkaido and Okinawa occupy stable inset positions. No municipality grid or inner ring remains visible.
- Home versus national tab: PASS. KPI values, prefecture colors, scale, map placement, legend, selector, ranking rows, guide cards, and controls match. Only route context and active navigation differ.
- Prefecture desktop: PASS. Niigata remains readable at 30 regions; Hokkaido remains readable at 184 GIS features/173 comparable municipalities with an 11-label initial budget and no label wall.
- Prefecture phone: PASS. The body has no horizontal overflow; KPI tiles are 2 × 2; map/list mode is explicit; all four map buttons measure 44px; the 100% zoom value and all diagnostic thresholds remain visible; the legend does not horizontally overflow.
- Independent flat-map audit found no remaining P0/P1 for silhouette quality or home/national layout. Later independent data findings were reproduced and corrected before these final captures.

### Interaction and accessibility verification

- National hover: Hokkaido popup appears after the 280ms delay and reports `要注意`, `68.0%`, `175.5円/m³`, with a real detail link.
- National zoom/reset: `1.00 → 1.18 → 1.00`; one roving main-map tab stop remains.
- Prefecture zoom/pan: `100% → 175%`; drag changed viewBox X from `216.86` to `113.08`. At the left clamp it moved `0 → 29.99` immediately on reverse drag, proving no sticky edge.
- Prefecture labels: 20 labels on / 0 off in Niigata. Search for `新潟市` dimmed 29 regions and retained one full-opacity match.
- Map/list phone switch toggled `aria-pressed` correctly. The map has one roving tab stop, arrow navigation, rate/status accessible names, and a `role="group"` rather than an interactive `role="img"` container.
- Result announcements are limited to the result-count status; the full link list is not an `aria-live` region.
- `/map` and `/map/[prefectureCode]` each render one H1. Map controls and municipality-kind filters have explicit group roles.

### Regression, build, and protected-file verification

- `pnpm lint`: passed, 0 type errors.
- `pnpm test`: passed, 11/11 files and 51/51 tests.
- Pixel audit covers real desktop/mobile GIS plus a synthetic two-municipality seam and reports zero internal ink seams.
- `pnpm build`: passed, 17 routes, no compile/type/build errors.
- Final development preview: `http://127.0.0.1:3000`.
- Protected manifests match the pre-change baselines exactly:
  - DB/Prisma, 4 files: `5d9eeb14ba46beaf64c86e63c5b67e55e6237faa213b9123f884811741a72a9b`
  - Imported data, 117 files: `09a7f63cc4b2704bd9d7ec1b10059ac0eba20c25f1f225b7aa8ace7f887cc0f7`
  - DB/ETL/GIS scripts, 8 files: `0fa5b20081e71138f9461125d0e6628e79e6cbcbdd2eddf27e98be8f312d785d`
  - GIS output, 1 file: `f691cb60a1d20bb9eb197ea3e5224d23d8ab2c9b51fbe089cecaeeee07fffca8`

### Intentional subtraction

- Removed the `/map`-only oversized atlas, connector lines, colliding direct prefecture-label layer, and redundant fourth control. Reason: they caused the reported divergence and duplicated selector/hover affordances.
- Replaced the always-on municipality label wall and floating selected-municipality CTA with adaptive labels, a label toggle, tooltip links, and persistent result-row links. Reason: Hokkaido was unreadable and every region was a tab stop; all navigation destinations remain available.
- Excluded prefecture aggregate rows, flow-sewer-only rows, and records without a comparable annual value from map/KPI/CSV populations. Reason: they are not comparable municipality fee records; stored data remains unchanged.

final result: passed

## Business switching, R2–R6 correctness, and direct operating-coverage gate — 2026-07-17

This gate supersedes every earlier description that uses `営業費用100円あたりの営業収益`, an amber 50%–100% state, or a reverse-direction shortage/remainder measure. The final production UI presents `営業収益 ÷ 営業費用 × 100` directly, compares the raw value with 50%, shows values below 50% in red and values at or above 50% in green, and states that 50% is this site's display boundary rather than a national soundness standard.

- Law-non-applied businesses remain in the common official expense-recovery view with an accounting-basis caveat; P&L, balance-sheet, and operating-coverage views remain law-applied only.
- The direct percentage is not capped or transformed. A raw 49.96% remains critical and is rendered as 49.96%, avoiding a red `50.0%` contradiction.
- Business switching is a set of direct, color-differentiated decision links with `表示中`, `aria-current="page"`, exact business-key preservation, and explicit wording that it does not change a contract, operator, or service area.
- Maximum-density QA used Yurihonjo City's eight active non-flow businesses. Desktop links measured 71px high and wrapped without clipping; mobile links measured 68px high and the document did not horizontally overflow.
- R6 financial storytelling retains the requested `費用 + 利益 = 収益` and `資産 = 負債 + 純資産` grammar. Major categories are shown in the boxes and their component amounts/shares appear as `うち` annotations.
- Other-account subsidy and non-standard transfer remain distinct. Public/tokkan combined comparisons are labelled as site-specific rather than official similar-group classifications.
- Invalid negative inputs, ambiguous zero household fees, representative-value provenance, joint-operation consolidation, official revision-year mapping, and R2–R6 source-year validation were audited and guarded.

### Accepted evidence

- Full audit: `artifacts/design-qa/business-switch-correctness-2026-07-17/audit.md`.
- Desktop before/final comparison: `artifacts/design-qa/business-switch-correctness-2026-07-17/10-before-after-business-switch-desktop.jpg`.
- Mobile before/final comparison: `artifacts/design-qa/business-switch-correctness-2026-07-17/11-before-after-business-switch-mobile.png`.
- Final direct-percentage view: `artifacts/design-qa/business-switch-correctness-2026-07-17/16-final-operating-coverage-1491x1055.png`.
- Direct values and threshold detail: `artifacts/design-qa/business-switch-correctness-2026-07-17/05-after-operating-coverage-detail-1491x1055.png`.
- Financial boxes: `artifacts/design-qa/business-switch-correctness-2026-07-17/13-after-financial-story-1491x1055.png`.
- Eight-business desktop/mobile stress cases: `14-after-eight-businesses-1491x1055.png` and `15-after-eight-businesses-mobile-390x844.png` in the same audit directory.

### Final verification

- `pnpm lint`: passed, zero TypeScript errors.
- `pnpm test`: 23/23 files and 134/134 tests passed.
- `pnpm build`: passed, all 17 application routes compiled.
- Post-build browser smoke after the required dev-server restart: direct 39.6% value, 50% disclaimer, exact business state, 1491px width, and zero runtime-error state passed.
- Localhost diagnosis: the app is bound to `127.0.0.1`; the in-app browser needs no elevation. The approval observed in shell diagnostics belongs to Codex's restricted command-network boundary, not to the app or macOS localhost.

final result: passed

## Superseding green-threshold, joint-operation, and home-map gate — 2026-07-17

This gate supersedes the older sentence above that says Ueyama's 58.7% remains amber. The rendered operating-coverage percentage is not transformed: the visible value is `営業収益 ÷ 営業費用 × 100`. A one-decimal value below 50.0% is critical red with the text `半分未満`; a value at or above 50.0% is clear green.

### Data semantics and aggregation

- R6 Ueyama renders at 58.7% in green (`rgb(21, 118, 93)`); the current Yamagata median renders at 38.9% in red (`rgb(181, 47, 54)`). The table and mobile cards use the same boundary and preserve the red `半分未満` text cue.
- The mismatch note for an expense-recovery rate of 100% or more while operating coverage remains below 100% is retained as a neutral contextual badge; it no longer changes an otherwise-cleared 50%+ value to amber.
- `尾花沢市大石田町環境衛生事業組合` is related explicitly to both `062120` and `063410` for public sewer `17-1-000` and tokkan `17-4-000`. The source-backed relation stores operator, business key, served municipality, validity, consolidated scope, source URL, source label, and checked date.
- The prefecture comparison shows one `尾花沢市・大石田町` row with a `組合運営` badge, operator name, official-source link, and operator-finance link. Its values are the association-wide accounts, not municipality allocations.
- The joint row has comparison key `069663:17-1-000`, R6 household 20m³ fee 3,300 yen, expense-recovery rate 60.3%, operating coverage 35.8%, and non-standard transfer 1.8 hundred-million yen. It is counted once in averages and totals.
- The current public-plus-tokkan comparison is 31 comparable entities covering 32 / 35 Yamagata municipalities. Three other municipalities remain visible with the accurate label `市町村単独の公共下水道・特環決算なし`; the false `公共下水道・特環なし` label is absent.
- Administrative map statistics filter to names ending in city, ward, town, or village. Yamagata therefore remains 35 municipalities and the association operator is not silently counted as a 36th municipality.
- SQLite `PRAGMA quick_check` is `ok`; four consolidated membership rows are present. No association financial value was copied into a municipality-owned annual statement.
- Official provenance: the intermunicipal regulation names Obanazawa City and Oishida Town as constituents and joint sewer-operation members; the Yamagata R6 source list separates the members' agricultural drainage from the association's public/tokkan businesses; the association publishes the sewer-fee service itself.

### Final visual evidence

- Threshold before/final combined review: `artifacts/design-qa/joint-operation-green-2026-07-17/15-before-final-green-combined.png`.
- Final post-build comparison at 1491 × 1055: `artifacts/design-qa/joint-operation-green-2026-07-17/16-postbuild-comparison-1491x1055.png`.
- Final post-build joint row at 1491 × 1055: `artifacts/design-qa/joint-operation-green-2026-07-17/18-postbuild-joint-row-adjusted-1491x1055.png`.
- Final related-service callout: `artifacts/design-qa/joint-operation-green-2026-07-17/05-obanazawa-related-1491x1055.png` and `07-obanazawa-mobile-390x844.png`.
- Final home hover popup without a duplicated CTA: `artifacts/design-qa/joint-operation-green-2026-07-17/12-final-home-hover-no-cta-1480x900.png`.
- Source/final and before/final popup comparisons: `13-reference-final-home-combined.png` and `14-before-final-popup-combined.png` in the same directory.
- The accepted desktop and mobile screenshots have no horizontal overflow. The green/red status is immediately scannable without adding another chart or decorative surface; the joint-service detail is progressively disclosed in one compact row/callout.

### Interaction, localhost, and regression verification

- The home popup retains the real prefecture values but has zero links or buttons, `data-passive`, and `pointer-events: none`; the prefecture shape remains the only navigation affordance. Post-build click on Aichi navigated to `/map/23` and rendered `愛知県の下水道経費回収率マップ`.
- Both member detail pages show the related public and tokkan operator accounts with the explicit warning that the figures are association totals. Operator and official-source links resolve to their intended targets.
- The development server binds only to `127.0.0.1:3000`. A sandboxed shell cannot enter the host loopback network and returns `HTTP 000`; the same `curl -I` outside that sandbox returns HTTP 200 for both `localhost` and `127.0.0.1`, and the supported in-app browser loads the site directly. This isolates the former permission symptom to the execution boundary rather than the application.
- Running `next build` while `next dev` shared the same `.next` directory temporarily produced a stale module-manifest error. The development server was stopped, `.next` was regenerated cleanly, and the restarted browser route returned HTTP 200. A timestamped post-restart reload produced zero browser errors.
- `pnpm lint`: passed, 0 type errors.
- `pnpm test`: 20/20 files and 114/114 tests passed, including the 49.9 / 50.0 boundary, joint-operation deduplication, association exclusion from map aggregates, and national-map interaction guards.
- `pnpm build`: passed, 17 routes, no compile/type/build error.

### Intentional subtraction

- Removed amber as a third status for the operating-coverage value. Reason: the requested decision boundary is 50%; green and red now communicate it directly while the percentage remains unchanged.
- Removed the home hover popup's `詳細を見る` action. Reason: the popup follows the pointer and the prefecture shape already owns click and keyboard navigation; removing the duplicate action prevents an unreachable target without removing map navigation.
- Replaced two false municipality exclusions with one source-backed joint-operator comparison unit. Reason: one row reflects the real operator and prevents double counting; municipality-level allocated figures were not invented.
- No route, municipality, business selector, financial statement, data table, map shape, search, ranking, keyboard interaction, or source trace was removed.

final result: passed

## Operating coverage, non-standard transfer, and terminology gate — 2026-07-16

### Official accounting and ETL findings

- The R6 Ministry of Internal Affairs and Communications manual does not define profit-and-loss statement item `他会計補助金` as synonymous with `基準外繰入金`. The former may include transfers within the official transfer standard; the latter is the cross-account total of amounts above or outside that standard.
- The prefecture comparison therefore no longer substitutes the P&L `他会計補助金` for non-standard transfers. It displays `annualFinancial.nonStandardTransfer` from Table 40 only.
- The former Table 40 mapping was wrong for all five fiscal years. Correct legal-applied coordinates are row 02 / column 37 for R2–R4 and row 02 / column 57 for R5–R6. Both mappings are fiscal-year scoped in the importer and guarded by `tests/non-standard-transfer-etl.test.ts`.
- All 110 local official-source files were reimported, 276,548 mapped raw cells were regenerated, and all 17,990 annual records were recalculated.
- Ueyama public sewerage now traces to R2 53,770; R3 68,040; R4 43,442; R5 118,918; and R6 135,225 thousand yen. R2–R4 trace row 02 / column 37; R5–R6 trace row 02 / column 57.
- The R6 P&L `他会計補助金` remains its official account name, now displayed as `他会計補助金（営業外収益）` with a visible note that it includes standard transfers and does not equal the non-standard-transfer total.

### Data-story and UI changes

- Removed the reverse-direction `100%までの差` and `営業収益の不足割合` displays.
- Added the positive-direction `営業費用100円あたりの営業収益 = 営業収益 ÷ 営業費用 × 100` without capping values above 100.
- The summary now states how many municipalities have expense recovery at or above 100%, and how many of those still have operating revenue below operating expense.
- The current-versus-prefecture-median card places the current expense-recovery rate beside the operating-coverage result. Ueyama reads `経費回収率 99.8%` and `営業収益 58.7円 / 営業費用100円`; the different scopes are stated directly.
- The bar uses teal for operating revenue, a restrained amber remainder to the 100-yen operating-expense reference, and a fixed 100-yen marker. The remainder is not presented as another standalone percentage.
- The municipality table is reduced to five columns: municipality, household 20m³ fee, expense-recovery rate, operating revenue per 100 yen of operating expense, and official non-standard transfer. Rows meeting recovery >= 100% but operating coverage < 100 show a text badge, so color is not the only signal.

### Visual evidence and judgment

- Before: `artifacts/design-qa/operating-coverage-refinement-2026-07-16/01-before-1491x1055.png`.
- Combined same-viewport review: `artifacts/design-qa/operating-coverage-refinement-2026-07-16/04-before-after-combined.png`.
- Accepted desktop after build and server restart: `artifacts/design-qa/operating-coverage-refinement-2026-07-16/11-post-build-desktop-1491x1055.png`.
- Accepted mobile comparison: `artifacts/design-qa/operating-coverage-refinement-2026-07-16/16-accepted-mobile-comparison-390x844.png`.
- Accepted mobile municipality cards: `artifacts/design-qa/operating-coverage-refinement-2026-07-16/13-accepted-mobile-coverage-390x844.png`.
- Desktop: PASS. The key mismatch is readable in one scan, both direct-comparison cards retain the established grammar, and the five-column table fits without page-level horizontal overflow.
- Mobile: PASS. Cards stack at 390 × 844, the 100-yen reference remains legible, the 120-yen endpoint is intentionally suppressed at the narrow breakpoint to prevent overlap, and all four municipality metrics remain readable.
- Copy: PASS. `不足割合` is gone; the interface says what 100 yen represents, shows the two formulas, and keeps official terms distinct.
- Accessibility: PASS for the audited scope. Both figures have complete aria labels, table headers are semantic, excluded rows retain explicit reasons, and mismatch badges carry their meaning in text.

### Localhost and regression verification

- Localhost itself did not require elevated access. `curl -I` to the real detail URL returned HTTP 200, and the in-app browser loaded `127.0.0.1:3000` directly.
- The one elevated operation was stopping a stale Node process owned outside the command sandbox after a build had replaced `.next`; it was process-control permission, not localhost/network permission. The replacement server is now kept in the managed terminal session, so normal reloads and subsequent shutdown do not require that escalation.
- Real navigation between prefecture comparison and R6 finance was exercised. The finance route rendered the corrected official subsidy wording and the prefecture route rendered the corrected non-standard-transfer values.
- `pnpm lint`: passed, 0 type errors.
- `pnpm test`: passed, 19/19 files and 108/108 tests.
- `pnpm build`: passed, 17 routes, no compile/type/build errors.
- Post-build restart smoke: municipality, operating-coverage comparison, and non-standard-transfer table all rendered; no runtime error overlay remained.

### Intentional subtraction

- Removed the standalone `100%までの差` column and mobile field. Reason: it inverted the reading direction and duplicated the expense-recovery rate.
- Removed the `営業収益の不足割合` column and mobile field. Reason: a lower-is-better shortage percentage was difficult to compare with a higher-is-better recovery percentage.
- Removed the other-account-subsidy ratio graph and duplicate table column from the prefecture comparison. Reason: it was neither the user's key question nor a valid substitute for official non-standard transfers.
- No municipality route, comparison row, business selector, finance statement, source disclosure, search, map, ranking, or navigation function was removed.

final result: passed

## R6 prefecture peer comparison — 2026-07-15

### Scope and accounting boundary

- Added the third municipality-detail tab: `県内市町村`; the dynamic labels are `道内市町村`, `都内市区町村`, and `府内市町村` where appropriate.
- The financial comparison is fixed to R6, the selected sewer-business category, and law-applied accounting. Every municipality remains in official municipality-code order; rows without the same R6 law-applied business stay visible with a specific exclusion reason instead of becoming zeroes.
- `料金で賄えていない割合` is the citizen-facing primary measure and equals `max(0, 100 − 経費回収率)`.
- `営業収支の不足割合` is explicitly labeled as an independent measure: `max(営業費用 − 営業収益, 0) ÷ 営業費用`.
- `他会計補助金依存度` equals `他会計補助金 ÷ (営業収益 + 営業外収益)` and is explained as the amount in 100 yen of recurring revenue.
- `他会計補助金` and `基準外繰入` are displayed as separate columns and never as synonyms. The UI also explains that `基準外` is a classification against the annual Ministry of Internal Affairs and Communications transfer standard, not a finding of illegality or waste.
- Primary definitions are linked in the UI: MIC R6 sewer-management indicators and MIC R6 public-enterprise transfer standards.

### Real-data verification

- Yamagata / public sewer (`17-1-000`): 35 municipality rows in official code order, 26 comparable R6 law-applied rows, and 9 visible excluded rows.
- Kaminoyama: fee shortfall 0.2%, operating shortfall 41.3%, other-account subsidy 25.1 yen per 100 yen of recurring revenue, other-account subsidy 2.6 hundred-million yen, non-standard transfer 0 yen, and expense recovery 99.8%.
- Hokkaido / public sewer: 173 mobile municipality cards rendered; the tab label changed to `道内市町村`; `scrollWidth === clientWidth === 379` at the mobile viewport.
- Missing and denominator-zero rates remain `算定不可`; a missing comparable business is `比較対象外`, never zero.

### Screenshot comparison and visual iterations

- Existing-shell baseline: `artifacts/design-qa/peer-before-1491x1055.png`.
- Final desktop: `artifacts/design-qa/peer-final-full-top-1491x1055.png`.
- Same-input before/after comparison: `artifacts/design-qa/peer-before-after-combined.png`.
- Final desktop table: `artifacts/design-qa/peer-table-contained-settled-1491x1055.png`.
- Final mobile top: `artifacts/design-qa/peer-final-mobile-top-390x844.png`.
- Final mobile summary/graph: `artifacts/design-qa/peer-final-mobile-mid-390x844.png`.
- Final mobile cards: `artifacts/design-qa/peer-final-mobile-table-390x844.png`.
- The source/baseline and implementation were opened together in the combined visual. The final screen preserves the existing public-data hierarchy, typography, teal/navy palette, border language, and shell density while adding one focused task: local comparison.
- Desktop uses four compact summary cards, a current-versus-median subsidy bar, a five-band distribution graph, and a contained administrative-order table with a sticky internal header.
- Mobile changes the wide table into semantic cards and retains the graph; there is no horizontal overflow.
- One experimental page-level sticky table header was removed after screenshot review because it did not improve the whole-page reading flow. The final table uses a bounded internal scroller instead.

### Interaction and regression evidence

- The real tab links changed from prefecture comparison to `R6 財務を読む` and back while preserving the selected business.
- A municipality row link opened Yamagata City and preserved the prefecture-comparison tab and selected business category.
- Changing from public sewer to specific-environment public sewer preserved `view=prefecture` and rebuilt the comparison with the new business category.
- A fresh post-build in-app-browser tab showed the final screen with no browser warnings or errors.
- `pnpm lint`: passed, 0 type errors.
- `pnpm test`: passed, 18/18 files and 94/94 tests.
- `pnpm build`: passed, all routes compiled.

### Localhost diagnosis

- Localhost itself did not require a new browser or network permission. The supported in-app browser continued to open `http://localhost:3000` without an access prompt.
- The observed failure after the production build was a stale Next.js development process reading `.next` artifacts replaced by `pnpm build`, producing `__webpack_modules__[moduleId] is not a function`.
- Stopping a process created outside the current sandbox terminal required process-control escalation; that is sandbox process isolation, not localhost permission.
- Restarting the development server in the current terminal session and opening a fresh tab in the same in-app browser removed the failure. Future runs can avoid the escalation by stopping the owned dev session before `pnpm build`, or by starting verification on an unused localhost port instead of killing an older process.

### Intentional subtraction

- No ranking sort, filter panel, second subsidy chart, or decorative visualization was added. The official administrative order stays stable and the single subsidy graphic answers the main comparison question.
- No route, fee tab, financial-story tab, business selector, search, map, ranking, revision, or evidence function was removed.

final result: passed

## R6 fee-recovery and financial-story completion audit — 2026-07-15

### Scope completed in source and data

- Replaced the municipality-detail headline fee metric with the official `一般家庭用20m³／月使用料` from Table 33. The annual average `使用料単価（円/m³）` remains a separately labelled technical indicator and is never multiplied by 20 to imitate the tariff.
- Added the R6 reference scenario `現在20m³料金 × 100 ÷ 経費回収率`. It is explicitly a simple scenario, not an official tariff decision, and it never recommends a price cut when recovery is already at least 100%.
- Defined the fee-recovery boundary as `汚水処理費（公費負担分等を除く） = 維持管理費分 + 資本費分`. The UI explains why gross operating expense is not the fee-recovery denominator.
- R2–R6 contains 17,990 annual rows: 3,606 / 3,605 / 3,600 / 3,595 / 3,584. Household 20m³ tariff, maintenance component, capital component, and total wastewater-treatment cost have zero missing values and zero component reconciliation mismatches.
- The exact mapping ledger is now 33/1/13, 32/1/44, 32/2/8, and 32/2/16 for both accounting bases across all five source years. Stale 0/0 and superseded YAML coordinates were removed; zero or null YAML coordinates remaining: 0.
- Every annual row has a diagnosis and source trace. SQLite integrity is `ok`; foreign-key check returns no rows.
- R6 has 3,454 law-applied annuals and 245,234 statement items; every law-applied annual has statement rows. R6 law-non-applied annuals have no P&L/B/S rows and remain excluded from the accrual-statement diagrams.
- R6 P&L checks across all 3,454 statements have zero net-result, revenue-subtotal, and expense-subtotal mismatches. R6 balance sheets have zero accounting-equation, asset-subtotal, and liability-subtotal mismatches.

### Accounting-scope decision

- Law-non-applied businesses are not silently treated as enterprise-accounting P&L/B/S. Those statement diagrams are law-applied only.
- The official survey records sewer-fee revenue, wastewater-treatment cost, expense-recovery rate, average fee unit price, and household 20m³ tariff under common indicator definitions for both accounting bases. These fee indicators are therefore retained as clearly marked reference comparisons, while the accounting basis is visible in lists, trends, maps, and rankings.
- The coloured diagnosis labels are disclosed as this site's own reference classification. Map, hover, table, and data-source explanations now use the same two-input logic: expense-recovery rate plus average fee unit price.

### Add/subtract visual hierarchy

- P&L boxes show major categories first. Each nonzero source item is nested under its parent as `うち 項目名 / 原表の千円額 / 大項目内の構成比`; the same relationship is included in the accessible label.
- Major labels are 14px and nested detail text is 12.5px, with 11px qualifiers. On mobile, amount and parent-relative share stack in the right-hand cell to preserve readable line lengths.
- Net assets starts with three questions users can answer immediately: current net-assets thickness, year-on-year direction, and the largest driver. Only nonzero drivers appear in the main add/subtract equation; definitions, all four balances, and integrity evidence are progressively disclosed.
- Latest-year representative selection now sorts by survey year before risk score, so an older high-risk business cannot displace its R6 record in search or map views.

### Automated verification

- `pnpm lint`: passed.
- `pnpm test`: passed, 16 files and 87 tests.
- `pnpm build`: passed, 17 routes and no compile/type/build errors.
- Browserless national-map pixel audit: passed at desktop and mobile viewBoxes.

### Final visual evidence — unblocked and passed

- Localhost was re-tested only through the supported in-app browser path after the user explicitly asked to restore access. Browser selection, a fresh same-browser tab, and direct navigation to `http://localhost:3000` all succeeded without a permission prompt. This proves the earlier rejection was not a Next.js, CORS, macOS network, or localhost setting; it was stale intent state in the earlier browser-control session. The old claimed tab separately timed out while attaching its webview, while the fresh tab remained fully controllable.
- Final desktop captures at the requested 1491 × 1055 viewport: `artifacts/design-qa/r6-fees-desktop-1491x1055.png`, `r6-finance-desktop-1491x1055.png`, `r6-finance-pnl-desktop.png`, `r6-finance-pnl-balance-desktop.png`, `r6-finance-balance-lower-desktop.png`, and `r6-finance-net-assets-desktop.png`.
- Final mobile captures at the requested 390 × 844 viewport: `artifacts/design-qa/r6-fees-mobile-390x844-v2.png`, `r6-fees-mobile-story-390x844.png`, `r6-finance-mobile-top-390x844-final.png`, `r6-finance-mobile-pnl-top-390x844.png`, `r6-finance-mobile-balance-390x844-final.png`, and `r6-finance-mobile-net-assets-390x844-final.png`.
- Same-input comparisons inspected at original resolution: `artifacts/design-qa/municipality-reference-vs-r6-fees.png`, `municipality-reference-vs-r6-finance.png`, `before-vs-after-r6-fees.png`, and `before-vs-after-r6-finance.png`.
- Fee story: PASS. The official household 20m³ bill, the 100% recovery reference line, the shortage judgment, and `維持管理費分 ＋ 資本費分 ＝ 料金回収対象` form one left-to-right desktop equation and one top-to-bottom mobile equation. The caveat that gross operating expense is not the fee-recovery denominator is adjacent to the equation.
- P&L: PASS. Major categories dominate the box geometry; every nonzero source item, exact thousand-yen amount, and parent-relative share remains readable inside its major category. Expense plus profit equals revenue on desktop and stacks in the same reading order on mobile.
- Balance sheet and net assets: PASS. Asset versus liability-plus-net-assets totals align; all major categories remain legible. The net-assets section answers current thickness, year-on-year direction, and largest driver before the exact `前年度末 ＋ 増減 ＝ 令和6年度末` bridge.
- The final mobile audit found an 11px root overflow caused only by intrinsic table sizing on visually hidden semantic tables. The hidden class was moved to containing wrappers, preserving the accessible tables while reducing `scrollWidth` from 390 to the 379px content width. Fee and finance now both report `scrollWidth === clientWidth === 379` with no visible or keyboard-induced horizontal drift.
- Post-fix verification: `pnpm lint` passed; `pnpm test` passed 16 files and 87 tests; `pnpm build` passed all 17 routes.

final result: passed

## In-box statement detail and net-assets learning pass — 2026-07-14

### Scope and accepted evidence

- Before: `artifacts/design-qa/financial-story-inner-detail-2026-07-14/03-before-finance-1491x1055.png`.
- Accepted desktop P&L: `artifacts/design-qa/financial-story-inner-detail-2026-07-14/26-final-desktop-income-1491x1055.png`.
- Accepted desktop net assets: `artifacts/design-qa/financial-story-inner-detail-2026-07-14/27-final-desktop-net-assets-1491x1055.png`.
- Accepted mobile P&L: `artifacts/design-qa/financial-story-inner-detail-2026-07-14/22-final-mobile-income-390x844.png`.
- Accepted mobile B/S: `artifacts/design-qa/financial-story-inner-detail-2026-07-14/23-final-mobile-balance-390x844.png` and `24-final-mobile-balance-bottom-390x844.png`.
- Accepted mobile net assets: `artifacts/design-qa/financial-story-inner-detail-2026-07-14/25-final-mobile-net-assets-390x844.png`.
- The desktop before and final frames were opened together at their native 1491 × 1055 size. The final mobile frames were independently opened at 390 × 844 after the same implementation pass.

### Accounting and data findings

- Replaced the misleading `資産と調達元が対応しています` with `貸借の合計が一致しています` and the exact identity `資産合計 ＝ 負債 ＋ 純資産（差額0千円）`.
- The identity is explicitly described as a bookkeeping equality, not proof of repayment capacity or financial health. If the raw totals do not reconcile, the proportional B/S and equals sign now fail closed.
- R5 has 2,492 law-applied statement records and R6 has 3,454. The same law-applied business can be compared in 2,489 cases.
- For all 2,489 comparable businesses, `R5末純資産 + Δ資本金 + Δ資本剰余金 + Δ利益剰余金 + Δその他有価証券評価差額 = R6末純資産` reconciles at the original thousand-yen unit. Maximum delta difference, R5 stock difference, and R6 stock difference are all 0.
- The 965 R6 law-applied businesses without a comparable R5 law-applied statement comprise 963 whose prior-year matching business was law-non-applied and 2 without a prior-year matching key. Missing prior values remain missing and are never converted to 0.
- 上山市 `062073 / 17-1-000`: R5 net assets 1,643,336 thousand yen; R6 1,763,328; delta +119,992. The four drivers are capital +17,081, capital surplus 0, retained earnings +102,911, and valuation difference 0. R6 net profit is +119,994 and is deliberately explained as a different concept from the retained-earnings balance change.
- The net-assets integrity badge now requires three exact checks: prior-year four-part stock total, current-year four-part stock total, and the four-part year-on-year delta.

### Add/subtract design changes

1. Moved each nonzero source item directly inside its major P&L box. Each line now reads as `うち 項目名 / 原表の千円額 / 大項目内の構成比`.
2. Removed both external statement legends. The primary boxes now provide the broad category and the fine detail in one scan; the disclosure retains all 26 rows including 0-thousand-yen items and explanatory notes.
3. Gave the P&L its own content-aware common height for both accounting columns. The accepted desktop pair measures 556px per column and the mobile pair 1,038px; the calculation grows further if future source-item counts increase.
4. Separated the B/S height from the detailed P&L. The mobile B/S pair is 478px rather than the former 958px blank-heavy surface, so the whole funding relationship can be understood in roughly one viewport.
5. Added a pure add/subtract net-assets bridge with exact thousand-yen endpoints, four signed drivers, prior/current values, beginner meanings, the leading driver, mixed-sign offset explanation, and an annual-net-income caveat.
6. When two or more drivers tie for the largest absolute change, all tied drivers are named rather than choosing the first array item.
7. Removed the repeated middle delta from each driver card. The signed delta remains in the card headline while the lower row now focuses on before and after.

### Visual, responsive, and accessibility QA

- P&L desktop: PASS. Broad category labels, exact detail amounts, and parent-relative percentages are visible inside the boxes without the old legend detour.
- P&L mobile: PASS. Font sizes and contrast were raised after screenshot review. Orange expense and green profit surfaces use deep-navy text; their contrast is at least 5.74:1 and 4.74:1, respectively, and small text no longer reduces opacity.
- B/S mobile: PASS. Both sides measure 478px, show all major categories, and end at the same baseline without a large empty scroll region.
- Overflow: PASS. At 390 × 844, document width is 390px; all four frame pairs report `scrollHeight === clientHeight`, and detail/segment overflow counts are 0.
- Net assets: PASS. Exact endpoints `1,643,336千円` and `1,763,328千円` make the four-part equation directly checkable while the bridge retains the easier 16.4/17.6-oku overview.
- Accessibility: PASS for audited scope. The P&L and B/S plots are exposed as named groups and lists rather than `aria-hidden`; the tested P&L group exposes 20 list items. The keyboard-operable disclosure exposes one 26-row table, and its touch-readable notes include `使用者が支払う料金`.
- Independent final code audit: PASS, 0 remaining critical or medium findings.

### Regression and completion checks

- `pnpm lint`: passed.
- `pnpm test`: passed, 14/14 files and 78/78 tests.
- `pnpm build`: passed, 17 routes, no compile, type, or build errors.
- No route, source row, business selector, fee indicator, trend chart, search, map, ranking, or navigation function was removed.
- No DB, Prisma schema, migration, ETL, or imported-data file was changed in this follow-up.

### Intentional subtraction

- Removed the P&L and B/S legends because they duplicated the boxes and forced eye travel away from the visual comparison.
- Removed the duplicate delta cell from each net-assets driver card because the same signed value already appears in the card headline.
- Removed the green health-pass treatment from the B/S equality; the neutral accounting-identity band avoids overstating financial health.

final result: passed

## R2–R6 municipality detail and R6 financial story — 2026-07-13

### Scope and comparison evidence

- Detail reference: `[local reference supplied in prior task]` (1491 × 1055).
- Final fee view: `artifacts/design-qa/r2-r6-financial-story-2026-07-13/01-fees-1491x1055.png`.
- Final R6 financial overview: `artifacts/design-qa/r2-r6-financial-story-2026-07-13/02-finance-1491x1055.png`.
- Final R6 financial lower panels: `artifacts/design-qa/r2-r6-financial-story-2026-07-13/04-finance-lower-1491x1055.png`.
- Negative-net-assets case: `artifacts/design-qa/r2-r6-financial-story-2026-07-13/05-finance-deficit-1491x1055.png`.
- Law-non-applied exclusion: `artifacts/design-qa/r2-r6-financial-story-2026-07-13/06-nonlegal-exclusion-1491x1055.png`.
- Mixed accounting basis: `artifacts/design-qa/r2-r6-financial-story-2026-07-13/07-mixed-basis-1491x1055.png`.
- Mobile fee and financial evidence: `08-fees-mobile-390x844.png`, `09-finance-mobile-390x844.png`, and `10-finance-story-mobile-390x844.png` in the same directory.
- The reference and final fee view were opened together at the same 1491 × 1055 viewport. The first-screen hierarchy, six-card rail, alert strip, compact four-chart grid, borders, spacing, and reference palette were judged together; real data and the necessary business/view controls account for the intentional content differences.
- The browser capture surface reports a 379px content width for the requested 390px mobile viewport. Both fee and finance pages measured `scrollWidth === clientWidth === 379`, with no horizontal overflow.

### Accounting-scope decision

- Law-applied and law-non-applied businesses remain in the fee comparison only where the official survey supplies the same fee revenue, billable volume, treatment cost, and expense-recovery definitions. Law-non-applied values are marked as reference in labels and trend marks.
- The R6 P&L, balance-sheet, and net-assets boxes are limited to law-applied businesses because the same official financial statements do not exist for law-non-applied businesses. The UI explicitly says that incomparable statements are not drawn.
- Unscorable records show `算定不可` / `未判定`; a missing recovery rate can no longer produce a misleading green `改定リスク低` state.

### Iteration record

1. Replaced repeated business cards with one explicit business selector and preserved the current fee/finance view through the selection form.
2. Added a six-KPI rail and four compact R2–R6 trend panels, merging the same business key across accounting-basis changes and marking law-non-applied years with dashed/reference treatment.
3. Built three novice-first R6 financial boxes: annual income and expense, assets versus liabilities plus net assets, and prior-year-to-current net-assets change.
4. Corrected P&L composition to Table 20's mutually exclusive expense definitions instead of mixing Table 21's cost denominator into the income statement.
5. Added adaptive money units so small gaps remain visible, plus explicit neutral zero, negative adjustment, limited-data, and negative-net-assets states.
6. Reduced secondary explanation to compact disclosures for source trace, formulas, and disclaimer while keeping all evidence accessible.
7. Re-captured mixed-basis, negative-net-assets, law-non-applied, desktop, and mobile states after the semantic fixes.

### Final visual judgment

- Fee view: PASS. The reference's compact municipality dashboard is preserved while real multi-business selection and the new finance route remain obvious.
- Financial overview: PASS. Three numbered takeaways establish the story before the boxes. Revenue/expense, asset/funding, and net-assets change use one visual grammar and plain-language conclusions.
- Edge states: PASS. A loss of 297 thousand yen remains legible rather than rounding to zero; debt-excess is shown as a meaningful accounting state rather than a data error; law-non-applied statements are clearly excluded.
- Responsive layout: PASS. At 390px, KPI cards remain two columns, the box diagrams become single-column comparisons, labels remain readable, and no horizontal scrolling is introduced.
- Subtractive design: PASS. Secondary evidence is collapsed, repeated business blocks are removed, and each first-screen element has one job.

### Interaction and browser verification

- Business selector: `17-1-000 → 17-5-000`; `/municipalities/232386?...&view=finance` preserved the finance tab after submission.
- Keyword search: `長久手` returned the expected result and the result link opened `/municipalities/232386`.
- Sort and pagination: `expense-recovery-low` applied successfully; page 2 reported items 11–20.
- Header navigation opened `/data-sources`.
- National map zoom/reset controls worked; the Aichi selector opened `/map/23`.
- Mixed-basis page showed R2–R4 law-non-applied reference marks and R5–R6 law-applied marks without connecting incompatible periods.
- Fresh browser warning/error log after the interaction run: empty.

### Data and regression verification

- R2–R6 annual records: 17,990 total, with 3,606 / 3,605 / 3,600 / 3,595 / 3,584 by year.
- Statement items: 416,220 total; R5 has 2,492 law-applied annuals × 70 items and R6 has 3,454 × 70 items. Law-non-applied statement items: 0.
- Annuals missing a diagnosis or provenance: 0. Unexplained calculated-metric nulls: 0.
- P&L, balance-sheet, and cost-table reconciliation mismatches: 0. Foreign-key violations: 0. SQLite integrity: `ok`.
- `pnpm lint`: passed, 0 type errors.
- `pnpm test`: passed, 13/13 files and 67/67 tests.
- `pnpm build`: passed, 17 routes, no compile/type/build errors.

### Intentional subtraction

- Removed the repeated per-business summary cards from municipality detail and replaced them with a selector. Reason: the cards duplicated the same scan and pushed the year trend below the first screen. No business, route, or data was removed.
- The financial boxes deliberately omit law-non-applied businesses. This is not a loss of a comparable feature: those businesses do not have the same official P&L and balance-sheet definitions. Their fee indicators and R2–R6 history remain visible as reference where common definitions exist.
- No navigation, search, sort, pagination, map, ranking, revision, data-source, or municipality-detail function was removed.

final result: passed

## GIS boundary, municipality-label, and home region-focus refinement — 2026-07-12

### Scope and accepted evidence

- User references: `[local reference supplied in prior task]` and `[local reference supplied in prior task]`.
- Official boundary source: [国土交通省 国土数値情報 N03 行政区域 2023年版](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2023.html).
- Accepted home default: `artifacts/design-qa/region-focus-labels-2026-07-12/40-home-default-final.png` (1491 × 1055).
- Accepted Kanto focus: `artifacts/design-qa/region-focus-labels-2026-07-12/41-home-kanto-final-accepted.jpg` (1491 × 1055).
- Accepted Hokkaido/Tohoku focus: `artifacts/design-qa/region-focus-labels-2026-07-12/42-home-hokkaido-final.png` (1491 × 1055).
- Accepted Hokkaido municipality map: `artifacts/design-qa/region-focus-labels-2026-07-12/46-hokkaido-map-current-final.jpg` and hover state `45-hokkaido-map-hover.jpg` (1491 × 1055).
- Accepted mobile home focus: `artifacts/design-qa/region-focus-labels-2026-07-12/31-home-hokkaido-mobile.png`; the in-app capture surface is 379 × 820 for a requested 390 × 844 viewport.
- Same-input comparisons: `50-compare-region-tabs.png`, `51-compare-home-spacing.png`, and `52-compare-hokkaido-labels.png` in the same artifact directory.

### GIS finding

- The app does use the official N03 2023 administrative-area geometry. The source describes polygonal administrative areas based on GSI numerical map data and explicitly notes that some undetermined boundaries are provisional.
- The official geometry is naturally irregular, but the strongly angular on-screen character is primarily introduced by the app pipeline. `scripts/gis/build-n03-simplified.ts` applies Douglas–Peucker simplification to municipality rings with a default `0.003°` tolerance and emits straight SVG line segments.
- Direct raw-versus-app checks confirm the reduction: Sapporo retains 283 of 17,028 source points (1.662%), Wakkanai 116 of 10,643 (1.090%), Betsukai 141 of 18,653 (0.756%), Hakodate 84 of 20,294 (0.414%), Niigata 297 of 18,086 (1.642%), Nagaoka 216 of 14,818 (1.458%), Murakami 115 of 29,097 (0.395%), and Itoigawa 80 of 8,676 (0.922%).
- This pass deliberately did not regenerate or edit the protected GIS output. It reduces the visual emphasis of angularity with thinner, lower-contrast, round-joined boundaries and `geometricPrecision`. Invented curve interpolation was rejected because it would falsify boundaries and could create seams.

### Iteration record and final visual judgment

1. Baseline Hokkaido rendered 77–78 labels interleaved with municipality paths. Even where bounding boxes did not overlap, 41 labels were at risk of being painted over by later polygons, and some leader lines crossed neighboring text.
2. Municipality paths and labels were separated into dedicated layers. All labels now render after every polygon; active selection is highest priority and displaces a lower-priority label instead of being added on top of the layout.
3. Added collision rejection for label/label, leader/label in both directions, and leader/leader intersections. Dense-map budgets and present-day municipality priority reduced the initial Hokkaido scan to 59 clean labels.
4. Added zoom-aware progressive disclosure. Browser measurements at 100%, 135%, and 175% yielded 59, 79, and 89 visible Hokkaido labels respectively, with zero text bounding-box collisions at every level.
5. All six home region buttons were wired to the map. The default national composition remains unchanged; a selected region enlarges its real prefecture geometry and reveals collision-adjusted prefecture names. Selecting the active region again or pressing `全国を表示` restores the national state.
6. Kanto, Chubu, Kinki, Chugoku/Shikoku, Kyushu/Okinawa, and Hokkaido/Tohoku were checked individually. Their main focus labels measured 7, 9, 7, 9, 7, and 6 with zero collisions; Okinawa and Hokkaido use enlarged interactive inset frames.
7. Rejected the first combined Hokkaido/Tohoku treatment because Tohoku became secondary and too small. The accepted composition gives Hokkaido a large upper-left frame while preserving a large, fully labeled six-prefecture Tohoku map.
8. Added a deliberate 16px desktop / 12px mobile break between the KPI band and the map/selector row. The final source comparison confirms the separation without wasting first-screen space.
9. Desktop and mobile comparisons were reopened together with the user references. Final judgment: hierarchy, active state, spacing, map focus, label density, label legibility, and responsive fit pass with no remaining P0/P1/P2 visual issue.

### Interaction and accessibility verification

- Region tabs expose a controlled `aria-pressed` state, share `aria-controls="national-prefecture-map"`, and update the map's accessible name and live focus message.
- All six regions focus correctly. National reset clears region focus, manual zoom, hover, and active prefecture; default national mode shows no colliding prefecture-label layer.
- Mobile Kanto and Hokkaido/Tohoku focus have no horizontal overflow (`379 === 379`) and preserve all expected labels/insets.
- Hokkaido municipality controls passed `100% → 135% → 175% → 100%`, label visibility `59 → 0 → 59`, and progressive label counts `59 → 79 → 89`.
- Hovering Sapporo opens the real-data card (`95.3%`, `95.7円/m³`, status `やや不足`); clicking the region opens `/municipalities/011002` and browser-back returns to `/map/01`.
- Fresh post-edit loads of `/` and `/map/01` produced no new browser console errors or warnings.

### Regression, build, and protected-file verification

- `npm run lint`: passed, 0 type errors.
- `npm test`: passed, 11/11 files and 52/52 tests.
- `npm run build`: passed in a source-identical temporary build mirror while keeping the active local preview undisturbed; 17 routes compiled with no type/build error.
- Final development preview remains `http://127.0.0.1:3000`.
- Protected manifests match their pre-task baselines exactly:
  - DB/Prisma, 4 files: `5d9eeb14ba46beaf64c86e63c5b67e55e6237faa213b9123f884811741a72a9b`
  - Imported data, 117 files: `09a7f63cc4b2704bd9d7ec1b10059ac0eba20c25f1f225b7aa8ace7f887cc0f7`
  - DB/ETL/GIS scripts, 8 files: `0fa5b20081e71138f9461125d0e6628e79e6cbcbdd2eddf27e98be8f312d785d`
  - GIS output, 1 file: `f691cb60a1d20bb9eb197ea3e5224d23d8ab2c9b51fbe089cecaeeee07fffca8`

### Intentional subtraction

- No route, control, link destination, data row, export, map interaction, or application function was removed.
- The initial Hokkaido overview was reduced from 77–78 labels to 59, while zoom now reveals 79 and 89. Reason: removing low-priority simultaneous labels is what prevents collisions and creates a legible first scan; the municipalities and their interactions remain on the map.
- The five Northern Territories overview labels `色丹村`, `留夜別村`, `留別村`, `紗那村`, and `蘂取村` are suppressed at the overview-label layer. Reason: they are not part of the present comparable municipality set and their dense callouts obscured current Hokkaido labels. Their protected source geometry/data was not deleted or edited.

final result: passed

## Full-width municipality map refinement — 2026-07-12

### Scope and accepted evidence

- Source map reference: `[local reference supplied in prior task]`.
- Source broken-hover reference: `[local reference supplied in prior task]`.
- Source home-note reference: `[local reference supplied in prior task]`.
- Accepted desktop map: `artifacts/design-qa/municipality-map-refinement-2026-07-12/33-prefecture-final-1491x1055.png`.
- Accepted desktop hover: `artifacts/design-qa/municipality-map-refinement-2026-07-12/34-prefecture-hover-final-inspection.png`; its source capture is the exact 1491 × 1055 frame `34-prefecture-hover-final-1491x1055.png`.
- Accepted desktop home: `artifacts/design-qa/municipality-map-refinement-2026-07-12/20-home-final-1491x1055.png`.
- Accepted mobile map: `artifacts/design-qa/municipality-map-refinement-2026-07-12/21b-prefecture-mobile-map-390x844.png`.
- Accepted mobile home: `artifacts/design-qa/municipality-map-refinement-2026-07-12/22-home-mobile-390x844.png`.
- Same-input comparisons: `40-compare-prefecture.png`, `41-compare-hover.png`, and `42-compare-home.png` in the same artifact directory.
- Desktop map and home source frames were captured at exactly 1491 × 1055. The in-app mobile capture surface saved 379 × 820 while its requested viewport remained 390 × 844.

### Iteration record

1. Rejected `10-prefecture-pass1-1491x1055.png`: the first full-width map used a 700px surface and cropped the lower map/note in the reference-height viewport.
2. Rejected `12-prefecture-pass2-1491x1055.png`: the frame was captured before the 30 GIS regions attached.
3. Accepted `13-prefecture-pass2-ready-1491x1055.png`: the reduced 640px surface showed the complete prefecture and label layout.
4. Fixed the hover corruption by limiting the map sizing rule to the direct SVG and locking the tooltip chevron to 14 × 14px. The tooltip now flips/clamps inside the map and stays stable while its CTA remains interactive.
5. Added measured, collision-aware label placement using the rendered map surface and current viewBox. Existing GIS callouts are reused, and labels retain screen-pixel sizing at desktop and mobile widths.
6. Removed the home exclusion note card and rebalanced the four remaining KPI cards into equal columns.
7. Regenerated the hover comparison from a clean resampled inspection frame after the first image-reader pass showed a non-app black-mask rendering artifact. The final comparison was independently re-opened and accepted with no P0/P1/P2 evidence issue.

### Final visual judgment

- Full-width map: PASS. The former right rail is gone, the map owns the entire content width, all geography remains aspect-correct, and 26 of 30 Niigata names fit at the initial desktop view without a label wall.
- Labels: PASS. White halos, adaptive 9.5–12px desktop sizing, callouts, and collision rejection keep dense coastal municipalities separated. Mobile retains major labels and restores more labels through zoom.
- Hover: PASS. The compact card contains municipality, status, three values, and one detail CTA. The oversized chevron/card defect is gone, and the card stays within the map.
- Home: PASS. Four equal KPI cards now provide a cleaner first scan; the removed exclusion note no longer competes with the map. The factual footer disclosure remains available.
- Responsive layout: PASS. The mobile map fills the available width, uses a two-column legend and 44px controls, has no obsolete map/list switch, and hands off cleanly to the comparison section.
- Independent visual re-audit: PASS, no remaining P0/P1/P2 issue in the app or final comparison evidence.

### Interaction verification

- Hovering a municipality opens the compact real-data card after the intended delay; the tested `村上市` CTA resolves to `/municipalities/152129`.
- Map zoom/reset changed `100% → 135% → 100%`.
- Municipality labels changed `26 visible → 0 → restored` through the label toggle.
- Clicking the first map region opened `/municipalities/151009`.
- All 30 municipality map regions retained accessible link names and one roving keyboard tab stop.
- The complete 30-row CSV link and the ten-row comparison table remain below the map.
- Fresh post-build loads of `/` and `/map/15` rendered real data; neither removed section was present.

### Regression and protected-file verification

- `npm run lint`: passed, 0 type errors.
- `npm test`: passed, 11/11 files and 51/51 tests. The three old source-lock assertions for the intentionally removed right rail were replaced with guardrails for the new full-width map, adaptive labels, and responsive controls.
- `npm run build`: passed, 17 routes, no compile/type/build errors.
- Protected manifests still match the pre-task baselines after the build:
  - DB/Prisma, 4 files: `5d9eeb14ba46beaf64c86e63c5b67e55e6237faa213b9123f884811741a72a9b`
  - Imported data, 117 files: `09a7f63cc4b2704bd9d7ec1b10059ac0eba20c25f1f225b7aa8ace7f887cc0f7`
  - DB/ETL/GIS scripts, 8 files: `0fa5b20081e71138f9461125d0e6628e79e6cbcbdd2eddf27e98be8f312d785d`
  - GIS output, 1 file: `f691cb60a1d20bb9eb197ea3e5224d23d8ab2c9b51fbe089cecaeeee07fffca8`

### Intentional subtraction

- Removed the prefecture page's right-side `自治体を探す` panel and its mobile `地図 / 一覧` switch. Reason: they duplicated the dedicated `/municipalities` search flow and consumed the width needed for a legible interactive municipality map. Header search navigation, municipality routes, map links, comparison table, and CSV export remain.
- Removed the home `流域下水道は使用料比較の対象外` KPI note card. Reason: it was secondary guidance in the primary KPI scan and the requested cleaner subtraction improves hierarchy. The factual disclosure remains in the footer/data explanation.

final result: passed

## Accounting-equation box refinement — 2026-07-13

### Scope and visual truth

- User-reported balance-sheet misalignment: `[local reference supplied in prior task]`.
- User-reported profit-and-loss orientation/height issue: `[local reference supplied in prior task]`.
- Before capture: `artifacts/design-qa/accounting-box-refinement-2026-07-13/02-before-boxes-1491x1055.png`.
- Final profit case: `artifacts/design-qa/accounting-box-refinement-2026-07-13/09-profit-final-1491x1055.png`.
- Final loss case: `artifacts/design-qa/accounting-box-refinement-2026-07-13/10-loss-final-1491x1055.png`.
- Final debt-excess case: `artifacts/design-qa/accounting-box-refinement-2026-07-13/11-deficit-final-1491x1055.png`.
- Final negative valuation adjustment case: `artifacts/design-qa/accounting-box-refinement-2026-07-13/12-valuation-difference-final-1491x1055.png`.
- Final mobile evidence: `artifacts/design-qa/accounting-box-refinement-2026-07-13/13-profit-final-mobile-390x844.png` and `14-profit-final-mobile-detail-390x844.png`.
- Desktop viewport: 1491 × 1055. Mobile viewport: 390 × 844; the in-app content surface measured 379px and `scrollWidth === clientWidth === 379`.
- Both user reference crops and the final profit/loss screenshots were opened together in one comparison input. The references are already focused card crops, and the corresponding final cards were readable at original resolution, so an additional resampled crop was not needed.

### Accounting and data audit

- R6 law-applied population: 3,454 annual statements.
- `total revenue − total expense = net profit − net loss`: 3,454/3,454 exact, maximum difference 0 thousand yen.
- `total revenue = operating revenue + non-operating revenue + extraordinary profit`: 3,454/3,454 exact.
- `total expense = operating expense + non-operating expense + extraordinary loss`: 3,454/3,454 exact.
- `assets = liabilities + net assets`: 3,454/3,454 exact, maximum difference 0 thousand yen.
- Asset and liability major-category subtotals also reconcile exactly for all 3,454 records.
- The importer was corrected to include Table 22 column 071, `other_securities_valuation_difference`. R5 and R6 now contain 5,946 rows for that item; two are nonzero: Dazaifu R5 −9,202 and R6 −46,901 thousand yen.
- Current statement store: 422,166 items. R5 has 2,492 × 71 items; R6 has 3,454 × 71 items. SQLite integrity is `ok`, foreign-key errors 0.
- Current DB SHA-256: `ce22af8478282407ba290c3a5f07056610097ff574fdef514b2cc7c042bd5194`.

### Comparison history and fixes

1. P1 — The old P&L placed revenue left and expense right, and scaled each column to its own total without adding profit/loss. Fix: use a conventional account-form explanation: profit is `expense + net profit = revenue`; loss is `expense = revenue + net loss`.
2. P1 — The old B/S centered each entire column, including unequal legend rows, so two- versus five-row legends shifted the plot vertically. Fix: put both plots in one shared, top-aligned fixed-height row and move annotations into a separate row.
3. P1 — A positive-valued statement could remain visualizable even when its accounting identity failed. Fix: the plot now fails closed unless the raw thousand-yen values reconcile exactly.
4. P2 — The old segments mixed fine items directly into the primary boxes. Fix: boxes now show major categories only; each major category's individual revenue/expense items, amount, share of the major category, and share of the statement total are listed immediately below.
5. P2 — The former 0.1% reconciliation tolerance could hide meaningful residuals. Fix: accounting identities and displayed remainders are exact at the source thousand-yen unit; the former hidden 134-thousand-yen remainder is now shown as `その他`.
6. P1 — Table 22 column 071 was not mapped. Fix: the source column is imported, shown in the signed data table, and a negative component collapses the main net-assets block to its safe total instead of drawing a misleading positive stack.
7. P1 — Negative net assets were previously shown as unequal asset-versus-liability bars. Fix: the safe debt-excess form is `assets + debt excess = liabilities`. The two records with negative total assets do not render a proportional box.

### Final visual and UX judgment

- Plot geometry: PASS. Browser measurement for both P&L and B/S returned identical left/right plot bounds: top 222.5625px, bottom 446.5625px, height 224px. Mobile plots also measure equal at 198px.
- Major/fine hierarchy: PASS. Operating/non-operating/extraordinary classes are visible in the box; detailed source items and percentages sit below without affecting box height.
- Typography: PASS. Existing Japanese system typography and weight hierarchy are retained; financial details were raised to readable 9–10px compact labels at desktop and stack into one-column annotation groups on mobile.
- Spacing and layout: PASS. Plot, equation caption, annotations, conclusion band, and audit disclosure have distinct vertical roles. Unequal annotation counts cannot shift the plots.
- Colors and tokens: PASS. Teal revenue, amber expense, green profit, red loss/debt excess, navy liabilities, and cyan net assets use the established semantic palette.
- Image and icon fidelity: PASS. No screenshot overlay, raster replacement, custom SVG, or placeholder asset is used. Existing Lucide accounting icons remain aligned with the product shell.
- Copy: PASS. Both statements explicitly say they are `勘定式で図解`; this avoids presenting the two-column explanatory chart as the statutory report format.
- Responsive behavior: PASS. At 390px, the accounting boxes remain a two-column equality while the detailed annotations stack below; no horizontal overflow occurs.
- Accessibility: PASS for audited scope. Figures have meaningful `figcaption` equations, raw values remain in semantic tables, details disclosures are keyboard-operable, and color is not the only carrier of profit/loss meaning.

### Interaction, regression, and browser verification

- Profit, loss, break-even, debt excess, negative valuation adjustment, negative total-assets stop state, and mobile were all rendered from real data.
- The `数値とデータ状態を見る` disclosure changed from closed to open through its real summary control.
- A fresh post-build tab produced no browser warnings or errors.
- `pnpm lint`: passed, 0 type errors.
- `pnpm test`: passed, 14/14 files and 72/72 tests.
- `pnpm build`: passed, 17 routes, no type/build errors.

### Intentional subtraction

- Removed variable-height total comparison bars from both statements. Reason: accounting-equation diagrams should balance rather than imply that unequal height is an accounting result.
- Removed fine-grained items from inside the primary boxes. Reason: the primary scan now communicates major structure; all source-level items remain directly below with amounts and percentages.
- Removed legend layout from the plot-alignment calculation. Reason: annotation count must not move the top or bottom of either accounting column.
- No route, statement row, disclosure, business selector, fee indicator, search, map, ranking, or navigation function was removed.

final result: passed

## Current final gate — 2026-07-15

The R2–R6 data, accounting-scope decision, R6 fee-recovery story, and R6 financial diagrams are complete. Localhost access was restored through a fresh tab in the same supported in-app browser, post-change desktop/mobile screenshots were captured, source/before comparisons were inspected, the only measured mobile overflow was corrected, and the final lint/test/build suite passed.

final result: passed

## Current final gate — 2026-07-15 (prefecture comparison)

The third municipality-detail tab is complete. R6 law-applied municipalities are compared only within the selected business category and official municipality-code order; excluded rows remain visible with reasons. Fee shortfall, operating shortfall, other-account subsidy, and non-standard transfer remain separate concepts. The combined desktop comparison and final desktop/mobile screenshots passed visual review, real tab/business/municipality navigation passed, Hokkaido's 173-row mobile case has no horizontal overflow, the fresh post-build browser tab has no warnings, and lint/test/build all pass.

final result: passed

## R2–R6 scope, public-plus-tokkan comparison, and final copy gate — 2026-07-15

### Accounting scope and data evidence

- The R6 Ministry of Internal Affairs and Communications survey manual treats both law-applied and law-non-applied businesses as survey subjects, but gives law-applied businesses the profit-and-loss statement, cost statement, and balance sheet while law-non-applied businesses use the revenue-and-expenditure statement.
- The law-non-applied sewer analysis table is prepared under the same wastewater-treatment-cost instructions as the law-applied table. Fee revenue, wastewater-treatment cost, unit cost, and expense recovery rate therefore remain available as an explicitly labelled reference comparison; accrual-accounting financial statements and the financial box diagrams remain law-applied only.
- R2–R6 annual rows are present with year, accounting type, and source trace: R2 3,606; R3 3,605; R4 3,600; R5 3,595; R6 3,584. Every row has fee revenue, wastewater-treatment cost, and household 20m³ fee values. R6 contains 3,454 law-applied and 130 law-non-applied annual rows.
- R6 law-applied statement data contain 245,234 items across 3,454 annual statements. SQLite integrity is `ok`; the foreign-key check returned no errors.
- Public sewer (`17-1-000`) and special-environment public sewer (`17-4-000`) now form one prefecture peer family. A municipality contributes at most one row: the displayed business is preferred, and the other family member is used only when the preferred business has no comparable R6 law-applied statement.
- Browser evidence for Yamagata is 30 / 35 comparable municipalities. Tokkan-only Funagata (`063631`) is present with a `特環` badge and links to `business=17-4-000`; the destination preserves the tokkan business selector and comparison state.

### Final visual evidence

- Before: `artifacts/design-qa/comparison-copy-refinement-2026-07-15/01-before-1491x1055.png`.
- Final post-build desktop: `artifacts/design-qa/comparison-copy-refinement-2026-07-15/14-post-build-desktop-1491x1055.png`.
- Final mobile: `artifacts/design-qa/comparison-copy-refinement-2026-07-15/07-final-mobile-390x844.png` and `08-final-mobile-comparison-390x844.png`.
- Final fee story: `artifacts/design-qa/comparison-copy-refinement-2026-07-15/09-final-fee-desktop-1491x1055.png`.
- Final profit-and-loss and balance-sheet boxes: `10-final-finance-pl-desktop-1491x1055.png` and `11-final-finance-bs-desktop-1491x1055.png`.
- Combined comparison input: `artifacts/design-qa/comparison-copy-refinement-2026-07-15/12-before-final-combined.png`.
- User-reference removal input: `artifacts/design-qa/comparison-copy-refinement-2026-07-15/13-reference-removal-combined.png`.
- Both combined inputs were opened at original resolution. The repeated amber notice is gone, the two direct comparisons are visually equivalent, and the first scan now moves from comparison conditions to three factual counts and then to the two metrics.

### Final UX and copy judgment

- Desktop: PASS. The comparison surface fits the 1491 × 1055 reference viewport without horizontal overflow. The two graphs use the same card, scale, typography, bar, and median treatment for household 20m³ monthly fee and other-account subsidy.
- Mobile: PASS. At 390 × 844 the content surface is 379px, `scrollWidth` stays 379px, the third summary card spans the row, both comparison graphs stack cleanly, and municipality cards remain readable.
- Financial storytelling: PASS. Primary boxes show the statutory major categories; each major category contains its component amounts and shares. Profit-and-loss reads as expense plus profit equals revenue, balance-sheet reads as assets equals liabilities plus net assets, and net-asset change is separated from cash movement.
- Copy: PASS. `20m³の負担`, `使用料で賄う範囲`, `必要改定率`, `料金の適正性`, `改定リスクスコア`, and the misleading `返済不要の土台` wording are absent from the audited production source and rendered detail tabs. Stored diagnostic keys remain internal only; rendered labels state the actual recovery-rate ranges.
- Accessibility: PASS for the audited scope. Metric figures have complete aria labels, range labels are not color-only, maps expose factual band labels, and selected tabs/business rows retain semantic navigation.

### Interaction, localhost, and regression verification

- The development server now binds only to `127.0.0.1:3000`; `lsof` confirms the loopback listener. Both `http://localhost:3000` and `http://127.0.0.1:3000` loaded the post-build implementation in the supported in-app browser without an elevated localhost permission.
- Public-to-tokkan row navigation, all three detail tabs, the business selector, and the comparison anchor were exercised against the real application. No application error or browser console error remained.
- `pnpm lint`: passed, 0 type errors.
- `pnpm test`: passed, 18/18 files and 103/103 tests.
- `pnpm build`: passed, 17 routes, no compile/type/build errors.

### Intentional subtraction

- Removed the repeated amber reading note from all three municipality-detail tabs. Reason: it duplicated conditions already stated at the point of use and interrupted the comparison hierarchy.
- Removed the prefecture distribution histogram and its histogram-only model/types. Reason: it mixed a population distribution with a direct municipality-versus-median question; the replacement uses one graph grammar for both requested metrics.
- Removed the independent revision-risk score card. Reason: it presented a modelled judgement beside official fee and recovery metrics as if they had equal status. The factual `100%相当額との差` remains.
- No route, business selector, municipality row, data table, statement disclosure, search, map, ranking, or navigation function was removed.

final result: passed

## Superseding final gate — 2026-07-16

This gate supersedes the older prefecture-comparison descriptions above. The standalone `100%までの差`, `営業収益の不足割合`, and other-account-subsidy comparison are no longer present. The final production view compares expense recovery with `営業費用100円あたりの営業収益`, uses the corrected Table 40 non-standard-transfer total, and keeps P&L `他会計補助金（営業外収益）` explicitly distinct.

- R2–R4 legal-applied non-standard transfer: Table 40 row 02 / column 37.
- R5–R6 legal-applied non-standard transfer: Table 40 row 02 / column 57.
- Full local-source reimport and recalculation: complete.
- Accepted desktop: `artifacts/design-qa/operating-coverage-refinement-2026-07-16/11-post-build-desktop-1491x1055.png`.
- Accepted mobile: `artifacts/design-qa/operating-coverage-refinement-2026-07-16/16-accepted-mobile-comparison-390x844.png` and `13-accepted-mobile-coverage-390x844.png`.
- `pnpm lint`: passed.
- `pnpm test`: 19/19 files, 108/108 tests passed.
- `pnpm build`: passed.
- Post-build localhost/browser smoke: HTTP 200, corrected data rendered, no runtime error overlay.

final result: passed

## Direct operating-coverage percentage and sub-50 alert gate — 2026-07-16

This gate supersedes every older description that expresses operating coverage as `営業費用100円あたりの営業収益`. The underlying value was already calculated as `営業収益 ÷ 営業費用 × 100`; the final UI now presents that unmodified percentage directly.

### Semantic and visual judgment

- The comparison title is `営業収益で、営業費用を何%賄えているか` and the table/mobile label is `営業収益で賄えている営業費用の割合`.
- Ueyama is shown as `58.7%`; the Yamagata median is shown as `41.7%`.
- Values whose one-decimal display is below `50.0%` use the existing high-contrast red `#b52f36` and the text label `半分未満`. Exactly `50.0%` is not critical. This keeps the visible rounding, color judgment, and plain-language status consistent.
- The former amber block from the value to 100 is removed. A neutral unfilled track remains, and `100%（全額）` is only a reference line.
- Expense recovery remains beside operating coverage with the explicit formulas `下水道使用料 ÷ 汚水処理費 × 100` and `営業収益 ÷ 営業費用 × 100`; no source amount or modelled ratio was changed.
- The desktop table shows Shinjo at `47.9%` in red with `半分未満`; Ueyama at `58.7%` remains amber rather than red. The same rule is present in mobile cards.
- Color is not the sole signal: `半分未満` appears in the graph/table/card and the figure aria label includes `50%未満`.

### Screenshot evidence

- Before: `artifacts/design-qa/operating-coverage-percent-2026-07-16/01-before-1491x1055.png`.
- First accepted desktop: `artifacts/design-qa/operating-coverage-percent-2026-07-16/02-after-1491x1055.png`.
- Accepted mobile layout: `artifacts/design-qa/operating-coverage-percent-2026-07-16/04-mobile-coverage-390x844.png`.
- Accepted mobile critical row: `artifacts/design-qa/operating-coverage-percent-2026-07-16/05-mobile-critical-card-390x844.png`.
- Combined same-state before/final inspection: `artifacts/design-qa/operating-coverage-percent-2026-07-16/13-before-final-same-state-combined.png`.
- Final post-build desktop: `artifacts/design-qa/operating-coverage-percent-2026-07-16/12-final-same-state-1491x1055.png`.
- At the 390 × 844 override, the rendered document width was 379px against a 390px viewport; no horizontal overflow was present.

### Regression verification

- Targeted prefecture comparison tests: 19/19 passed, including the 49.9% / 50.0% display boundary.
- `pnpm lint`: passed, 0 type errors.
- `pnpm test`: 19/19 files and 110/110 tests passed.
- `pnpm build`: passed, 17 routes, no compile/type/build error.
- Post-build browser smoke: direct percentage title and sub-50 state rendered, no Next.js runtime error overlay.
- No data, ETL, database, route, navigation, municipality row, or comparison function was removed. Only the indirect yen wording and the colored remainder-to-100 band were removed.

final result: passed

## Current final gate — 2026-07-17

The detailed `Superseding green-threshold, joint-operation, and home-map gate — 2026-07-17` above is the current specification. It supersedes every older amber treatment and every false `公共下水道・特環なし` description for Obanazawa City and Oishida Town. Final rendered evidence is `15-before-final-green-combined.png`, `16-postbuild-comparison-1491x1055.png`, `18-postbuild-joint-row-adjusted-1491x1055.png`, the member-detail desktop/mobile captures, and the home-popup source/before comparisons in `artifacts/design-qa/joint-operation-green-2026-07-17/`. The final suite is 20/20 test files and 114/114 tests, typecheck passes, production build passes, SQLite integrity is `ok`, post-restart browser errors are zero, the Aichi map shape still navigates, and the loopback-only preview is live at `http://127.0.0.1:3000`.

final result: passed

## Superseding current final gate — 2026-07-17

The `Business switching, R2–R6 correctness, and direct operating-coverage gate — 2026-07-17` above is the current specification and supersedes all older amber states and indirect `営業費用100円あたり` wording. The complete audit is `artifacts/design-qa/business-switch-correctness-2026-07-17/audit.md`; accepted final evidence includes the desktop/mobile combined comparisons, the direct-percentage view, the R6 financial boxes, and the eight-business stress case in that directory. Typecheck passed, 23/23 test files and 134/134 tests passed, the production build passed all 17 routes, and the post-build restarted preview rendered the 39.6% critical state without a runtime error.

final result: passed

## Superseding R6 financial relationship redesign gate — 2026-07-17

The repeated profit-and-loss equation strip and its balance-sheet equivalents were removed. The balance-sheet primary view now contains only the three beginner concepts `資産`, `負債`, and `純資産`; exact accounts are retained in a 44px disclosure and grouped into three source-value tables. Debt excess, zero assets, zero net assets, unreconciled data, missing data, tiny nonzero amounts, and tiny signed percentages have explicit regression coverage. Typecheck passed, 24/24 test files and 143/143 tests passed, and the production build passed all 17 routes. The detailed implementation audit is `artifacts/design-qa/financial-relationship-redesign-2026-07-17/audit.md`.

Fresh 1491 × 1055 and 390 × 844 screenshots, disclosure interaction evidence, and the combined reference/final comparison could not be captured because the in-app Browser has no open target tab and its prior browser-generated error context cannot be navigated by automation under the active URL safety policy. Existing screenshots are not accepted as current-run evidence. Open `http://127.0.0.1:3000/municipalities/062103?view=finance` manually in the in-app Browser to resume this gate.

final result: blocked

## Superseding accepted R6 balance-box gate — 2026-07-17

This gate supersedes the blocked result above. The in-app Browser was reopened on the live municipality finance view, and the implementation was reworked and verified as a true balance-sheet box diagram.

- The left asset frame and right funding frame are equal in width and height. The right frame is divided vertically into liabilities and net assets by the unmodified R6 amounts, so the visual areas preserve `資産＝負債＋純資産`.
- The primary view shows only the three large concepts `資産`, `負債`, and `純資産`. Exact accounts remain available in the 44px disclosure below, grouped into source-value tables.
- The plus sign is positioned at the actual liabilities/net-assets boundary. Tiny but nonzero regions keep their exact area and move their label to an adjacent callout instead of inflating the box.
- All three amounts use one automatically selected unit. The selected unit is accepted only when nonzero values remain visible and the rounded displayed equation still balances.
- Accepted post-build evidence is `30-accepted-final-postbuild-desktop-1491x1055.jpg`, `31-accepted-final-postbuild-desktop-card.jpg`, `32-accepted-final-postbuild-mobile-390x844.jpg`, `33-labeled-before-final-same-section.png`, and `34-labeled-reference-final-comparison.png` in `artifacts/design-qa/financial-relationship-redesign-2026-07-17/`.
- The disclosure was opened and closed in the rendered desktop page; mobile had no horizontal overflow; the final desktop and mobile pages rendered without a Next.js error dialog.
- `pnpm lint` passed, 24/24 test files and 146/146 tests passed, and the production build passed all 17 routes. Independent accounting, UI, and regression reviewers reported no remaining P0, P1, or P2 findings.
- No route, source account, data row, business switcher, table, map, ranking, search, or navigation function was removed.

final result: passed

## Superseding balance-sheet `うち` inner-breakdown gate — 2026-07-17

This gate supersedes the accepted R6 balance-box gate above where it said exact accounts were only in the disclosure. The proportional balance-sheet boxes now use the same visible hierarchy as the profit-and-loss boxes: each major box contains selected `うち` accounts, their amounts, and their share of that major box.

- The desktop `資産`, `負債`, and `純資産` boxes contain their selected source-account rows without clipping; the equal outer frames and the unmodified 77.5% / 22.5% funding split remain intact.
- At 390 × 844, equal outer frames are 540px high. Tendo's 22.5% net-assets region is 119px high and keeps `うち 資本金` and `うち 剰余金` inside the green box. The prior duplicate white mobile callout is no longer rendered for this state.
- Missing values, derived differences, negative child accounts, debt excess, tiny amounts, and screen-reader duplication are handled explicitly and have regression coverage.
- Accepted screenshots are `06-final-desktop-balance-card.png`, `07-final-mobile-balance-top-390x844.png`, `08-final-mobile-balance-details-390x844.png`, and `09-combined-profit-pattern-and-final-balance.png` in `artifacts/design-qa/balance-inside-breakdowns-2026-07-17/`.
- The detailed audit is `artifacts/design-qa/balance-inside-breakdowns-2026-07-17/audit.md`.
- `pnpm lint` passed, 24/24 test files and 153/153 tests passed, the production build passed all 17 routes, and the restarted post-build preview rendered without a runtime error.
- No route, data value, account, disclosure, navigation destination, or existing feature was removed.

final result: passed

## Superseding compact-net-assets and uniform-card-edge gate — 2026-07-19

This gate supersedes the earlier `balance-sheet うち inner-breakdown` behavior for geometrically small funding regions. The source amounts and proportional areas remain unchanged, but a small liabilities or net-assets region is no longer duplicated into a detached callout box.

### Balance-sheet structure

- The accepted R6 Niigata City case is unchanged at assets `5,318.7億円`, liabilities `4,888.8億円`, and net assets `429.9億円`. The right funding frame preserves the source-derived 91.9% / 8.1% split.
- The 8.1% net-assets region now contains `純資産`, `429.9億円`, and `資産の 8.1%` on one line inside the green region. It is not expanded, moved below the figure, or repeated as a separate card.
- Source-account details remain available in the existing `勘定科目の内訳とデータ確認` disclosure and in the accessible summary. The disclosure was opened and closed successfully against the post-build static output.
- The decorative circular plus at the liabilities/net-assets boundary was removed. The shared funding frame and its standard 1px separator communicate the additive stack without a floating badge.

### Uniform edge treatment

- Four-pixel top accents were removed from net-assets snapshot cards; four-pixel left accents were removed from change-driver cards and fee-boundary notes; three-pixel left accents were removed from financial notes/status text; and two-pixel left accents were removed from the map legend and expanded business-type helper.
- Normal cards use a uniform 1px border. Negative or warning states retain meaning through full-border tint, background, icon, text, and numeric color rather than one thick edge.
- `tests/design-edge-accents.test.ts` scans every CSS file under `app` and `components` and rejects directional borders of 2px or more.

### Accepted rendered evidence

- Final post-build desktop at 1491 x 1055: `artifacts/design-qa/balance-card-design-refinement-2026-07-19/09-postbuild-desktop-1491x1055.png`.
- Final post-build mobile: `10-postbuild-mobile-top-390x844.png` and `11-postbuild-mobile-net-assets-390x844.png` in the same directory.
- Final post-build uniform snapshot cards: `13-postbuild-summary-cards-1491x1055.png`.
- Combined reference/final inspections: `12-reference1-final-comparison.png` and `14-reference2-final-cards-comparison.png`.
- Desktop `scrollWidth` equaled `clientWidth` at 1480px; mobile equaled at 379px. Post-build browser warnings and errors were empty.

### Regression and scope

- `pnpm lint`: passed.
- `pnpm test`: 25/25 files and 154/154 tests passed.
- `pnpm build`: passed; 1,649 static pages generated with no compile, type, or export error.
- No database, schema, migration, ETL, imported-data, source-value, route, navigation, business switcher, table, map, ranking, or search behavior changed.
- Intentional subtraction: the detached compact-region callout, the circular funding-boundary plus, and decorative one-sided thick borders were removed. Exact account data and the disclosure were retained.

final result: passed

## Superseding fee-tab calculation, chart expansion, and spacing gate — 2026-07-20

This gate supersedes the earlier fee-tab treatment that hid the 100% equivalent behind `追加試算なし`, and extends the uniform-edge rule to the remaining business, comparison, and ranking states.

### Calculation and wording

- The Niigata City R6 public-sewer case displays the unmodified current monthly amount `3,047円`, the simple 100% expense-recovery equivalent `約2,930円`, and the signed difference `−117円／月`.
- The reference amount is calculated as `current monthly amount × 100 ÷ expense-recovery percentage`; the difference is `100% equivalent − current amount`. Positive, negative, and zero results have explicit signed-format regression coverage.
- A negative difference explains that the 100% equivalent is below the current amount and explicitly says it is not a price-reduction recommendation. `追加試算なし` and its former no-reduction wording are no longer rendered.

### Interaction and accessibility

- All four five-year indicator charts use the same labelled enlargement control. The production build was operated through all four `open → close` cycles successfully.
- The enlarged view is a labelled modal dialog with a 44px-or-larger close target, Escape and backdrop closing, background-scroll locking, and focus restoration to the originating chart.
- Desktop and mobile presentations use the same source SVG rather than a raster replacement. Browser warnings and errors were empty after the post-build interaction pass.

### Layout and uniform-edge audit

- The three detail tabs now span the content container with balanced left and right edges. Mobile labels remain on one line and no longer reserve icon width.
- The KPI row has a deliberate bottom separation before the tab group. The tab group, fee decision block, five-year indicators, and support cards use an audited sequence of smaller within-group gaps and larger between-group gaps.
- The five-pixel selected-business strip, the one-sided current-row inset, and the one-sided ranking focus inset were removed. Selection remains explicit through a full border, background, icon, and the text `表示中`.
- The CSS regression scan rejects directional borders of 2px or more, narrow 2–6px accent columns, and visibly offset inset shadows. Remaining chart reference lines and scrollbars are not card-edge accents.

### Accepted rendered evidence

- Combined attachment/final comparison: `artifacts/design-qa/fee-tab-layout-refinement-2026-07-20/20-reference-final-comparison.png`.
- Final post-build desktop at the reference viewport: `13-postbuild-desktop-1491x1055.png` in the same directory.
- Final post-build desktop chart dialog: `14-postbuild-chart-modal-desktop-1491x1055.png`.
- Mobile fee amount, full-width tabs, and signed difference: `10-after-mobile-tabs-390x844.png`.
- Mobile lower hierarchy and chart treatment: `11-after-mobile-trends-390x844.png`.
- Mobile chart dialog: `12-after-chart-modal-mobile-390x844.png`.

### Regression and scope

- `pnpm lint`: passed.
- `pnpm test`: 26/26 files and 157/157 tests passed.
- `pnpm build`: passed; 1,649 static pages generated with no compile, type, or export error.
- Post-build browser smoke: all four chart dialogs opened and closed; rendered calculation was `3,047円 → 約2,930円 → −117円／月`; warnings and errors were empty.
- No database, schema, migration, ETL, imported data, source value, route, navigation destination, business option, chart, table, map, ranking, or search behavior was removed.
- Intentional subtraction: decorative one-sided edge accents and the incorrect `追加試算なし` branch were removed. The selected-state meaning and all four chart functions were retained and made more explicit.

final result: passed

## Superseding accounting-copy and five-year chart-readability gate — 2026-07-20

This gate supersedes the earlier fee-tab wording that described only the sign of the `100%相当額 − 現在額` difference, and the earlier prefecture-comparison wording that framed `営業収益÷営業費用` as a site-specific concept.

### Official-source conclusions and corrected wording

- The Ministry of Land, Infrastructure, Transport and Tourism and official municipal guidance define expense recovery as the extent to which sewer-fee revenue covers the wastewater-treatment expenses that should be recovered through fees. The screen now says that a 100% or higher result means the fee revenue covered those target expenses in that fiscal year. It does not turn a negative reference difference into a price-reduction recommendation or claim that future pricing is conclusively appropriate.
- Article 24 of the Local Public Enterprises Act Enforcement Regulations defines operating profit or operating loss from operating revenue minus operating expense. Comparing the two is therefore presented as a general public-enterprise accounting analysis, not an idea unique to this site.
- Official municipal analysis commonly calculates the operating ratio after excluding entrusted-construction revenue and expense. The imported source separately identifies entrusted-construction expense but not entrusted-construction revenue, so the site does not claim to reproduce that exact ratio. It labels `営業収益÷営業費用×100` as `営業収支比率（簡易）` and discloses the limitation.
- The sufficiency boundary is 100%. The required visual grouping remains red below 50% and green at or above 50%, but every value below 100% is explicitly labelled `全額未達`; 50% is described only as a display-attention boundary.
- The data-sources page links directly to the e-Gov rule, the Ministry of Land, Infrastructure, Transport and Tourism expense-recovery explanation, and an official municipal operating-ratio explanation. The same simplified-ratio caveat is repeated in the comparison card and disclaimer.

### Five-year chart correction

- The dual series no longer positions both numbers from bar heights, where similar values and neighbouring years collided. Each year now has two fixed, vertically separated value rows, colored to match the blue and purple series.
- Household-fee and billable-volume charts separate the unit from plotted numbers. The fee chart shows `単位：円`; billable volume chooses `m³`, `千m³`, or `百万m³` from the data scale. This reduces label width without changing source values.
- The same SVG remains interactive in the compact card and enlargement dialog. No chart, year, series, or accessible textual summary was removed.

### Accepted rendered evidence

- Attachment/final chart comparison: `artifacts/design-qa/accounting-copy-chart-readability-2026-07-20/comparison-chart-before-after.png`.
- Attachment/final operating-analysis comparison: `comparison-operating-copy-before-after.png` in the same directory.
- Final post-build desktop chart dialog at 1491 x 1055: `13-postbuild-dual-chart-1491x1055.png`.
- Final desktop operating-analysis card: `07-after-operating-ratio-detail-1491x1055.png`.
- Final desktop data-source explanation: `09-after-data-sources-detail-1491x1055.png`.
- Final mobile chart dialog and operating-analysis card at 390 x 844: `10-after-dual-chart-390x844.png` and `12-after-operating-ratio-detail-390x844.png`.
- Post-build DOM checks confirmed the corrected fee note, `営業収支比率（簡易）`, `50%以上・全額未達`, general-accounting explanation, and official source links. Browser warnings and errors were empty.

### Regression and scope

- `pnpm lint`: passed.
- `pnpm test`: 27/27 files and 161/161 tests passed, including new official-link, accounting-copy, 100%/50% boundary, and chart-label regressions.
- `pnpm build`: passed; 1,649 static pages generated with no compile, type, or export error.
- No database, schema, migration, ETL, imported data, source value, route, navigation destination, business option, table, map, ranking, or search behavior changed.
- Intentional subtraction: the awkward sign-only sentence and misleading `（サイト算定）` wording were removed. No existing feature or accounting field was removed.
- Security cleanup: pre-existing local absolute paths and attachment identifiers in this QA log were replaced with a generic prior-task reference; no current attachment path or local username is recorded.

final result: passed

## Superseding recovery-first and financial-disclosure gate — 2026-07-20

This gate supersedes the earlier prefecture-comparison hierarchy that showed the simplified operating ratio as a default peer-comparison card and table column.

### Public-source conclusion and display policy

- Local Public Enterprise Act Article 17-2 requires enterprise expenses to be covered by income accompanying the enterprise except for expenses that general or special accounts should bear. It does not say that every sewer expense must be covered by sewer fees alone.
- The Ministry of Land, Infrastructure, Transport and Tourism explains the sewerage principle as `雨水公費・汚水私費`; legitimate public funding therefore exists. Rainwater-treatment burden revenue is already included in operating revenue.
- A simplified operating ratio below 100% shows an accounting operating loss, but does not by itself prove inadequate fees or improper tax-funded support. Fee adequacy remains the role of the official expense-recovery rate.
- Income-statement `他会計補助金` and Table 40 `基準外繰入金` are separate classifications. Neither is labelled as the direct amount used to fill the operating loss.
- The new ratios are explicitly labelled `相当の規模`; they are not labelled as a coverage or compensation rate and do not assert allocation or causality.

### Accepted interaction and visual evidence

- Default desktop and mobile views place expense recovery beside the monthly household fee. For Niigata City, the default card shows expense recovery `104.0%` and the prefectural median `96.1%`.
- Operating coverage is absent from the default comparison cards and the municipality table. A closed information disclosure labelled `営業収支と一般会計からの繰入` retains access to the analysis without competing with fee adequacy.
- Opening the disclosure shows the simplified operating ratio and four distinct amounts: operating loss `47.1億円`, rainwater-treatment burden revenue `89.6億円`, other-account subsidy revenue `22.4億円`, and non-standard transfer `2.0億円`.
- Desktop and mobile panels use uniform one-pixel borders, standard eight-pixel radii, and neutral section separation. No directional accent border, lifted edge, or decorative heavy side was added.
- Before/after comparison: `artifacts/design-qa/recovery-first-financial-disclosure-2026-07-20/comparison-before-after.png`.
- Final default and opened desktop captures: `02-after-closed-1491x1055.png` and `03-after-open-1491x1055.png` in the same directory.
- Final mobile default and funding captures: `04-after-closed-390x844.png` and `05-after-open-funding-390x844.png`.
- Final post-build captures: `06-production-closed-1491x1055.png` and `07-production-open-1491x1055.png`.
- A fresh post-build browser tab confirmed the closed default state, the opened values, the non-causation note, and no browser warnings or errors.

### Regression, scope, and intentional subtraction

- `pnpm lint`: passed.
- `pnpm test`: 27/27 files and 161/161 tests passed.
- `pnpm build`: passed; 1,649 static pages generated.
- No database, Prisma schema, migration, ETL, imported data, public static data, source value, route, navigation destination, business option, map, ranking, or search behavior changed.
- Intentional subtraction: the simplified operating ratio was removed from the default peer card, summary count, desktop table, and mobile comparison cards. The underlying value and 50% display treatment remain available in the information disclosure; no accounting field or feature was deleted.

final result: passed

## Superseding R6 Table 40 transfer-basis gate — 2026-07-21

This gate supersedes the earlier `recovery-first and financial-disclosure` treatment that compared transfer amounts with operating loss and described the ratios only as relative scale.

### Accounting and data correction

- `営業収益÷営業費用×100` remains an unmodified supplemental operating-profit/loss indicator. The sufficiency boundary remains 100%; the required red-below-50 and green-at-or-above-50 treatment remains only a display-attention classification.
- The explanation now pairs the possibility of non-standard support with the required exceptions: rainwater treatment, separated sewerage, advanced treatment, and other public-benefit expenses can be funded within the standard; other-account subsidy is an account title that can contain both standard and non-standard portions.
- R6 legal-applied Table 40 now supplies exact actual and non-standard amounts for rainwater-treatment burden, non-operating other-account subsidy, and capital-account other-account subsidy. Standard amounts are calculated only when both values are valid and `non-standard <= actual`.
- The ambiguous legal-applied `generalAccountTransfer` field is no longer published. Non-standard transfer totals used by rankings remain unchanged.
- Niigata City R6 is fixed by regression at operating coverage `81.386960...%`, expense recovery `103.9923%`, and non-standard transfer total `196,466千円`. Its Table 40 components are `0千円` rainwater, `36,466千円` non-operating subsidy, and `160,000千円` capital subsidy.

### Display and interaction

- The four mini-cards and operating-loss-relative percentages were removed. The disclosure now places the operating-coverage comparison next to one compact Table 40 table with `科目 / 会計上の区分 / 実額 / 基準内 / 基準外`, followed by the official total.
- Table amounts use exact thousand-yen source values rather than rounded hundred-million-yen abbreviations. The required note explains why the three displayed non-standard components may not exhaust every category included in the total.
- Desktop uses uniform one-pixel panel borders and neutral row separators. Mobile retains page-width integrity and places horizontal scrolling only inside the five-column table.
- At the requested browser override, desktop `1491 × 1055` produced a `1480 × 1047` content capture after browser chrome/scrollbar reservation. Mobile `390 × 844` produced a `379 × 820` content capture; `document.scrollWidth === document.clientWidth === 379`.

### Accepted rendered evidence

- Open desktop indicator and Table 40 table: `artifacts/design-qa/table40-transfer-breakdown-2026-07-21/01-final-desktop-open-1491x1055.png`.
- Mobile expense-recovery and operating-coverage sequence: `02-final-mobile-indicators-390x844.png` in the same directory.
- Mobile Table 40 panel and exact `196,466千円` total: `03-final-mobile-table-390x844.png` in the same directory.
- Browser DOM verification confirmed `81.4%`, `104.0%`, the exact three Table 40 rows, the official total, the exception wording, and the absence of page-level horizontal overflow.

### Regression and scope

- `pnpm lint`: passed.
- `pnpm test`: 28/28 files and 168/168 tests passed.
- `pnpm build`: passed; 1,649 static pages generated.
- No operating-coverage value, 50% color boundary, expense-recovery value, comparison order, non-standard-transfer ranking value, route, navigation destination, business option, map, ranking, or search behavior was removed.
- Intentional subtraction: operating-loss-relative scale percentages and their four boxed amount cards were removed because they could be read as a compensation rate. Exact account amounts and the official total replaced them.

final result: passed

## Superseding recovery-only national-map and R6 yearbook-original gate — 2026-07-22

This gate supersedes the nationwide map treatment that divided municipalities below 80% by the fee-unit-price threshold of 150 yen per cubic metre. Fee unit price remains available where it is useful, but it no longer affects the nationwide map color.

### Nationwide map correction

- The home and nationwide map heading is now `経費回収率`. Its legend has four recovery-only bands: `100%以上`, `90%以上100%未満`, `80%以上90%未満`, and `80%未満`, plus the unavailable state.
- Every result below 80% uses the same red treatment. The national fill function accepts only the expense-recovery rate; the fee-unit-price argument is absent and a regression test fixes that contract.
- The map explanation continues to disclose that prefectural color is a simple average of one displayed business per municipality, not a municipal consolidated value or an official national average.
- The separate fee-unit-price value remains in municipality analysis, rankings, and prefecture-level comparison where regional context can be understood. It is not presented as a nationwide map evaluation axis.

### R6 original yearbook data

- Every generated municipality detail has a lazily loaded R6 original-data payload. The generator reads 23 official Ministry of Internal Affairs and Communications / e-Stat Excel workbooks, selects the exact municipality, business key, and accounting type, and emitted 185,848 matching source rows across 1,586 municipality files.
- The viewer preserves the official horizontal format: `決算年度`, `業務コード`, `業種コード`, `事業コード`, `団体コード`, `団体名`, `施設コード`, `施設名`, `表番号`, `行番号`, `条件1` through `条件8`, and `列001` through `列099`, in that order. Empty cells remain empty and source text such as leading-zero codes is not converted.
- Users can switch among the available official tables and open the corresponding e-Stat Excel. The raw table is kept inside its own horizontal scroller; the page itself does not gain horizontal overflow.
- The existing concise indicator trace remains below the original table, so the official raw row and the site's mapped indicator can be checked in one disclosure without adding a competing dashboard card.
- Niigata City public sewerage displayed 13 official source parts, including Tables 20 and 40, at 117 columns. Switching to special-environment public sewerage changed the original row's business code from `1` to `4` while retaining municipality code `151009` and municipality name `新潟市`.
- Generated JSON contains official source URLs but no local workbook path, operating-system username, attachment identifier, or database file.

### Accepted rendered evidence

- The supplied before image and fresh desktop home capture were reviewed at the 1491 x 1055 reference viewport. The former two below-80 bands and combined heading are gone; the final legend is recovery-only.
- A fresh desktop Niigata City capture shows the expanded R6 original-data disclosure with Table 40 selected, the official Excel link, 117 columns / 2 rows, and the first original columns in order.
- A fresh 390 x 844 mobile capture shows the same disclosure and Table 40 selector. Browser measurements were `document.scrollWidth === document.clientWidth === 379`; only the raw table scrolls horizontally (`323px` client width / `9,126px` scroll width).
- Runtime captures were kept outside the publication diff as local QA artifacts. Browser warnings and errors were empty after the home, table-switch, mobile, and business-switch checks.

### Regression, scope, and intentional subtraction

- `pnpm static:data`: passed; 1,586 municipality yearbook payloads regenerated.
- `pnpm lint`: passed.
- `pnpm test`: 29/29 files and 172/172 tests passed.
- `pnpm build`: passed; 1,649 static pages generated.
- Existing expense-recovery values, fee-unit-price values, ranking formulas, prefecture comparison, business switching, accounting values, Table 40 values, routes, and navigation destinations remain unchanged.
- Intentional subtraction: the national map's `80%未満・単価150円/m³以上等` and `80%未満・単価150円/m³未満` color split, and the heading `経費回収率と使用料単価`, were removed because fee-unit price is not a defensible nationwide evaluation axis. No underlying fee-unit-price data or comparison feature was deleted.

final result: passed
