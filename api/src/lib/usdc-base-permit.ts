/**
 * Base チェーン USDC — ERC-2612 permit + transferFrom 実行
 *
 * v2 非カストディフロー:
 *   1. ユーザーが /start/v2 で署名した permit (v, r, s) を受け取る
 *   2. MARKETPLACE_SPENDER のウォレット（BASE_SPENDER_PRIVATE_KEY）で
 *      USDC.permit(owner, spender, value, deadline, v, r, s) を実行
 *   3. 同ウォレットで USDC.transferFrom(owner, provider, amount) を実行
 *
 * 環境変数:
 *   BASE_RPC_URL            — Base Mainnet RPC（デフォルト: 公式 RPC）
 *   BASE_SPENDER_PRIVATE_KEY — Marketplace Spender の秘密鍵 (0x...)
 *
 * USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

// ─── Base Mainnet USDC（Circle 公式） ────────────────────────
export const BASE_USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const satisfies Address;

// ─── ERC-20 + ERC-2612 最小 ABI ──────────────────────────────
const USDC_ABI = [
  {
    name: "permit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner",    type: "address" },
      { name: "spender",  type: "address" },
      { name: "value",    type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v",        type: "uint8"   },
      { name: "r",        type: "bytes32" },
      { name: "s",        type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from",  type: "address" },
      { name: "to",    type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs:  [{ name: "account", type: "address" }],
    outputs: [{ name: "",        type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── 設定ヘルパー ──────────────────────────────────────────────
function getSpenderAccount() {
  const raw = process.env.BASE_SPENDER_PRIVATE_KEY;
  if (!raw) throw new Error("BASE_SPENDER_PRIVATE_KEY is not set");
  const key = (raw.startsWith("0x") ? raw : "0x" + raw) as Hex;
  return privateKeyToAccount(key);
}

function getRpcUrl(): string {
  return process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
}

// ─── Permit 実行パラメータ ────────────────────────────────────

export interface PermitParams {
  owner:    Address;
  spender:  Address;
  value:    bigint;   // USDC units (6 decimals)
  deadline: bigint;
  v:        number;
  r:        Hex;
  s:        Hex;
}

export interface ExecutePermitTransferParams {
  permit:          PermitParams;
  toAddress:       Address;   // provider の受取ウォレット
  amountRaw:       bigint;    // 送金額 USDC units（permit.value 以下）
}

export interface PermitTransferResult {
  permitTxHash:   Hex;
  transferTxHash: Hex;
}

/**
 * permit() → transferFrom() を順に実行する。
 * 両 tx が確定するまで await する（Base は ~2 秒/ブロック）。
 */
export async function executePermitTransfer(
  params: ExecutePermitTransferParams,
): Promise<PermitTransferResult> {
  const account = getSpenderAccount();
  const rpcUrl  = getRpcUrl();

  const walletClient = createWalletClient({
    account,
    chain:     base,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain:     base,
    transport: http(rpcUrl),
  });

  const { permit, toAddress, amountRaw } = params;

  // ── Step 1: permit() ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permitTxHash = await (walletClient.writeContract as any)({
    address:      BASE_USDC_ADDRESS,
    abi:          USDC_ABI,
    functionName: "permit",
    args: [
      permit.owner,
      permit.spender,
      permit.value,
      permit.deadline,
      permit.v,
      permit.r,
      permit.s,
    ],
  }) as Hex;

  await publicClient.waitForTransactionReceipt({ hash: permitTxHash });

  // ── Step 2: transferFrom() ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transferTxHash = await (walletClient.writeContract as any)({
    address:      BASE_USDC_ADDRESS,
    abi:          USDC_ABI,
    functionName: "transferFrom",
    args: [
      permit.owner,
      getAddress(toAddress),
      amountRaw,
    ],
  }) as Hex;

  await publicClient.waitForTransactionReceipt({ hash: transferTxHash });

  return { permitTxHash, transferTxHash };
}

/**
 * オーナーアドレスの Base USDC 残高を取得（単位: USDC units, 6 decimals）
 */
export async function getBaseUsdcBalance(ownerAddress: Address): Promise<bigint> {
  const publicClient = createPublicClient({
    chain:     base,
    transport: http(getRpcUrl()),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (publicClient.readContract as any)({
    address:      BASE_USDC_ADDRESS,
    abi:          USDC_ABI,
    functionName: "balanceOf",
    args:         [ownerAddress],
  }) as bigint;
}
