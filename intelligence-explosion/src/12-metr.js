// =====================================================================
// 12 · METR data shared by the tower scene.
// =====================================================================
// METR 50%-success time horizons (hours). Approximate, from METR's published
// figures (TH1/TH1.1). Opus 4.6 uses the corrected ~12 h estimate; Mythos
// Preview is the 17.4 h early estimate (95% CI 8.5–55 h).
const METR = [
  { y: 2019.12, h: 0.0006, n: 'GPT-2' }, { y: 2020.42, h: 0.0025, n: 'GPT-3' }, { y: 2022.2, h: 0.01, n: 'GPT-3.5' },
  { y: 2023.2, h: 0.08, n: 'GPT-4', lab: 'GPT-4 · 5 min' }, { y: 2024.37, h: 0.15, n: 'GPT-4o' }, { y: 2024.8, h: 0.35, n: 'Claude 3.5 Sonnet' },
  { y: 2024.96, h: 0.65, n: 'o1' }, { y: 2025.15, h: 0.98, n: 'Claude 3.7 Sonnet', lab: 'Claude 3.7 Sonnet · 1 hour' }, { y: 2025.3, h: 1.5, n: 'o3' },
  { y: 2025.6, h: 2.3, n: 'GPT-5' }, { y: 2025.9, h: 4.8, n: 'Claude Opus 4.5', lab: 'Opus 4.5 · 4.8 hours' },
  { y: 2026.1, h: 12, n: 'Claude Opus 4.6', lab: 'Opus 4.6 · ~12 hours' }, { y: 2026.3, h: 17.4, n: 'Claude Mythos Preview', lab: 'Mythos Preview · ~17 hours' },
];
