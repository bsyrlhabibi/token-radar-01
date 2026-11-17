// The Launch Radar model: one sealed DefiLlama snapshot in, one ranked board of
// pre-token protocols out.
//
// Where the house model multiplies every TVL by one flat constant, this model prices
// each protocol against the market's own evidence. The snapshot carries 129 protocols
// whose tokens already trade; grouped by category, their market-cap-to-TVL ratios say
// what a dollar of TVL is worth in each line of work. A category's median ratio,
// shrunk toward the global median by how many live peers back it, becomes the base
// multiple for its pre-token protocols. Momentum (7-day TVL change, weighted harder
// on the way down than on the way up) and maturity (age on DefiLlama plus chain
// reach) adjust the base. The product is an expected launch value: what this
// protocol's token would plausibly be worth on day one, in the market's own units.
//
// One rule selects the board, the same rule the watchlist was drawn with, applied to
// the whole snapshot instead of stopping at its floor: no token recorded, no version
// marker in the name, not a wrapped, staked or bridged product, not an exchange.
// The watchlist is covered in full; the board then keeps going down to the
// snapshot's own $5M edge, because the early rows are the point of a radar.

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

/** This model's constants, stated in the dashboard so a reader can re-run the sums. */
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

/** The model's version label: the dashboard names it and the board carries it. */
export const MODEL_VERSION = 'comps-1';

/** How many live-token protocols the dashboard's market view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's evidence: how many live peers, their median ratio, the multiple used. */
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
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
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
  tier: 'watchlist' | 'early';
  parts: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    age_multiplier: number;
    chain_multiplier: number;
  };
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
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
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
 * The market's own pricing, read out of the snapshot: for every category with
 * live-token peers, the median market-cap-to-TVL ratio, shrunk toward the global
 * median by the peer count, then clamped to a sane band. Ratios live in log
 * space — a category whose two peers trade at 30x TVL should lean toward the
 * market's 0.21x, not average with it — so the shrinkage blends logarithms and
 * thin categories hug the global median until their own evidence piles up.
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

/** The base multiple one protocol is priced with: its category's, or the market's. */
function baseMultiple(p: SnapshotProtocol, comps: Map<string, CategoryComp>, globalMultiple: number, c: RadarConstants): number {
  const comp = p.category === null ? undefined : comps.get(p.category);
  if (comp !== undefined) return comp.used_multiple;
  return round4(Math.min(c.multiple_max, Math.max(c.multiple_min, globalMultiple)));
}

/** The parts of one protocol's valuation, and the value they multiply to. */
export function valuation(p: SnapshotProtocol, asOf: string, comps: Map<string, CategoryComp>, globalMultiple: number, c: RadarConstants = CONSTANTS): {
  implied: number;
  multiple: number;
  growthPct: number;
  growthMult: number;
  ageMult: number;
  chainMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, p.listed_at);
  const rawGrowth = finite(p.change_7d, 0);
  const growthPct = Math.min(c.growth_clamp_pct, Math.max(-c.growth_clamp_pct, rawGrowth));
  const weight = growthPct >= 0 ? c.growth_up_weight : c.growth_down_weight;
  const growthMult = 1 + (growthPct / 100) * weight;
  const ageForModel = age ?? c.unknown_age_days;
  const ageMult = c.age_floor + (Math.min(Math.max(ageForModel, 0), c.age_cap_days) / c.age_cap_days) * c.age_range;
  const chainMult = 1 + c.chain_step * Math.min(Math.max(p.chains.length - 1, 0), c.chain_max_extra);
  const multiple = baseMultiple(p, comps, globalMultiple, c);
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growthMult * ageMult * chainMult));
  return { implied, multiple, growthPct, growthMult, ageMult, chainMult, age };
}

/** A name ending in a release marker is a later pool of another protocol, not a launch. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a product of some other asset, or an exchange itself. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Names that begin with an exchange's: the house's own exchange fronts. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is a launch candidate in its own right: pre-token, and not a
 * wrapped, staked or bridged product of something that already trades, not a
 * versioned pool, not an exchange front. The watchlist's own rule, whole.
 */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  const words = p.name.toLowerCase().split(/[^a-z]+/);
  if (words.includes('wrapped') || words.includes('staked') || words.includes('staking')) return false;
  if (EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) return false;
  return true;
}

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

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, c: RadarConstants = CONSTANTS): BoardRow[] {
  const { comps, globalMultiple } = categoryComps(snapshot, c);
  const watch = new Set(snapshot.watchlist);
  const chosen = snapshot.protocols.filter(isLaunchCandidate);
  const scored = chosen.map((p) => ({ p, v: valuation(p, snapshot.as_of, comps, globalMultiple, c) }));
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
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
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      base_multiple: round4(s.v.multiple),
      growth_pct: round4(s.v.growthPct),
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.ageMult * s.v.chainMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
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
  const board = buildBoard(snapshot, c);
  const watch = new Set(snapshot.watchlist);
  const live = liveRows(snapshot);
  const categories = [...comps.values()].sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const bySlug = new Map(board.map((r) => [r.slug, r]));
  const rows: RadarRow[] = board.map((r) => {
    const p = snapshot.protocols.find((x) => x.slug === r.slug)!;
    const v = valuation(p, snapshot.as_of, comps, globalMultiple, c);
    return {
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
      tier: watch.has(r.slug) ? 'watchlist' : 'early',
      parts: {
        base_multiple: round4(v.multiple),
        growth_pct: round4(v.growthPct),
        growth_multiplier: round4(v.growthMult),
        age_multiplier: round4(v.ageMult),
        chain_multiplier: round4(v.chainMult),
      },
    };
  });
  void bySlug;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    constants: c,
    global_multiple: round4(globalMultiple),
    live_peers: livePeers,
    scanned_size: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watch.has(r.slug)).length,
    live_size: live.length,
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
      tvl_usd: p.tvl_usd,
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
