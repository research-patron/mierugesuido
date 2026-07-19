# Current Goal: R2-R6 Accounting Eligibility, Data Completion, and Financial Storytelling

## Goal Extension (2026-07-17 — business switching and correctness audit)

- Make it immediately clear that users can switch among every sewer-business record available for the municipality, such as public sewerage and special-environment public sewerage. Distinguish the current selection, other selectable records, and unavailable states with existing semantic colors, explicit text, and accessible controls rather than color alone.
- Audit the entire user-facing product for potentially false or misleading claims. Check visible copy, calculations, accounting scope, fiscal-year provenance, missing-data handling, intermunicipal operations, map/search/ranking aggregates, and navigation destinations against the implemented data model and authoritative sources.
- Correct only issues supported by evidence, preserve source values and provenance, and add regression coverage for each corrected claim or calculation.
- Capture the current switching flow before changes, then verify the final desktop and mobile flows from fresh rendered screenshots. Append a superseding QA gate and keep `design-qa.md` ending in `final result: passed` only after the full audit and regression suite succeed.

## Goal Extension (2026-07-17)

- Show the latest-year operating-expense coverage as an unmodified percentage: values below 50% use the critical red treatment, while values at or above 50% use the clear green treatment.
- Keep the home national-map popup informational. Prefecture navigation remains on the map shape, so the popup must not repeat an unreachable or duplicative `詳細を見る` action.
- Model intermunicipal sewer operations as an explicit operator-to-served-municipality relationship with official-source provenance. Count one shared operator only once in prefectural financial comparisons, show the served municipalities together, and never duplicate consolidated financial values as municipality allocations.

## Goal Extension (2026-07-12)

- Verify from primary government sources whether law-non-applied sewer businesses can be compared fairly for sewer-fee adequacy. Exclude them from fee-adequacy comparisons only if the official definitions and available data do not support a defensible comparison; otherwise retain them with an explicit accounting-basis caveat and limit accrual-accounting views to eligible businesses.
- Complete municipality-level indicator history for fiscal years R2 through R6 using the latest official source data, preserving source-year and accounting-status provenance.
- For the latest fiscal year (R6), add beginner-friendly visual explanations derived from the income statement, balance sheet, and related statements so users can understand cost structure, revenue sufficiency, asset funding, liabilities, and changes in net assets.
- Apply the existing `全国下水道使用料適正診断` visual system and an add/subtract design discipline: reduce cognitive load, reveal detail progressively, and avoid duplicative charts or decorative UI.
- Iterate from real rendered screenshots at the 1491 x 1055 reference viewport, compare source and implementation in a combined visual, and continue until `design-qa.md` ends with `final result: passed`.
- This extension explicitly permits the minimum necessary schema, migration, ETL, imported-data, and database changes for the R2-R6/R6 accounting work. It does not permit unrelated data edits or changes made only to force reference mock values.

# GitHub Commit, Push, and Confidentiality Policy (2026-07-18)

## Separate Development Completion From Publication

- Completing implementation, tests, screenshots, documentation, or QA does not authorize `git add`, `git commit`, `git push`, force-push, pull-request creation, merge, release, or deployment.
- When the requested development work is complete, first report the changed-file scope, validation results, secret-scan result, intended repository, and intended branch. Then ask the user explicitly: `この変更をコミットして GitHub にプッシュしますか？`
- Do not create a commit or push anything until the user gives an explicit affirmative answer to that question. Silence, an ambiguous reply, `続けて`, `完了して`, or a request to finish development is not publication approval.
- A publication approval applies only to the exact diff, repository, and branch described immediately before the question. If files change after approval, or the target repository/branch changes, present the new scope and ask again.
- If the user declines or has not answered, leave the worktree changes local and uncommitted. Report their status without repeatedly asking.
- Once explicitly approved, stage only the reviewed files, create an intentional commit, push the approved branch, and verify the remote commit SHA. Do not open or merge a pull request unless the user separately requests it.

## Mandatory Pre-Commit and Pre-Push Checks

- Inspect `git status`, the complete diff, untracked files, ignored-file rules, file sizes, and the remote/branch before staging. Never assume the whole worktree belongs to the task.
- Prefer explicit paths when staging. Use `git add -A` only after confirming that every unignored change is in scope.
- Before committing, run a dedicated secret scan such as Gitleaks against the staged change and relevant Git history, plus targeted checks for credentials, personal information, and local paths. A clean typecheck/test/build does not replace this security check.
- Before pushing, re-check the staged diff, commit metadata, repository visibility, remote URL, target branch, and whether the local branch is based on the current remote branch.
- Do not create a new commit if the configured author email exposes a personal address. Use the user's GitHub-provided `users.noreply.github.com` address unless the user explicitly approves another identity.
- After pushing, confirm that the remote SHA equals the intended local commit and report the repository, branch, commit link, validation results, and anything intentionally excluded.
- Never use force-push or rewrite published history without describing the exact impact and receiving separate explicit approval.

## Information That Must Never Be Committed or Pushed

- Never commit actual API keys, access tokens, refresh tokens, passwords, private keys, certificates, signing material, cookies, session data, OAuth credentials, webhook secrets, database credentials, GitHub credentials, Cloudflare credentials, or secret-manager exports.
- Never commit `.env` values or environment-specific secret files. Example files are allowed only when every value is an unmistakable non-secret placeholder.
- Never commit local or production database files, database dumps, raw private datasets, user records, unpublished source material, or unreviewed downloaded data. Public-source datasets may be committed only when their licensing, provenance, size, and absence of sensitive content have been checked.
- Never commit personal email addresses, phone numbers, account identifiers, local operating-system usernames, home-directory paths, absolute local paths, Codex attachment paths/IDs, browser profiles, device identifiers, or screenshots/logs containing such information unless the user explicitly requires that exact item to be published.
- Never commit `node_modules`, build outputs, caches, temporary files, local QA artifacts, editor metadata, OS metadata, or large generated files unless they are required deliverables and the user approves them after seeing the scope.
- Store deployment secrets in the target platform's encrypted environment-variable or secret-management facility, never in Git. Keep the repository private unless the user explicitly authorizes a visibility change.

## If Sensitive Information Is Detected

- Stop staging, committing, and pushing immediately. Report the category and affected file or commit without reproducing the secret value in chat, logs, commit messages, or reports.
- If the information has not been pushed, remove or sanitize it, update ignore rules when appropriate, rerun the full scan, and request publication approval again if the reviewed diff changed.
- If the information has already been pushed, do not assume a private repository makes it safe. Tell the user, recommend revoking or rotating credentials first when applicable, and obtain explicit approval before rewriting history or force-pushing.
- Do not weaken ignore rules, disable security checks, suppress a scanner finding, or mark a secret as a false positive merely to make a commit or CI check pass.

# Previous Goal: UI Fidelity Rebuild

## Objective

- Rebuild the visible UI/UX so the live implementation faithfully matches the updated reference images for the sewer fee diagnosis product.
- Primary target screens are the home page and municipality search page. The updated reference set also defines the shared product shell and adjacent route patterns for national map, prefecture map/detail, rankings, revision schedule, and data-source pages.
- The implementation must remain real, interactive application UI. Do not cover gaps by showing saved screenshots, raster page captures, static bitmap overlays, or non-functional image replacements.
- Database files, Prisma schema, migrations, ETL scripts, and imported data must not be changed for the original UI-only work; the 2026-07-12 goal extension above is the sole scoped exception.

## Updated Reference Images

The updated reference set was supplied as seven local Codex attachments. Resolve the files from the active task's attachments when available, but never record their absolute local paths, local usernames, or attachment identifiers in Git.

- Reference 1: home dashboard.
- Reference 2: prefecture map/detail.
- Reference 3: municipality search.
- Reference 4: municipality detail.
- Reference 5: revision schedule.
- Reference 6: data-source explanation.
- Reference 7: ranking/comparison.

All seven references are 1491 x 1055 desktop frames. Capture implementation screenshots at the same viewport when possible.

## Important Design Truths

- Product name in the updated references is `全国下水道使用料適正診断`.
- Header uses a left water-drop logo lockup, a navy product title, a small descriptive subtitle, icon-over-label navigation, and a teal active underline.
- The visual system is white/very pale aqua, navy text, teal primary actions, status colors for diagnostic levels, thin blue-gray borders, 8px-radius panels, compact but readable data density, and a light water-flow motif behind page headers.
- Home should feel like a dense public-data dashboard: KPI cards at the top, a large interactive Japan map, a prefecture selection panel, ranking snapshots, and guide cards in one first-screen composition.
- Municipality search should match the reference form/table structure: filter panel across the top, selected exclusion chip, KPI summary rail, table/card view toggle, dense 10-row table, status pills, row chevrons, pagination, and page-size control.
- Typography must be deliberate: strong navy headings, compact bold Japanese labels, clear numeric hierarchy, no browser-default control typography, no negative letter spacing.
- Icons must match the reference role and weight. Use the existing icon library only when it visually fits; do not replace specific visual assets with rough CSS drawings or placeholder shapes.

## Existing Implementation Problems To Correct

- The previous product framing still resembled `下水道経営のみえる化`; it must be aligned to the updated `全国下水道使用料適正診断` references.
- The previous attempt used static reference-frame/image completion. That was explicitly rejected. All visible UI must be component/CSS/SVG-map implementation, not a screenshot laid over the app.
- Current home/search layout is closer to the older references than the updated ones: hero copy is too large and editorial, the home composition lacks the top KPI/dashboard density, the search filters are not the updated multi-filter panel, and the table density/status treatment differs.
- The current map must remain functional and data-driven. It may use SVG/GIS data already present in the app, but must not be replaced with a flat screenshot.
- The national prefecture map must show prefecture-level boundaries only. Do not expose municipality sub-boundaries on the home/national map, including Hokkaido and Okinawa inset displays.
- National prefecture shapes must not visually lift, glow, scale, or otherwise pop out on cursor hover. Hover should only drive the informational popup; on the home map, navigation remains on the prefecture shape itself and the popup must not show a duplicate CTA.
- Prefecture boundaries on the national map should read as thin, smooth, low-contrast black/ink strokes rather than colored outlines.
- Hokkaido and Okinawa should be positioned inside stable empty areas of the national map canvas on responsive layouts: Hokkaido in the upper-left blank area and Okinawa in the lower-right blank area, without overlapping Honshu.
- National map hover detail popups should work for main prefectures and inset prefectures, with a short delay around 0.3 seconds. The popup must use real prefecture data and should not rely on a persistent default-prefecture card.
- Tokyo remote islands may be omitted from the national overview composition when needed for readability, as long as clicking Tokyo still opens the full prefecture/city map route.
- Existing feature paths must keep working: navigation, municipality search, table links, sort/pagination, map links/zoom/reset, rankings, revision schedule, data-source route, and municipality detail routes.
- If real data differs from the reference mock values, prioritize the app's existing real data while matching the layout, hierarchy, labels, and visual treatment. Do not edit the DB to force mock numbers.

## Acceptance Criteria

- `AGENTS.md` records this goal before implementation work continues.
- Home and municipality search are rebuilt against the updated references, with shared shell styles propagated so adjacent screens remain visually coherent.
- No database, migration, ETL, or imported data files are modified outside the scoped R2-R6 and R6 accounting-data work authorized by the 2026-07-12 goal extension.
- No screenshot overlay, page capture, or static bitmap replacement is used for application UI.
- Core interactions are verified after changes: search form, search results navigation, table pagination/sort where present, map interaction, and header navigation.
- Visual QA must compare source reference images and rendered screenshots side by side. `design-qa.md` must end with `final result: passed` before the work is considered complete, or `final result: blocked` only if capture/comparison is genuinely impossible.
- If any existing function or visible feature is removed, report exactly what was removed and why in the final response.
