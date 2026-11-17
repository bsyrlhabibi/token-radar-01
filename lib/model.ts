// The Launch Radar model, comps-2: one sealed DefiLlama snapshot in, one ranked
// board of pre-token protocols out.
//
// Rounds 1 and 2 priced each protocol from its category's median market-cap-to-TVL
// ratio. That model is kept below, whole, as the validation harness's middle
// column — because out of sample it loses. What prices the board now is the
// market's size curve: a log-log line fitted to the snapshot's traded protocols,
// log(market cap) = a + b · log(TVL). One line, two fitted numbers, no category
// adjustments, no momentum or maturity terms — not because those terms were
// never tried, but because each was tried against the curve on two blind tests
// (leave-one-out, and a time split that fits the older half and tests the newer)
// and each made the blind error worse. The harness that decided that ships in
// this file and its numbers ship in the board data; the model page shows them.
//
// The fit is only as honest as its evidence, so the fit set is cleaned by three
// stated rules: a protocol must actually trade (cap and TVL both recorded), it
// must not be an exchange's own listing (a company, not a protocol), and a
// ticker family counts once, at its largest cap. Every board row then carries
// the curve's price, a band from 200 bootstrap refits of the fit, the rank
// range those refits give it, and a farm plan whose six steps end in a netted
// verdict computed from stated assumptions.
//
// The board's selection is the house's own rule, whole: pre-token (no market
// cap, no CoinGecko id, no symbol recorded), not an exchange, not a versioned
// pool of another protocol. Bridges and staking are swept like everything else;
// the watchlist is covered in full and the board keeps going to the snapshot's
// own $5M edge, because the early rows are the point of a radar.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The round-1 model's constants, kept because the harness still prices with them. */
export interface RadarConstants {
  shrink_k: number;
  multiple_min: number;
  multiple_max: number;
  growth_clamp_pct: number;
  growth_up_weight: number;
  growth_down_weight: number;
  age_floor: number;
  age_range: number;
  age_cap_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_extra: number;
}

export const CONSTANTS: RadarConstants = {
  shrink_k: 10,
  multiple_min: 0.02,
  multiple_max: 3,
  growth_clamp_pct: 40,
  growth_up_weight: 0.8,
  growth_down_weight: 1.1,
  age_floor: 0.75,
  age_range: 0.25,
  age_cap_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_max_extra: 6,
};

/** This model's version label: the dashboard names it and the board carries it. */
export const MODEL_VERSION = 'comps-2';

/** How many live-token protocols the dashboard's market view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The flat constant the house model multiplies every TVL by; the harness's first column. */
export const FLAT_MULTIPLE = 0.25;

/** The bootstrap: how many refits price every board row's band, and the seed that fixes them. */
export const BOOTSTRAP_REFITS = 200;
export const BOOTSTRAP_SEED = 20261114;

/** The netting's stated assumptions: what a farm plan is weighed against. */
export interface NettingConstants {
  community_pct: number;
  capture_pct: number;
  farm_max_pct: number;
  thin_max_pct: number;
  weekly_fee_usd: number;
  gas_usd: { ethereum: number; solana: number; bitcoin: number; evm: number; other: number };
}

export const NETTING: NettingConstants = {
  community_pct: 0.05,
  capture_pct: 0.001,
  farm_max_pct: 10,
  thin_max_pct: 35,
  weekly_fee_usd: 2,
  gas_usd: { ethereum: 10, solana: 0.05, bitcoin: 2, evm: 1, other: 1 },
};

/** One category's evidence: how many live peers, their median ratio, the round-1 multiple. */
export interface CategoryComp {
  category: string;
  peers: number;
  median_multiple: number;
  used_multiple: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm plan's netted verdict, from the plan's own numbers. */
export type Verdict = 'FARM' | 'THIN' | 'SKIP';

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  band_low_usd: number;
  band_high_usd: number;
  rank_low: number;
  rank_high: number;
  verdict: Verdict;
  plan_cost_usd: number;
  plan_hours: number;
  breakeven_pct: number;
  model: {
    effective_multiple: number;
    growth_pct: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row: the figures plus the parts a sandbox needs. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  band_low_usd: number;
  band_high_usd: number;
  rank_low: number;
  rank_high: number;
  verdict: Verdict;
  plan_cost_usd: number;
  plan_hours: number;
  breakeven_pct: number;
  tier: 'watchlist' | 'early';
  parts: {
    effective_multiple: number;
    growth_pct: number;
  };
  /* The board row's own farm steps, carried into the page data so the
     dashboard tells the plan in the board's exact words. */
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The fitted curve and the fit set it came from. */
export interface FitInfo {
  intercept: number;
  slope: number;
  n: number;
  traded: number;
  dropped_cex: number;
  dropped_family: number;
  mean_log_tvl: number;
  mean_log_mcap: number;
}

/** One candidate term's blind-test record: what it faced, what it scored, the decision. */
export interface TermInfo {
  name: string;
  kept: boolean;
  loo_against: number;
  loo_with: number;
  split_against: number;
  split_with: number;
}

/** The harness's verdicts: typical miss (the median fold error, as a multiple) per model per test. */
export interface ValidationInfo {
  eval_n: number;
  split_train: number;
  split_test: number;
  loo: { flat: number; comps1: number; comps2: number };
  split: { flat: number; comps1: number; comps2: number };
  terms: TermInfo[];
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  constants: RadarConstants;
  global_multiple: number;
  live_peers: number;
  scanned_size: number;
  pre_token_size: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  fit: FitInfo;
  validation: ValidationInfo;
  netting: NettingConstants;
  bootstrap_refits: number;
  categories: CategoryComp[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** A dollar figure in full, grouped: the one format every verdict line uses. */
export function fmtUsd(n: number): string {
  return `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** A break-even percentage as it is printed: one decimal, capped at the hopeless end. */
export function fmtPct(x: number): string {
  return x >= 999 ? '>999%' : `${x.toFixed(1)}%`;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Whole days from a protocol's listing to the snapshot date; null when either is absent. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The market's ratios, read out of the snapshot: for every category with
 * live-token peers, the median market-cap-to-TVL ratio, and the round-1 model's
 * shrunk version of it. The board no longer prices from these — the harness
 * showed the curve beats them out of sample — but they are the market's
 * evidence, the dashboard shows them, and the harness's middle column is built
 * from them, so they are computed exactly as round 1 computed them.
 */
export function categoryComps(snapshot: Snapshot, c: RadarConstants = CONSTANTS): { comps: Map<string, CategoryComp>; globalMultiple: number; livePeers: number } {
  const ratios = new Map<string, number[]>();
  let all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    if (p.category !== null) {
      const list = ratios.get(p.category) ?? [];
      list.push(ratio);
      ratios.set(p.category, list);
    }
  }
  const globalMultiple = all.length > 0 ? median(all) : 0.2;
  const logGlobal = Math.log(globalMultiple);
  const comps = new Map<string, CategoryComp>();
  for (const [category, list] of ratios) {
    const med = median(list);
    const blended = Math.exp((list.length * Math.log(med) + c.shrink_k * logGlobal) / (list.length + c.shrink_k));
    comps.set(category, {
      category,
      peers: list.length,
      median_multiple: round4(med),
      used_multiple: round4(Math.min(c.multiple_max, Math.max(c.multiple_min, blended))),
    });
  }
  return { comps, globalMultiple, livePeers: all.length };
}

/* ---- the round-1 model's moving parts, kept whole for the harness ---- */

/** Momentum as round 1 weighted it: the week's TVL change, clamped, losses heavier. */
function growthMultOf(p: SnapshotProtocol, c: RadarConstants = CONSTANTS): number {
  const raw = finite(p.change_7d, 0);
  const g = Math.min(c.growth_clamp_pct, Math.max(-c.growth_clamp_pct, raw));
  return 1 + (g / 100) * (g >= 0 ? c.growth_up_weight : c.growth_down_weight);
}

/** Maturity as round 1 weighted it: age on DefiLlama, capped at three years. */
function ageMultOf(p: SnapshotProtocol, asOf: string, c: RadarConstants = CONSTANTS): number {
  const age = ageDays(asOf, p.listed_at) ?? c.unknown_age_days;
  return c.age_floor + (Math.min(Math.max(age, 0), c.age_cap_days) / c.age_cap_days) * c.age_range;
}

/** Reach as round 1 weighted it: a step per chain beyond the first. */
function chainMultOf(p: SnapshotProtocol, c: RadarConstants = CONSTANTS): number {
  return 1 + c.chain_step * Math.min(Math.max(p.chains.length - 1, 0), c.chain_max_extra);
}

/** The clamped growth figure a row reports, as round 1 reported it. */
function growthPctOf(p: SnapshotProtocol, c: RadarConstants = CONSTANTS): number {
  const raw = finite(p.change_7d, 0);
  return Math.min(c.growth_clamp_pct, Math.max(-c.growth_clamp_pct, raw));
}

/** Round 1's price for one protocol, from a training set's comps: the harness's middle column. */
function priceComps1(p: SnapshotProtocol, asOf: string, comps: Map<string, CategoryComp>, globalMultiple: number, c: RadarConstants = CONSTANTS): number {
  const comp = p.category === null ? undefined : comps.get(p.category);
  const multiple = comp !== undefined ? comp.used_multiple : round4(Math.min(c.multiple_max, Math.max(c.multiple_min, globalMultiple)));
  return p.tvl_usd * multiple * growthMultOf(p, c) * ageMultOf(p, asOf, c) * chainMultOf(p, c);
}

/* ---- the fit ---- */

/**
 * The fit set, cleaned by the three stated rules: the protocol trades (cap and
 * TVL both recorded and positive); it is not an exchange's own listing; and a
 * ticker family counts once, at its largest cap. Returns the rows and the
 * counts each rule removed, so the cleaning itself is auditable.
 */
export function buildFitSet(snapshot: Snapshot): { rows: SnapshotProtocol[]; traded: number; droppedCex: number; droppedFamily: number } {
  const traded = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const noCex = traded.filter((p) => p.category !== 'CEX');
  const byFamily = new Map<string, SnapshotProtocol>();
  for (const p of noCex) {
    const key = p.symbol ?? `#${p.slug}`;
    const held = byFamily.get(key);
    if (held === undefined || (p.mcap_usd ?? 0) > (held.mcap_usd ?? 0)) byFamily.set(key, p);
  }
  const rows = [...byFamily.values()];
  return { rows, traded: traded.length, droppedCex: traded.length - noCex.length, droppedFamily: noCex.length - rows.length };
}

/** Least squares on log-log: log(market cap) = a + b · log(TVL), and the two means it turns on. */
export function fitCurve(rows: SnapshotProtocol[]): { a: number; b: number; meanLogTvl: number; meanLogMcap: number } {
  if (rows.length < 2) return { a: Math.log(0.2), b: 0, meanLogTvl: 0, meanLogMcap: Math.log(0.2) };
  let mx = 0;
  let my = 0;
  for (const p of rows) {
    mx += Math.log(p.tvl_usd);
    my += Math.log(p.mcap_usd ?? 1);
  }
  mx /= rows.length;
  my /= rows.length;
  let sxy = 0;
  let sxx = 0;
  for (const p of rows) {
    const dx = Math.log(p.tvl_usd) - mx;
    sxy += dx * (Math.log(p.mcap_usd ?? 1) - my);
    sxx += dx * dx;
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b, meanLogTvl: mx, meanLogMcap: my };
}

/** The candidate terms the harness may add to the curve, in the order it tries them. */
export const CANDIDATE_TERMS = ['momentum', 'maturity', 'reach', 'category'] as const;
export type CandidateTerm = (typeof CANDIDATE_TERMS)[number];

/**
 * A pricer prepared on a training set: the curve fitted there, plus whichever
 * candidate terms it carries. A term's log contribution is added to the
 * curve's log price — momentum, maturity and reach use round 1's own
 * multipliers; the category term is fitted here, as each category's mean
 * residual shrunk toward zero by its count, K = 10.
 */
function preparePricer(train: SnapshotProtocol[], asOf: string, terms: readonly CandidateTerm[]): (p: SnapshotProtocol) => number {
  const { a, b } = fitCurve(train);
  let shifts = new Map<string, number>();
  if (terms.includes('category')) {
    const residuals = new Map<string, number[]>();
    for (const t of train) {
      if (t.category === null) continue;
      const list = residuals.get(t.category) ?? [];
      list.push(Math.log(t.mcap_usd ?? 1) - (a + b * Math.log(t.tvl_usd)));
      residuals.set(t.category, list);
    }
    shifts = new Map(
      [...residuals].map(([cat, list]) => {
        const mean = list.reduce((s, x) => s + x, 0) / list.length;
        return [cat, mean * (list.length / (list.length + CONSTANTS.shrink_k))] as const;
      }),
    );
  }
  return (p: SnapshotProtocol): number => {
    let logPrice = a + b * Math.log(p.tvl_usd);
    if (terms.includes('momentum')) logPrice += Math.log(growthMultOf(p));
    if (terms.includes('maturity')) logPrice += Math.log(ageMultOf(p, asOf));
    if (terms.includes('reach')) logPrice += Math.log(chainMultOf(p));
    if (terms.includes('category') && p.category !== null) logPrice += shifts.get(p.category) ?? 0;
    return Math.exp(logPrice);
  };
}

/** A pricer for round 1's model, prepared on a training set. */
function prepareComps1(train: SnapshotProtocol[], asOf: string): (p: SnapshotProtocol) => number {
  const pseudo: Snapshot = { as_of: asOf, source: '', floor_usd: 1, protocols: train, watchlist: [] };
  const { comps, globalMultiple } = categoryComps(pseudo);
  return (p: SnapshotProtocol): number => priceComps1(p, asOf, comps, globalMultiple);
}

/** The typical miss: the median fold error, as a multiple. Half the test rows price closer than this. */
function typicalMiss(errors: number[]): number {
  return Math.exp(median(errors));
}

/** Leave-one-out: every fit protocol is priced by a model that never saw it. */
function looMiss(rows: SnapshotProtocol[], prepare: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number): number {
  const errors: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const train = rows.filter((_, j) => j !== i);
    const price = prepare(train);
    errors.push(Math.abs(Math.log(price(rows[i]!) / (rows[i]!.mcap_usd ?? 1))));
  }
  return typicalMiss(errors);
}

/** The time split: fit the older half by listing date, price the newer half. */
function splitMiss(rows: SnapshotProtocol[], prepare: (train: SnapshotProtocol[]) => (p: SnapshotProtocol) => number): { miss: number; train: number; test: number } {
  const dated = rows.filter((p) => p.listed_at !== null).sort((x, y) => (x.listed_at! < y.listed_at! ? -1 : x.listed_at! > y.listed_at! ? 1 : 0));
  const half = Math.floor(dated.length / 2);
  const train = dated.slice(0, half);
  const test = dated.slice(half);
  const price = prepare(train);
  return { miss: typicalMiss(test.map((p) => Math.abs(Math.log(price(p) / (p.mcap_usd ?? 1))))), train: train.length, test: test.length };
}

/**
 * The harness: three models priced blind, then each candidate term tried
 * against the shipped set in turn. A term is kept only if it lowers the
 * leave-one-out miss without raising the time-split miss. On this snapshot
 * every term fails one test or the other, and the shipped model is the bare
 * curve — the table is the evidence, and it ships with the board.
 */
export function validateModels(snapshot: Snapshot, fitRows: SnapshotProtocol[]): { validation: ValidationInfo; keptTerms: CandidateTerm[] } {
  const asOf = snapshot.as_of;
  const flat = (_train: SnapshotProtocol[]) => (p: SnapshotProtocol): number => FLAT_MULTIPLE * p.tvl_usd;
  const comps1 = (train: SnapshotProtocol[]) => prepareComps1(train, asOf);
  const curveOnly = (train: SnapshotProtocol[]) => preparePricer(train, asOf, []);
  const loo = {
    flat: looMiss(fitRows, flat),
    comps1: looMiss(fitRows, comps1),
    comps2: looMiss(fitRows, curveOnly),
  };
  const splitFlat = splitMiss(fitRows, flat);
  const splitComps1 = splitMiss(fitRows, comps1);
  const splitCurve = splitMiss(fitRows, curveOnly);
  const split = { flat: splitFlat.miss, comps1: splitComps1.miss, comps2: splitCurve.miss };

  const kept: CandidateTerm[] = [];
  const terms: TermInfo[] = [];
  let baseLoo = loo.comps2;
  let baseSplit = split.comps2;
  for (const term of CANDIDATE_TERMS) {
    const trial = [...kept, term];
    const prepare = (train: SnapshotProtocol[]) => preparePricer(train, asOf, trial);
    const trialLoo = looMiss(fitRows, prepare);
    const trialSplit = splitMiss(fitRows, prepare).miss;
    const keep = trialLoo < baseLoo && trialSplit <= baseSplit;
    terms.push({ name: term, kept: keep, loo_against: round2(baseLoo), loo_with: round2(trialLoo), split_against: round2(baseSplit), split_with: round2(trialSplit) });
    if (keep) {
      kept.push(term);
      baseLoo = trialLoo;
      baseSplit = trialSplit;
    }
  }
  if (kept.length > 0) {
    const prepare = (train: SnapshotProtocol[]) => preparePricer(train, asOf, kept);
    loo.comps2 = looMiss(fitRows, prepare);
    split.comps2 = splitMiss(fitRows, prepare).miss;
  }
  return {
    validation: {
      eval_n: fitRows.length,
      split_train: splitCurve.train,
      split_test: splitCurve.test,
      loo: { flat: round2(loo.flat), comps1: round2(loo.comps1), comps2: round2(loo.comps2) },
      split: { flat: round2(split.flat), comps1: round2(split.comps1), comps2: round2(split.comps2) },
      terms,
    },
    keptTerms: kept,
  };
}

/* ---- the bootstrap ---- */

/** mulberry32: a small deterministic stream, so the bands are the same on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The p-quantile of a sorted list, by nearest rank. */
function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

/**
 * Bands by bootstrap: resample the fit set with replacement, refit, reprice
 * the whole board, 200 times. A row's band is the middle 80% of its refit
 * prices; its rank range is the middle 80% of its refit ranks. The seed is a
 * constant, so board.json is reproducible byte for byte.
 */
export function bootstrapBands(
  fitRows: SnapshotProtocol[],
  chosen: SnapshotProtocol[],
  asOf: string,
  keptTerms: readonly CandidateTerm[],
): Map<string, { bandLow: number; bandHigh: number; rankLow: number; rankHigh: number }> {
  const rand = mulberry32(BOOTSTRAP_SEED);
  const prices = new Map<string, number[]>(chosen.map((p) => [p.slug, []]));
  const ranks = new Map<string, number[]>(chosen.map((p) => [p.slug, []]));
  for (let r = 0; r < BOOTSTRAP_REFITS; r++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < fitRows.length; i++) sample.push(fitRows[Math.floor(rand() * fitRows.length)]!);
    const price = preparePricer(sample, asOf, keptTerms);
    const scored = chosen.map((p) => ({ slug: p.slug, value: price(p) }));
    scored.sort((x, y) => y.value - x.value || (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0));
    scored.forEach((s, i) => {
      prices.get(s.slug)!.push(s.value);
      ranks.get(s.slug)!.push(i + 1);
    });
  }
  const out = new Map<string, { bandLow: number; bandHigh: number; rankLow: number; rankHigh: number }>();
  for (const p of chosen) {
    const ps = [...prices.get(p.slug)!].sort((x, y) => x - y);
    const rs = [...ranks.get(p.slug)!].sort((x, y) => x - y);
    out.set(p.slug, {
      bandLow: Math.max(1, Math.round(quantile(ps, 0.1))),
      bandHigh: Math.max(1, Math.round(quantile(ps, 0.9))),
      rankLow: Math.round(quantile(rs, 0.1)),
      rankHigh: Math.round(quantile(rs, 0.9)),
    });
  }
  return out;
}

/* ---- selection ---- */

/** A name ending in a release marker is a later pool of another protocol, not a launch. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is a launch candidate in its own right: the house's own
 * rule, whole — pre-token, not an exchange, not a versioned pool. Nothing else
 * is excluded: a bridge or a staking pool that records no token is swept like
 * any other protocol, because the radar that skips the largest pre-token
 * protocols on the board's own terms is not sweeping its territory.
 */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category === 'CEX') return false;
  if (VERSIONED.test(p.name)) return false;
  return true;
}

/* ---- farm plans ---- */

/** The ecosystem a chain belongs to, for gas and wallet wording. */
function ecosystem(chain: string): 'evm' | 'solana' | 'bitcoin' | 'other' {
  if (chain === 'Solana') return 'solana';
  if (chain === 'Bitcoin' || chain === 'Lightning Network') return 'bitcoin';
  if (['Ethereum', 'Arbitrum', 'Base', 'Optimism', 'Polygon', 'Avalanche', 'BSC', 'Scroll', 'Linea', 'zkSync Era', 'Mantle', 'Blast', 'Mode', 'Taiko', 'Gnosis', 'Fantom', 'Cronos', 'Celo', 'Moonbeam', 'Metis', 'Boba', 'Fraxtal', 'Sonic', 'Berachain', 'Monad', 'Hyperliquid L1'].includes(chain)) return 'evm';
  return 'other';
}

function gasWording(chain: string): string {
  const eco = ecosystem(chain);
  if (eco === 'solana') return 'a few cents of SOL in fees';
  if (eco === 'bitcoin') return 'one ordinary on-chain fee';
  if (chain === 'Ethereum') return '$6 to $15 of ETH in gas';
  if (eco === 'evm') return 'about $1 of gas';
  return 'a small network fee';
}

/** Gas as a number, for the netting: the midpoint of what the wording promises. */
function gasUsd(chain: string): number {
  if (chain === 'Ethereum') return NETTING.gas_usd.ethereum;
  return NETTING.gas_usd[ecosystem(chain)];
}

/** How much capital one farm position needs, scaled to the protocol's own size. */
function capitalFor(tvl: number): number {
  if (tvl >= 1_000_000_000) return 500;
  if (tvl >= 250_000_000) return 250;
  if (tvl >= 50_000_000) return 150;
  if (tvl >= 10_000_000) return 100;
  return 50;
}

/** How long a position should season, from the protocol's age. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The core position and the weekly activity, in the words of the protocol's line of work. */
function playbook(p: SnapshotProtocol, chain: string, capital: number): { open: string; weekly: string; watch: string } {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return {
      open: `Supply $${capital} of USDC to ${n} on ${chain}, then borrow a small amount against it and repay, so the wallet shows both sides of the market`,
      weekly: `rebalance the position once a week and keep the health factor comfortably above liquidation`,
      watch: `a borrow rate spike or an oracle warning on the position's market page`,
    };
  if (c.includes('dex') || c.includes('leveraged'))
    return {
      open: `Add $${capital} of liquidity to ${n}'s deepest pool on ${chain} and route two or three real swaps through it`,
      weekly: `swap a small amount through ${n} once a week and re-centre the liquidity if the price drifts`,
      watch: `impermanent loss if the pool's pair runs apart; the plan's capital is the most it can cost`,
    };
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options'))
    return {
      open: `Deposit $${capital} of USDC as margin on ${n} and open one small hedged position, spot against perp, so the account trades without directional risk`,
      weekly: `roll or resize the hedge once a week so the account keeps a live trading history`,
      watch: `funding flipping against the hedge; keep the position small enough that a bad week is a lesson, not a loss`,
    };
  if (c.includes('curator') || c.includes('allocator') || c.includes('capital'))
    return {
      open: `Deposit $${capital} into one of ${n}'s flagship vaults on ${chain} and keep the vault shares in the wallet`,
      weekly: `check the vault's allocation once a week and move to its successor vault if the curator rotates`,
      watch: `the vault's underlying markets; a curator's risk sits in what the vault lends to, not in the vault itself`,
    };
  if (c.includes('rwa') || c.includes('treasur') || c.includes('stable'))
    return {
      open: `Mint or deposit $${capital} of ${n}'s yield-bearing asset on ${chain} and hold it untouched`,
      weekly: `make one small top-up or redemption a week so the holding is active, not dust`,
      watch: `redemption windows and issuer notices; these assets pay slowly and exit slower`,
    };
  if (c.includes('bridge'))
    return {
      open: `Move $${capital} of USDC across ${n}'s own routes to ${chain} and back, then keep a balance resting on each side of the bridge`,
      weekly: `bridge one small transfer each way so the wallet keeps a live history on both chains, and join any points or season program the bridge is running`,
      watch: `the bridge's own contracts and pause notices; bridge contract risk is this category's defining risk, and funds mid-route are the exposed ones`,
    };
  if (c.includes('restaked'))
    return {
      open: `Wrap $${capital} of BTC into ${n} on ${chain} and hold the restaked receipt token in the wallet`,
      weekly: `check the wrapper's backing and the receipt's exchange rate once a week, and keep the position restaked`,
      watch: `the BTC wrapper itself plus slashing on the services it secures; two layers have to hold for the receipt to be worth its claim`,
    };
  if (c.includes('liquid restaking'))
    return {
      open: `Deposit $${capital} of ETH or a liquid staking token into ${n} on ${chain} and hold the restaking receipt in the wallet`,
      weekly: `keep the position restaked and check which services it secures once a week, since the risk set changes as operators rotate`,
      watch: `slashing terms stacking up across the services the position secures, and the receipt token trading under the value of what backs it`,
    };
  if (c.includes('liquid staking'))
    return {
      open: `Stake $${capital} of the base asset through ${n} on ${chain} and hold the receipt token it issues in the wallet`,
      weekly: `check the receipt token's exchange rate against the base asset once a week and put the receipt to work in one of the venue's own markets`,
      watch: `the receipt token's price against the asset it claims; a depeg or a slashing event lands on receipt holders first`,
    };
  if (c.includes('payment'))
    return {
      open: `Fund a ${n} wallet or channel with $${capital} and route two real payments through it`,
      weekly: `send one small payment a week so the account keeps a genuine usage history`,
      watch: `channel or wallet balances draining in fees; top up little and often`,
    };
  if (c.includes('yield') || c.includes('farm'))
    return {
      open: `Deposit $${capital} into ${n}'s main vault on ${chain} and keep the receipt token in the wallet`,
      weekly: `compound or re-deposit the yield once a week rather than selling it`,
      watch: `the vault's strategy changing under you; read its page before each compound`,
    };
  if (c.includes('prediction'))
    return {
      open: `Fund $${capital} on ${n} and take small positions on three liquid markets`,
      weekly: `trade one market a week and settle positions as they resolve`,
      watch: `thin markets where the exit price is not the screen price`,
    };
  return {
    open: `Deposit $${capital} of USDC into ${n} on ${chain} and keep the position open`,
    weekly: `make one qualifying action a week, a deposit, a swap or a vote, so the wallet reads as a user and not a passer-by`,
    watch: `the protocol's own announcements page; terms change quietly and positions should follow`,
  };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: six steps, derived from its own record — its line of
 * work, its first chain, its size and its age. No protocol is named or
 * special-cased; the same playbook logic writes every plan on the board.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const gas = gasWording(chain);
  const book = playbook(p, chain, capital);
  return [
    {
      text: `Start from a fresh wallet funded only with the farming budget, its seed phrase written offline; a launch, if it comes, will look for real users, and a clean wallet is one`,
      cost: gas,
      time: '5 minutes',
    },
    {
      text: book.open,
      cost: `$${capital} of capital plus ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: `Each week, ${book.weekly}`,
      cost: 'about $2 of fees a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, across more than one weekly snapshot of the protocol's numbers`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Watch for ${book.watch}. Check ${p.name}'s own site and its official account before acting on any launch or points news, and follow only links published there`,
      cost: 'nothing to check, and never pay anyone to claim an airdrop',
      time: '10 minutes',
    },
    {
      text: `Keep a farm log — wallet, dates, amounts, transaction hashes — and unwind the position when the token launches, when the protocol announces its snapshot, or when its TVL falls by a third from your entry`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/**
 * The netting: what a plan costs all-in, what it takes in hours, and the
 * launch chance at which it pays for itself — weighed at the row's band low,
 * on the stated assumptions. The verdict follows the break-even chance:
 * FARM if the plan pays at a 1-in-10 launch chance or worse odds, THIN up to
 * the stated ceiling, SKIP beyond it.
 */
export function planNetting(p: SnapshotProtocol, age: number | null, bandLow: number): { verdict: Verdict; costUsd: number; hours: number; breakevenPct: number } {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const weeks = Math.ceil(hold / 7);
  const cost = capital + 2 * gasUsd(chain) + NETTING.weekly_fee_usd * weeks;
  const hours = round1((35 + 10 * weeks) / 60);
  const reward = bandLow * NETTING.community_pct * NETTING.capture_pct;
  const breakeven = reward > 0 ? Math.min(999, round1((cost / reward) * 100)) : 999;
  const verdict: Verdict = breakeven <= NETTING.farm_max_pct ? 'FARM' : breakeven <= NETTING.thin_max_pct ? 'THIN' : 'SKIP';
  return { verdict, costUsd: Math.round(cost), hours, breakevenPct: breakeven };
}

/** The verdict as a farm step: the numbers, the decision, and where the assumptions live. */
export function verdictStep(p: SnapshotProtocol, age: number | null, bandLow: number): FarmStep {
  const net = planNetting(p, age, bandLow);
  return {
    text:
      `Netted verdict: ${net.verdict} — at the band low of ${fmtUsd(bandLow)} this plan pays for itself if the launch chance beats ${fmtPct(net.breakevenPct)} ` +
      `(the netting is stated whole under The model, open: ${(NETTING.community_pct * 100).toFixed(0)}% of value to the community at a launch, one wallet capturing ${(NETTING.capture_pct * 100).toFixed(1)}% of that pool, gas and upkeep at the plan's own figures)`,
    cost: `${fmtUsd(net.costUsd)} all-in`,
    time: `about ${net.hours.toFixed(1)} hours`,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, c: RadarConstants = CONSTANTS): BoardRow[] {
  void c;
  const fitSet = buildFitSet(snapshot);
  const { keptTerms } = validateModels(snapshot, fitSet.rows);
  const price = preparePricer(fitSet.rows, snapshot.as_of, keptTerms);
  const chosen = snapshot.protocols.filter(isLaunchCandidate);
  const bands = bootstrapBands(fitSet.rows, chosen, snapshot.as_of, keptTerms);
  const scored = chosen.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const band = bands.get(p.slug)!;
    const net = planNetting(p, age, band.bandLow);
    return { p, age, band, net, implied: Math.max(1, Math.round(price(p))) };
  });
  scored.sort((x, y) => y.implied - x.implied || (x.p.slug < y.p.slug ? -1 : x.p.slug > y.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    band_low_usd: s.band.bandLow,
    band_high_usd: s.band.bandHigh,
    rank_low: s.band.rankLow,
    rank_high: s.band.rankHigh,
    verdict: s.net.verdict,
    plan_cost_usd: s.net.costUsd,
    plan_hours: s.net.hours,
    breakeven_pct: s.net.breakevenPct,
    model: {
      effective_multiple: round4(s.implied / s.p.tvl_usd),
      growth_pct: round4(growthPctOf(s.p)),
      age_days: s.age,
    },
    farm_steps: [...farmSteps(s.p, s.age).map(stepText), stepText(verdictStep(s.p, s.age, s.band.bandLow))],
  }));
}

/** The live-token protocols, by market cap, for the dashboard's market view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, c: RadarConstants = CONSTANTS): { board: BoardRow[]; radar: RadarData } {
  const { comps, globalMultiple, livePeers } = categoryComps(snapshot, c);
  const fitSet = buildFitSet(snapshot);
  const { validation } = validateModels(snapshot, fitSet.rows);
  const fit = fitCurve(fitSet.rows);
  const board = buildBoard(snapshot, c);
  const watch = new Set(snapshot.watchlist);
  const live = liveRows(snapshot);
  const categories = [...comps.values()].sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const rows: RadarRow[] = board.map((r) => ({
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    listed_at: r.listed_at,
    age_days: r.age_days,
    implied_value_usd: r.implied_value_usd,
    band_low_usd: r.band_low_usd,
    band_high_usd: r.band_high_usd,
    rank_low: r.rank_low,
    rank_high: r.rank_high,
    verdict: r.verdict,
    plan_cost_usd: r.plan_cost_usd,
    plan_hours: r.plan_hours,
    breakeven_pct: r.breakeven_pct,
    tier: watch.has(r.slug) ? 'watchlist' : 'early',
    parts: {
      effective_multiple: r.model.effective_multiple,
      growth_pct: r.model.growth_pct,
    },
    farm_steps: r.farm_steps,
  }));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    constants: c,
    global_multiple: round4(globalMultiple),
    live_peers: livePeers,
    scanned_size: snapshot.protocols.length,
    pre_token_size: snapshot.protocols.filter(isPreToken).length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watch.has(r.slug)).length,
    live_size: live.length,
    fit: {
      intercept: round4(fit.a),
      slope: round4(fit.b),
      n: fitSet.rows.length,
      traded: fitSet.traded,
      dropped_cex: fitSet.droppedCex,
      dropped_family: fitSet.droppedFamily,
      mean_log_tvl: round4(fit.meanLogTvl),
      mean_log_mcap: round4(fit.meanLogMcap),
    },
    validation,
    netting: NETTING,
    bootstrap_refits: BOOTSTRAP_REFITS,
    categories,
    rows,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape this model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((x): x is string => typeof x === 'string') : [],
      tvl_usd: typeof p.tvl_usd === 'number' && Number.isFinite(p.tvl_usd) ? p.tvl_usd : null,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, spread, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
