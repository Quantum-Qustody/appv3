// ╔══════════════════════════════════════════════════════════════════╗
// ║   Sepolia (chainId 11155111) — wallet + tx helpers via ethers v6  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { useEffect, useState, useCallback } from "react";
import { BrowserProvider, JsonRpcProvider, formatEther, parseEther, Contract, isAddress } from "ethers";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_HEX = "0xaa36a7";
export const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
// Canonical Sepolia WETH (used for SWAP demo: ETH ↔ WETH)
export const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const WETH_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "function balanceOf(address) view returns (uint256)",
];

const SEPOLIA_PARAMS = {
  chainId: SEPOLIA_HEX,
  chainName: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
  rpcUrls: [SEPOLIA_RPC],
  blockExplorerUrls: [SEPOLIA_EXPLORER],
};

export const FAUCETS = [
  { name: "Google Cloud Faucet", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia", note: "0.05 ETH/day, no signup" },
  { name: "Alchemy Sepolia Faucet", url: "https://www.alchemy.com/faucets/ethereum-sepolia", note: "Requires Alchemy account" },
  { name: "QuickNode Faucet", url: "https://faucet.quicknode.com/ethereum/sepolia", note: "Free, multi-chain" },
  { name: "Infura Faucet", url: "https://www.infura.io/faucet/sepolia", note: "Requires Infura account" },
];

// Read-only provider for balances even without MetaMask
let readProvider = null;
export function getReadProvider() {
  if (!readProvider) readProvider = new JsonRpcProvider(SEPOLIA_RPC, SEPOLIA_CHAIN_ID);
  return readProvider;
}

export async function readBalance(address) {
  if (!isAddress(address)) return "0";
  try {
    const bal = await getReadProvider().getBalance(address);
    return formatEther(bal);
  } catch (e) {
    return "0";
  }
}

export async function readWethBalance(address) {
  if (!isAddress(address)) return "0";
  try {
    const c = new Contract(WETH_SEPOLIA, WETH_ABI, getReadProvider());
    const bal = await c.balanceOf(address);
    return formatEther(bal);
  } catch (e) {
    return "0";
  }
}

// React hook: connects MetaMask, switches to Sepolia, exposes signer/balance.
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState("0");
  const [wethBalance, setWethBalance] = useState("0");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const hasProvider = typeof window !== "undefined" && !!window.ethereum;

  const refreshBalance = useCallback(async (addr) => {
    const a = addr || address;
    if (!a) return;
    const [eth, weth] = await Promise.all([readBalance(a), readWethBalance(a)]);
    setBalance(eth);
    setWethBalance(weth);
  }, [address]);

  // Wire MetaMask events
  useEffect(() => {
    if (!hasProvider) return;
    const onAccounts = (accs) => { setAddress(accs?.[0] || null); };
    const onChain = (cid) => { setChainId(parseInt(cid, 16)); };
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    // Pull current state silently
    window.ethereum.request({ method: "eth_accounts" }).then(accs => { if (accs?.[0]) setAddress(accs[0]); }).catch(()=>{});
    window.ethereum.request({ method: "eth_chainId" }).then(cid => setChainId(parseInt(cid, 16))).catch(()=>{});
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [hasProvider]);

  // Refresh balances whenever address changes
  useEffect(() => { if (address) refreshBalance(address); }, [address, refreshBalance]);

  const ensureSepolia = async () => {
    if (!hasProvider) throw new Error("MetaMask not detected. Install MetaMask or another EIP-1193 wallet.");
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_HEX }] });
    } catch (e) {
      // 4902 = chain not added
      if (e?.code === 4902 || /Unrecognized chain/i.test(e?.message || "")) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [SEPOLIA_PARAMS] });
      } else if (e?.code !== 4001) {
        throw e;
      }
    }
  };

  const connect = async () => {
    setError(null);
    if (!hasProvider) { setError("MetaMask not detected. Install it from metamask.io."); return null; }
    setBusy(true);
    try {
      await ensureSepolia();
      const provider = new BrowserProvider(window.ethereum);
      const accs = await provider.send("eth_requestAccounts", []);
      const addr = accs[0];
      setAddress(addr);
      const cid = await provider.send("eth_chainId", []);
      setChainId(parseInt(cid, 16));
      await refreshBalance(addr);
      return addr;
    } catch (e) {
      setError(e?.message || "Connect failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => { setAddress(null); setBalance("0"); setWethBalance("0"); };

  // Send ETH on Sepolia
  const sendEth = async ({ to, amount }) => {
    if (!hasProvider) throw new Error("MetaMask not detected");
    if (!isAddress(to)) throw new Error("Invalid destination address");
    if (chainId !== SEPOLIA_CHAIN_ID) await ensureSepolia();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const tx = await signer.sendTransaction({ to, value: parseEther(String(amount)) });
    return tx;
  };

  // ETH ↔ WETH wrap/unwrap (real swap on Sepolia)
  const wrapEth = async (amount) => {
    if (!hasProvider) throw new Error("MetaMask not detected");
    if (chainId !== SEPOLIA_CHAIN_ID) await ensureSepolia();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const c = new Contract(WETH_SEPOLIA, WETH_ABI, signer);
    return await c.deposit({ value: parseEther(String(amount)) });
  };
  const unwrapWeth = async (amount) => {
    if (!hasProvider) throw new Error("MetaMask not detected");
    if (chainId !== SEPOLIA_CHAIN_ID) await ensureSepolia();
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const c = new Contract(WETH_SEPOLIA, WETH_ABI, signer);
    return await c.withdraw(parseEther(String(amount)));
  };

  return {
    address, chainId, balance, wethBalance, error, busy,
    isConnected: !!address,
    isSepolia: chainId === SEPOLIA_CHAIN_ID,
    hasProvider,
    connect, disconnect, ensureSepolia, refreshBalance,
    sendEth, wrapEth, unwrapWeth,
  };
}

export const explorerTx = (hash) => `${SEPOLIA_EXPLORER}/tx/${hash}`;
export const explorerAddr = (addr) => `${SEPOLIA_EXPLORER}/address/${addr}`;
export const shortAddr = (addr) => addr ? `${addr.slice(0,6)}…${addr.slice(-4)}` : "";
