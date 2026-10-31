# v0.4 design QA

final result: passed

Scope: browser-rendered UI and live 2D compatibility renderer. Actual WebGL GPU appearance remains unverified, not included in this pass.

## Evidence
- Source: design/fusion-grove-tactics.png, 1586 × 992.
- Implementation: design/qa/desktop-final.png, 1475 × 946 CSS viewport, preparation state (floor 2 instead of mock floor 3; real save currency/party rather than mock data).
- Browser capture at 80% native zoom returned 1844 × 1183 with extra blank right/bottom; content crop at 0,0,1475,946 normalized it without stretching.
- Full comparison: design/qa/comparison.png, both images fit proportionally side-by-side.
- Focused HUD comparison: design/qa/hud-comparison.png.
- Other browser-tested CSS viewport sizes: 1180 × 757, 500 × 757, 400 × 606, 333 × 505. Narrow checks use native window resize and zoom, not mobile-device emulation.
- At 1180 × 757 final document scrollHeight=757; at 333 × 505 no horizontal overflow.

## Comparison history and fixes
1. Initial live render: oversized units, top enemy clipped. Reduced sprites 25%, added safe margins/staggered formation. Post-fix all bodies/health bars visible.
2. Desktop bottom overflow 15px and vertical-wrapped tactics label. Flex-height arena and nowrap label fixed; final viewport fits.
3. Chapter dots overlapped phase/clock. Moved phase below chapter, restrained solid translucent backing improves text contrast.
4. Identical enemies obscured role differences. Generated distinct heavy/hunter/caster sprites; visible in final comparison.
5. Code review found stale postbattle 3D identity and invisible units during failed texture load. Corrected render key and retained mesh until sprite success; renderer tests pass.

## Required fidelity surfaces
- Typography: restrained Chinese serif display headings and readable system UI. Real controls include explanatory/disabled states absent from mock. Small secondary metadata is lower priority; no critical truncation.
- Spacing: open battlefield and compact ivory bottom dock match the reference hierarchy. Narrow layouts intentionally split dock rows and scroll long modals.
- Colors: warm sandstone, muted sage CTA, ivory surfaces and subdued red/teal team indicators; no ornate frames or strong glow.
- Assets: generated scene/portraits/full-body units, Phosphor icons. No screenshot masquerading as controls. Live units/casts/health reflect engine data. Different hero art/party composition is intentional to preserve existing 11 archetypes.
- Copy: functional Chinese actions and real values; shared 3-charge counter, named target selection, clear menu labels.
- P3: camera framing and portraits are adapted rather than pixel-identical; some sprite weapon tips are tight to original art bounds. GPU material/lighting cannot be judged here.

## Browser interactions verified
Boot/fallback; forge hero selection survives tab switch; equip/unequip; training changes level/stats/currency; battle start, pause/tutorial, speed, ward/rally charge reduction; two battles reach victory and reward; relic selection and refresh preserve progression; narrow relic modal scroll; narrow menu exposes new expedition; modal close and focus state.
Automated behavioral tests additionally cover party/rules, reset, replay, disabled actions, focus trapping and transfer.

## Console and limits
Only expected WebGL context creation failure (GL disabled in cloud browser) and unrelated browser-extension metadata errors observed; no game JS runtime error during exercised flows. Do not claim actual GPU performance or real mobile touch validation.
No actionable P0/P1/P2 remains in verified UI scope.
