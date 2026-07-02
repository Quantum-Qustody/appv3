// ╔═══════════════════════════════════════════════════════════════════╗
// ║   Sepolia wallet integration — EIP-1193 + EIP-6963                ║
// ║   Phase 2 rebuild — feedback items 3, 5, 6, 7                     ║
// ╚═══════════════════════════════════════════════════════════════════╝
import { useEffect, useState, useCallback, useRef } from "react";
import { BrowserProvider, JsonRpcProvider, formatEther, formatUnits, parseEther, Contract, isAddress } from "ethers";
import { createCoinbaseWalletSDK } from "@coinbase/wallet-sdk";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_HEX = "0xaa36a7";
export const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
export const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

// Circle's official testnet stablecoins on Ethereum Sepolia (item 4).
// Verified against developers.circle.com contract-address tables.
export const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
export const EURC_SEPOLIA = "0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4";

// Circle's public, permissionless faucet — claim testnet USDC + EURC on Sepolia (item 3).
export const CIRCLE_FAUCET = "https://faucet.circle.com/";

// Indicative USD reference prices used only to value *testnet* holdings on the
// Evaluation Overview (item 4). Testnet assets have no real value — this is a
// legible sandbox valuation, clearly labelled as indicative in the UI.
export const INDICATIVE_PRICES = { ETH: 3000, WETH: 3000, USDC: 1, EURC: 1.08 };

const WETH_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function balanceOf(address) view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const SEPOLIA_PARAMS = {
  chainId: SEPOLIA_HEX,
  chainName: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
  rpcUrls: [SEPOLIA_RPC],
  blockExplorerUrls: [SEPOLIA_EXPLORER],
};

export const FAUCETS = [
  { name: "Circle Faucet · USDC + EURC", url: CIRCLE_FAUCET, note: "Testnet USDC & EURC on Sepolia — no signup" },
  { name: "Google Cloud Faucet", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia", note: "0.05 ETH/day, no signup" },
  { name: "Alchemy Sepolia Faucet", url: "https://www.alchemy.com/faucets/ethereum-sepolia", note: "Requires Alchemy account" },
  { name: "QuickNode Faucet", url: "https://faucet.quicknode.com/ethereum/sepolia", note: "Free, multi-chain" },
];

// ─── Read-only provider for balance lookups even without a wallet ──
let readProvider = null;
export function getReadProvider() {
  if (!readProvider) readProvider = new JsonRpcProvider(SEPOLIA_RPC, SEPOLIA_CHAIN_ID);
  return readProvider;
}

export async function readBalance(address) {
  if (!isAddress(address)) return "0";
  try { return formatEther(await getReadProvider().getBalance(address)); }
  catch { return "0"; }
}

export async function readWethBalance(address) {
  if (!isAddress(address)) return "0";
  try {
    const c = new Contract(WETH_SEPOLIA, WETH_ABI, getReadProvider());
    return formatEther(await c.balanceOf(address));
  } catch { return "0"; }
}

// Read an arbitrary ERC-20 balance on Sepolia (item 4 — testnet USDC / EURC).
export async function readErc20Balance(token, address) {
  if (!isAddress(address) || !isAddress(token)) return "0";
  try {
    const c = new Contract(token, ERC20_ABI, getReadProvider());
    const [raw, dec] = await Promise.all([c.balanceOf(address), c.decimals().catch(() => 6)]);
    return formatUnits(raw, Number(dec));
  } catch { return "0"; }
}

// Read the connected wallet's testnet stablecoin balances in one shot (item 4).
export async function readSepoliaTokens(address) {
  const [usdc, eurc] = await Promise.all([
    readErc20Balance(USDC_SEPOLIA, address),
    readErc20Balance(EURC_SEPOLIA, address),
  ]);
  return { usdc, eurc };
}

// ─── EIP-6963: multi-wallet discovery ──────────────────────────────
// Modules-level cache shared across all useWallet() consumers
const discovered = new Map();        // uuid → ProviderDetail
const discoveryListeners = new Set();

function announceHandler(event) {
  const detail = event.detail;
  if (!detail?.info?.uuid || !detail?.provider) return;
  // Allow late re-announcements to update icon/name without losing the provider
  discovered.set(detail.info.uuid, detail);
  discoveryListeners.forEach(fn => fn(Array.from(discovered.values())));
}

let discoveryStarted = false;
function startDiscovery() {
  if (discoveryStarted || typeof window === "undefined") return;
  discoveryStarted = true;
  window.addEventListener("eip6963:announceProvider", announceHandler);
  // Ask any wallet that loaded after us to announce itself
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function subscribeDiscovery(cb) {
  startDiscovery();
  discoveryListeners.add(cb);
  cb(Array.from(discovered.values()));
  // Re-poke discovery in case a wallet injects after first paint (item 5)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }
  return () => discoveryListeners.delete(cb);
}

// Fallback for wallets that don't speak EIP-6963 — wrap window.ethereum
function legacyDetail() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return {
    info: {
      uuid: "legacy-window-ethereum",
      name: window.ethereum.isMetaMask ? "MetaMask" :
            window.ethereum.isCoinbaseWallet ? "Coinbase Wallet" :
            window.ethereum.isRabby ? "Rabby" :
            window.ethereum.isBraveWallet ? "Brave Wallet" :
            "Browser Wallet",
      icon: null,
      rdns: "legacy",
    },
    provider: window.ethereum,
  };
}

// Item 5 — Coinbase Wallet as a first-class connector via the official SDK.
// Works with or without the browser extension (falls back to mobile / smart
// wallet via popup), so a Coinbase user can always connect. The provider is
// created lazily and cached at module scope.
const COINBASE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%230052FF'/%3E%3Cpath fill='%23fff' d='M16 6.3a9.7 9.7 0 1 0 9.7 9.7A9.7 9.7 0 0 0 16 6.3Zm-2.6 7.3c0-.6.5-1.1 1.1-1.1h3c.6 0 1.1.5 1.1 1.1v2.8c0 .6-.5 1.1-1.1 1.1h-3c-.6 0-1.1-.5-1.1-1.1Z'/%3E%3C/svg%3E";
let coinbaseProvider = null;
function getCoinbaseDetail() {
  if (typeof window === "undefined") return null;
  try {
    if (!coinbaseProvider) {
      const sdk = createCoinbaseWalletSDK({
        appName: "Quantum Qustody",
        appLogoUrl: window.location.origin + "/qq-logo.svg",
        appChainIds: [SEPOLIA_CHAIN_ID],
      });
      coinbaseProvider = sdk.getProvider();
    }
    return {
      info: { uuid: "coinbase-wallet-sdk", name: "Coinbase Wallet", icon: COINBASE_ICON, rdns: "com.coinbase.wallet" },
      provider: coinbaseProvider,
    };
  } catch { return null; }
}

// ─── Connect a single EIP-1193 provider with timeout ───────────────
function withTimeout(promise, ms, label = "operation") {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// ─── Hook ──────────────────────────────────────────────────────────
export function useWallet() {
  const [providers, setProviders] = useState([]);            // ProviderDetail[]
  const [active, setActive] = useState(null);                // ProviderDetail | null
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState("0");
  const [wethBalance, setWethBalance] = useState("0");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const listenersAttached = useRef(null);  // remembers which provider has listeners

  // Discover providers — and re-announce on every mount so incognito / late
  // injection (item 5) recovers instead of dead-ending.
  useEffect(() => {
    const stop = subscribeDiscovery((list) => {
      // Always merge in the legacy window.ethereum so users without EIP-6963
      // wallets (older builds) still appear in the picker.
      const merged = [...list];
      const leg = legacyDetail();
      if (leg && !merged.find(p => p.provider === leg.provider)) merged.push(leg);
      // Item 5 — always expose a Coinbase Wallet connector via the official SDK,
      // unless an injected Coinbase provider was already discovered (dedupe).
      const hasCoinbase = merged.some(p => p.info?.rdns === "com.coinbase.wallet" || p.provider?.isCoinbaseWallet);
      if (!hasCoinbase) { const cb = getCoinbaseDetail(); if (cb) merged.push(cb); }
      setProviders(merged);
    });
    // One extra poll after 1.5s catches very-late injectors
    const t = setTimeout(() => {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("eip6963:requestProvider"));
    }, 1500);
    return () => { stop(); clearTimeout(t); };
  }, []);

  // Bind to whatever provider becomes active — and re-sync state from it.
  // Fixes "0 wallets 0 chains" (item 7) and account/chain changes (item 6).
  useEffect(() => {
    if (!active?.provider) return;

    // Detach previous listeners
    if (listenersAttached.current && listenersAttached.current !== active.provider) {
      const p = listenersAttached.current;
      ["accountsChanged", "chainChanged", "disconnect"].forEach(ev => {
        try { p.removeListener?.(ev, ()=>{}); } catch {}
      });
    }
    listenersAttached.current = active.provider;

    const onAccounts = (accs) => {
      const next = accs?.[0] || null;
      setAddress(next);
      if (!next) { setBalance("0"); setWethBalance("0"); }
      setError(null);
    };
    const onChain = (cid) => {
      try { setChainId(parseInt(cid, 16)); } catch { setChainId(null); }
      setError(null);
    };
    const onDisconnect = () => { setAddress(null); setChainId(null); setBalance("0"); setWethBalance("0"); };

    active.provider.on?.("accountsChanged", onAccounts);
    active.provider.on?.("chainChanged", onChain);
    active.provider.on?.("disconnect", onDisconnect);

    // Pull current state once
    Promise.all([
      active.provider.request({ method: "eth_accounts" }).catch(() => []),
      active.provider.request({ method: "eth_chainId" }).catch(() => null),
    ]).then(([accs, cid]) => {
      if (accs?.[0]) setAddress(accs[0]);
      if (cid) setChainId(parseInt(cid, 16));
    });

    return () => {
      try { active.provider.removeListener?.("accountsChanged", onAccounts); } catch {}
      try { active.provider.removeListener?.("chainChanged", onChain); } catch {}
      try { active.provider.removeListener?.("disconnect", onDisconnect); } catch {}
    };
  }, [active?.info?.uuid]);

  // Refresh balances whenever the bound address changes
  const refreshBalance = useCallback(async (addr) => {
    const a = addr || address;
    if (!a) return;
    const [eth, weth] = await Promise.all([readBalance(a), readWethBalance(a)]);
    setBalance(eth);
    setWethBalance(weth);
  }, [address]);

  useEffect(() => { if (address) refreshBalance(address); }, [address, refreshBalance]);

  // Switch chain — with explicit add fallback
  const ensureSepolia = async () => {
    if (!active?.provider) throw new Error("No wallet selected. Pick one above first.");
    try {
      await active.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_HEX }] });
    } catch (e) {
      if (e?.code === 4902 || /Unrecognized chain|not been added/i.test(e?.message || "")) {
        await active.provider.request({ method: "wallet_addEthereumChain", params: [SEPOLIA_PARAMS] });
      } else if (e?.code !== 4001) {
        throw e;
      }
    }
  };

  // Item 1 — auto-switch to Sepolia via the wallet's own prompt. Whenever the
  // connected wallet reports a chain other than Sepolia, immediately fire the
  // native switch prompt (with add-chain fallback). The tester just accepts the
  // popup and lands on Sepolia — no manual chain-picker step. Guarded so a
  // rejected prompt doesn't loop: we only re-prompt when the chain changes.
  const autoSwitchGuard = useRef(0);
  useEffect(() => {
    if (!active?.provider || !address || chainId == null) return;
    if (chainId === SEPOLIA_CHAIN_ID) { autoSwitchGuard.current = 0; return; }
    if (autoSwitchGuard.current === chainId) return; // already prompted for this chain
    autoSwitchGuard.current = chainId;
    ensureSepolia().catch((e) => {
      if (e?.code !== 4001) console.warn("auto-switch to Sepolia:", e?.message || e);
    });
  }, [active?.info?.uuid, address, chainId]);

  // Connect to a chosen provider (or the only one available). 30s timeout (item 3).
  const connect = useCallback(async (chosen) => {
    setError(null);
    const target = chosen || active || providers[0] || legacyDetail();
    if (!target?.provider) {
      setError("No wallet detected. Install MetaMask, Coinbase Wallet, Rabby, or Brave then refresh.");
      return null;
    }
    setActive(target);
    setBusy(true);
    try {
      // Request accounts with a hard timeout so a stuck provider can't hang forever (item 3)
      const accs = await withTimeout(
        target.provider.request({ method: "eth_requestAccounts" }),
        30000, "Wallet connect",
      );
      const addr = accs?.[0];
      if (!addr) throw new Error("No account returned by wallet");
      setAddress(addr);
      // Read the current chain. If it isn't Sepolia, the auto-switch effect
      // (item 1) fires the wallet's native switch prompt automatically.
      const cid = await target.provider.request({ method: "eth_chainId" }).catch(() => null);
      if (cid) setChainId(parseInt(cid, 16));
      await refreshBalance(addr);
      return addr;
    } catch (e) {
      // 4001 = user rejected — soft error
      const msg = e?.code === 4001 ? "Wallet connect cancelled. Try again." : (e?.shortMessage || e?.message || "Connect failed");
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, [active, providers, refreshBalance]);

  // Force a fresh permission prompt (item 6 — account changed but app shows old state)
  const reconnect = useCallback(async () => {
    setError(null);
    const target = active || providers[0] || legacyDetail();
    if (!target?.provider) return null;
    setBusy(true);
    try {
      try {
        await target.provider.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (_) { /* not all wallets support; fall through to eth_requestAccounts */ }
      return await connect(target);
    } finally {
      setBusy(false);
    }
  }, [active, providers, connect]);

  const disconnect = () => {
    setActive(null);
    setAddress(null);
    setChainId(null);
    setBalance("0");
    setWethBalance("0");
    setError(null);
  };

  // Send ETH on Sepolia
  const sendEth = async ({ to, amount }) => {
    if (!active?.provider) throw new Error("No wallet connected");
    if (!isAddress(to)) throw new Error("Invalid destination address");
    if (chainId !== SEPOLIA_CHAIN_ID) await ensureSepolia();
    const provider = new BrowserProvider(active.provider);
    const signer = await provider.getSigner();
    return await signer.sendTransaction({ to, value: parseEther(String(amount)) });
  };

  const wrapEth = async (amount) => {
    if (!active?.provider) throw new Error("No wallet connected");
    if (chainId !== SEPOLIA_CHAIN_ID) await ensureSepolia();
    const provider = new BrowserProvider(active.provider);
    const signer = await provider.getSigner();
    const c = new Contract(WETH_SEPOLIA, WETH_ABI, signer);
    return await c.deposit({ value: parseEther(String(amount)) });
  };

  const unwrapWeth = async (amount) => {
    if (!active?.provider) throw new Error("No wallet connected");
    if (chainId !== SEPOLIA_CHAIN_ID) await ensureSepolia();
    const provider = new BrowserProvider(active.provider);
    const signer = await provider.getSigner();
    const c = new Contract(WETH_SEPOLIA, WETH_ABI, signer);
    return await c.withdraw(parseEther(String(amount)));
  };

  // Item 7: counters are derived from real provider state, not the
  // (sometimes stale) wallets table in Supabase.
  const walletCount = address ? 1 : 0;
  const chainCount  = chainId ? 1 : 0;

  return {
    // discovery
    providers,
    active,
    setActive,
    // connection state — bound to live provider state (item 7)
    address, chainId, balance, wethBalance,
    isConnected: !!address,
    isSepolia: chainId === SEPOLIA_CHAIN_ID,
    walletCount, chainCount,
    hasProvider: providers.length > 0 || !!legacyDetail(),
    error, busy,
    // actions
    connect, reconnect, disconnect, ensureSepolia, refreshBalance,
    sendEth, wrapEth, unwrapWeth,
  };
}

export const explorerTx = (hash) => `${SEPOLIA_EXPLORER}/tx/${hash}`;
export const explorerAddr = (addr) => `${SEPOLIA_EXPLORER}/address/${addr}`;
export const shortAddr = (addr) => addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : "";

// ─── Wallet-scoped on-chain TX history (spec item 2) ───────────────
// Reads the connected wallet's full transaction list from the Sepolia
// chain via Blockscout's free public API (no key required). This is the
// wallet-scoped stream, distinct from the account-scoped platform log.
const BLOCKSCOUT_SEPOLIA = "https://eth-sepolia.blockscout.com/api";
export async function fetchWalletTxHistory(address, max = 50) {
  if (!isAddress(address)) return [];
  try {
    const url = `${BLOCKSCOUT_SEPOLIA}?module=account&action=txlist&address=${address}&sort=desc&page=1&offset=${max}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.status !== "1" || !Array.isArray(json.result)) return [];
    return json.result.map(t => ({
      hash: t.hash,
      timestamp: t.timeStamp ? new Date(Number(t.timeStamp) * 1000).toISOString() : "",
      from: t.from,
      to: t.to,
      direction: t.from?.toLowerCase() === address.toLowerCase() ? "out" : "in",
      value_eth: t.value ? formatEther(t.value) : "0",
      method: t.functionName ? t.functionName.split("(")[0] : (t.input && t.input !== "0x" ? "contract" : "transfer"),
      status: t.txreceipt_status === "1" ? "success" : t.isError === "1" ? "failed" : "pending",
      block: t.blockNumber,
    }));
  } catch (e) {
    return [];
  }
}
