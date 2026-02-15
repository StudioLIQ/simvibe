# simvi.be Hackathon Submission Checklist

## Required Submission Fields

| # | Field | Status | Value |
|---|-------|--------|-------|
| 1 | Project URL | [ ] | `https://simvi.be` (or staging URL) |
| 2 | Demo Video URL | [ ] | (record via Loom/YouTube) |
| 3 | Source Code | [ ] | GitHub repo URL |
| 4 | Receipt Contract Address | [ ] | `RECEIPT_CONTRACT_ADDRESS` from deploy |
| 5 | Receipt TX Hash | [ ] | From `pnpm e2e:monad` artifact |
| 6 | Gate Contract Address | [ ] | `GATE_CONTRACT_ADDRESS` from deploy |
| 7 | Token Contract Address | [ ] | From launch confirm flow |
| 8 | nad.fun Live Proof URL | [ ] | `https://nad.fun/token/<tokenAddress>` |
| 9 | Monad Explorer Link | [ ] | `<MONAD_EXPLORER_URL>/address/<contractAddress>` |

---

## Pre-Submission Execution Guide

Follow these steps in order. Each step has a verify command.

### Step 0: Environment Setup

```bash
# Verify .env has all required Monad vars
grep -E 'RECEIPT_|GATE_|NAD_' .env

# Required variables:
# RECEIPT_CONTRACT_ADDRESS=0x...    (SimVibeReceipt deployed address)
# RECEIPT_CHAIN_ID=10143            (Monad testnet)
# RECEIPT_RPC_URL=https://...       (Monad RPC)
# RECEIPT_PUBLISHER_KEY=0x...       (funded publisher wallet)
# GATE_CONTRACT_ADDRESS=0x...       (SimVibeGate deployed address)
# NAD_TOKEN_FACTORY_ADDRESS=0x...   (nad.fun factory)
# NAD_CHAIN_ID=10143
# NAD_RPC_URL=https://...
```

### Step 1: Deploy Contracts (if not already deployed)

```bash
cd contracts

# Deploy SimVibeReceipt
forge script script/Deploy.s.sol:DeploySimVibeReceipt \
  --rpc-url $RECEIPT_RPC_URL \
  --private-key $RECEIPT_PUBLISHER_KEY \
  --broadcast

# Record the deployed address -> RECEIPT_CONTRACT_ADDRESS
# Record the deploy tx hash for submission

# Deploy SimVibeGate (same pattern)
# Record the deployed address -> GATE_CONTRACT_ADDRESS
```

**Verify:**
```bash
# Check contract is callable
cast call $RECEIPT_CONTRACT_ADDRESS "hasReceipt(bytes32)" 0x0000000000000000000000000000000000000000000000000000000000000000 --rpc-url $RECEIPT_RPC_URL
```

### Step 2: Verify Local Stack

```bash
# Typecheck
pnpm typecheck

# Persona validation
pnpm ci:personas

# Demo output validity
pnpm test:demo
```

### Step 3: Run E2E Monad Flow (Demo Mode)

```bash
# Against running dev server
pnpm e2e:monad

# OR standalone CI mode
pnpm ci:e2e:monad

# Check artifacts
cat artifacts_runs/e2e-monad-flow.json | jq '.success, .runId, .tokenContractAddress'
cat artifacts_runs/e2e-monad-flow.md
```

### Step 4: Run E2E Monad Flow (Live Monad Testnet)

```bash
# Start server with real Monad config
pnpm dev:api

# In another terminal
API_BASE_URL=http://localhost:5555 pnpm e2e:monad

# Verify on-chain receipt
cat artifacts_runs/e2e-monad-flow.json | jq '.receiptTxHash, .receiptContractAddress'
```

### Step 5: Verify On-chain State

```bash
# Check receipt exists on-chain
RUN_ID_HASH=$(cast keccak "$(cat artifacts_runs/e2e-monad-flow.json | jq -r '.runId')")
cast call $RECEIPT_CONTRACT_ADDRESS "getReceiptByRunId(bytes32)(bytes32,bytes32,bytes32,uint8,uint64,address)" $RUN_ID_HASH --rpc-url $RECEIPT_RPC_URL

# Verify gate attestation (if configured)
cast call $GATE_CONTRACT_ADDRESS "isLaunchReady(bytes32)" $RUN_ID_HASH --rpc-url $RECEIPT_RPC_URL
```

### Step 6: Record Demo Video

Record a ~2 minute walkthrough covering:
1. **Create simulation** — input product details, select mode
2. **Watch simulation** — agents scan, debate, act in real-time
3. **Review report** — scores, friction map, one-line fixes
4. **Publish receipt** — click "Publish to Monad", show tx hash
5. **Launch on nad.fun** — review readiness gate, execute launch
6. **Verify live** — show token on nad.fun, receipt on explorer

### Step 7: Collect Submission Artifacts

```bash
# All in one place
echo "=== Submission Package ==="
echo "Report URL: $(cat artifacts_runs/e2e-monad-flow.json | jq -r '.reportUrl')"
echo "Receipt TX: $(cat artifacts_runs/e2e-monad-flow.json | jq -r '.receiptTxHash')"
echo "Receipt Contract: $(cat artifacts_runs/e2e-monad-flow.json | jq -r '.receiptContractAddress')"
echo "Token Contract: $(cat artifacts_runs/e2e-monad-flow.json | jq -r '.tokenContractAddress')"
echo "nad.fun URL: $(cat artifacts_runs/e2e-monad-flow.json | jq -r '.nadFunUrl')"
```

---

## Operational Guardrails

### Retry Policy

| Component | Retry Behavior |
|-----------|---------------|
| Simulation (LLM calls) | 3 retries per agent with fix-your-json prompt; fallback output on exhaustion |
| Receipt publish | Idempotent: `hasReceipt()` checked before publish; DuplicateRunId reverts cleanly |
| Gate attestation | One attestation per runId; duplicate reverts with `DuplicateAttestation` |
| Launch execute | Idempotent key per run; 409 Conflict on re-execution of success/submitted |
| Launch confirm | Status transitions: draft -> confirmed -> submitted -> success/failed |

### Duplicate Prevention

- **Receipt:** Contract-level `hasReceipt(runIdBytes32)` check before `publishReceipt()`. Duplicate returns `DuplicateRunId` error, not a crash.
- **Launch:** `idempotencyKey` generated per run. Execute endpoint returns 409 if launch already submitted/succeeded.
- **Gate attestation:** One per `(runId, attester)` pair. Contract reverts on duplicate.

### Rollback Notes

| Scenario | Recovery |
|----------|----------|
| Receipt publish fails mid-tx | Re-run `POST /api/run/:id/receipt/publish`; idempotent by design |
| Launch confirm fails | Re-send confirm with same txHash/status; state machine handles re-entry |
| Gate attestation fails | Re-attest via attester wallet; contract stores latest attestation |
| Full re-run needed | Create new run (new runId); old run/receipt remain immutable on-chain |
| Contract needs upgrade | Deploy new contract; update env vars; old receipts remain on old contract |

### Emergency Fallbacks

- **No Monad RPC:** Script falls back to offline receipt (SHA-256 hashes stored in DB, no on-chain publish)
- **No LLM API key:** `DEMO_MODE=true` uses cached/deterministic outputs (no external API calls)
- **No database:** `DATABASE_URL=memory://` runs fully in-memory (no persistence after restart)
- **Gate not configured:** Launch proceeds with off-chain readiness gate only

---

## Quick Reference: Key Commands

```bash
# Validate everything
pnpm typecheck && pnpm ci:personas && pnpm test:demo

# E2E flows
pnpm ci:e2e:monad          # Demo mode, no external deps
pnpm e2e:monad             # Against running server (with real Monad)
pnpm ci:smoke:launch       # Launch pipeline smoke
pnpm ci:e2e:ph:nad         # PH batch E2E

# Contracts
cd contracts && forge test -vv           # Run contract tests
forge script script/Deploy.s.sol:...     # Deploy (see Step 1)

# Readiness gate tests
pnpm test:readiness        # 28 fixture tests for gate logic
```
