# SimVibeReceipt Contract Specification

## Overview

The `SimVibeReceipt` contract provides immutable, tamper-evident publishing of simulation receipts on Monad. Each simulation run can publish a receipt containing cryptographic hashes of the run input and report, along with the traction score band.

**Target chain:** Monad (EVM-compatible)
**Solidity version:** ^0.8.24

---

## Receipt Schema

| Field | Type | Description |
|-------|------|-------------|
| `runId` | `bytes32` | `keccak256(runIdString)` — primary key, derived from off-chain run ID |
| `inputHash` | `bytes32` | `0x` + SHA-256 of canonical run input JSON (sorted keys) |
| `reportHash` | `bytes32` | `0x` + SHA-256 of canonical report JSON (sorted keys) |
| `scoreBand` | `uint8` | Traction band: 0=very_low, 1=low, 2=moderate, 3=high, 4=very_high |
| `timestamp` | `uint64` | `block.timestamp` at publish time (UNIX epoch seconds) |
| `publisher` | `address` | `msg.sender` at publish time |

### Score Band Mapping

| Value | Band | Description |
|-------|------|-------------|
| 0 | `very_low` | Minimal traction expected |
| 1 | `low` | Below-average traction |
| 2 | `moderate` | Average traction expected |
| 3 | `high` | Above-average traction |
| 4 | `very_high` | Strong traction expected |

### Hash Encoding

Off-chain SHA-256 hashes are 64 hex characters (256 bits). On-chain, these are stored as `bytes32`:
```
off-chain: "a1b2c3d4..." (64 hex chars, no 0x prefix)
on-chain:  0xa1b2c3d4...  (bytes32, with 0x prefix)
```

The `runId` on-chain is derived differently — it's `keccak256(abi.encodePacked(runIdString))` where `runIdString` is the nanoid-based run identifier from the app.

---

## Event: `ReceiptPublished`

```solidity
event ReceiptPublished(
    bytes32 indexed runId,
    bytes32 indexed inputHash,
    bytes32 reportHash,
    uint8   scoreBand,
    uint64  timestamp,
    address indexed publisher
);
```

**Indexed parameters** (for efficient log filtering):
- `runId` — look up receipt events by run
- `inputHash` — find receipts sharing same input (what-if variants)
- `publisher` — filter by publishing address

Emitted exactly once per `runId`. A duplicate publish reverts before reaching the event.

---

## Error Codes

| Error | Signature | When |
|-------|-----------|------|
| `DuplicateRunId(bytes32)` | `0x...` | Receipt for this runId already exists |
| `InvalidHash()` | `0x...` | `inputHash` or `reportHash` is `bytes32(0)` |
| `InvalidScoreBand(uint8)` | `0x...` | `scoreBand > 4` |

---

## Duplicate Publish Policy

**Policy: Revert on duplicate.**

- Each `runId` can have at most one receipt.
- Attempting to publish a second receipt for the same `runId` reverts with `DuplicateRunId(runId)`.
- **Idempotency is handled at the app/API layer:**
  1. API checks `hasReceipt(runId)` before calling `publishReceipt`.
  2. If receipt exists, API returns the existing receipt data (HTTP 200, not 409).
  3. This means the contract never needs to handle "upsert" — it only inserts.

---

## Contract Functions

### `publishReceipt(bytes32 runId, bytes32 inputHash, bytes32 reportHash, uint8 scoreBand)`

**Access:** Public (any address can publish).
**State changes:** Stores receipt, increments counter, emits event.
**Reverts:**
- `DuplicateRunId(runId)` if receipt exists
- `InvalidHash()` if inputHash or reportHash is zero
- `InvalidScoreBand(scoreBand)` if scoreBand > 4

### `getReceipt(bytes32 runId) → Receipt`

**Access:** Public view.
**Returns:** Full receipt struct. Returns zero struct if not found (check `publisher != address(0)` or use `hasReceipt`).

### `hasReceipt(bytes32 runId) → bool`

**Access:** Public view.
**Returns:** `true` if a receipt has been published for this runId.

### `receiptCount() → uint256`

**Access:** Public view.
**Returns:** Total number of receipts published.

---

## App/Backend Integration Points

### 1. Hash Computation (existing: `packages/engine/src/chain/hash.ts`)

```
runId (on-chain)   = keccak256(runIdString)
inputHash          = SHA-256 of deepSortKeys(runInput)   → bytes32
reportHash         = SHA-256 of deepSortKeys(report)     → bytes32
scoreBand          = TractionBand enum index (0..4)
```

**Mapping function needed:** `tractionBandToScoreBand(band: TractionBand): number`

| TractionBand | scoreBand |
|---|---|
| `very_low` | 0 |
| `low` | 1 |
| `moderate` | 2 |
| `high` | 3 |
| `very_high` | 4 |

### 2. Receipt Publishing (update: `packages/engine/src/chain/writer.ts`)

Current `writeToChain()` uses a generic `storeReceipt(bytes32, bytes32)` call.
Must be updated to call `publishReceipt(bytes32, bytes32, bytes32, uint8)` with the frozen ABI.

### 3. API Route (update: `apps/web/app/api/run/[id]/receipt/route.ts`)

**POST `/api/run/:id/receipt/publish`** (new, MND-005):
1. Load run, verify completed + has report.
2. Compute `runId = keccak256(run.id)`, `inputHash`, `reportHash`, `scoreBand`.
3. Check `hasReceipt(runId)` on-chain — if exists, return existing receipt.
4. Call `publishReceipt(...)` — store txHash on run record.
5. Return `{ txHash, chainId, contractAddress, receipt }`.

### 4. Storage (update: MND-004)

Add to run record:
- `receipt_tx_hash` — transaction hash of the on-chain publish
- `receipt_contract` — contract address used
- `receipt_chain_id` — chain ID (Monad)
- `receipt_published_at` — timestamp

### 5. Report UI (update: MND-006)

"Publish to Monad" button on report page:
- Disabled if run not completed or no report.
- Shows pending/success/failure states.
- On success: display txHash with Monad explorer deep-link.

### 6. Config (`.env`)

```env
# Monad Receipt Contract
RECEIPT_CONTRACT_ADDRESS=0x...   # Deployed SimVibeReceipt contract
RECEIPT_CHAIN_ID=10143           # Monad devnet chain ID
RECEIPT_RPC_URL=                 # Monad RPC endpoint
RECEIPT_PUBLISHER_KEY=           # Server-side publisher private key
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `contracts/spec/ISimVibeReceipt.sol` | Frozen Solidity interface |
| `contracts/spec/abi.json` | Frozen ABI (JSON) |
| `contracts/SPEC.md` | This document |
| `packages/engine/src/chain/hash.ts` | Hash computation (existing) |
| `packages/engine/src/chain/writer.ts` | Chain writer (to be updated in MND-005) |
| `packages/shared/src/schemas/chain-receipt.ts` | Receipt schema (to be extended in MND-004) |

---

## Spec Review Checklist

- [x] Receipt struct fields: runId, inputHash, reportHash, scoreBand, timestamp, publisher
- [x] Event: ReceiptPublished with 3 indexed params (runId, inputHash, publisher)
- [x] Error codes: DuplicateRunId, InvalidHash, InvalidScoreBand
- [x] Duplicate policy: revert (idempotency at API layer)
- [x] Score band mapping: 0..4 matches TractionBand enum
- [x] Hash encoding: SHA-256 → bytes32, runId via keccak256
- [x] ABI frozen in `contracts/spec/abi.json`
- [x] Integration points mapped (hash, writer, API, storage, UI, config)
