// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISimVibeGate
 * @notice Interface for on-chain launch-readiness verification on Monad.
 *
 * The Gate contract verifies that a simulation run has passed the readiness
 * policy before allowing a launch. It works with signed policy attestations
 * from the backend publisher.
 *
 * Flow:
 *   1. Backend evaluates readiness (off-chain) using ReadinessPolicyConfig.
 *   2. Backend signs an attestation: (runId, policyHash, status, timestamp).
 *   3. FE/API calls `attestReady(...)` to record the attestation on-chain.
 *   4. Launch contracts check `isLaunchReady(runId)` as a pre-condition.
 *
 * Policy hash format:
 *   policyHash = keccak256(abi.encode(
 *     minOverallScore,         // uint16  (0-100, scaled x100 for precision → 0-10000)
 *     maxUncertaintyScore,     // uint16  (0-10000, representing 0.0000-1.0000)
 *     maxDisagreementScore,    // uint16  (0-10000)
 *     maxFallbackCount,        // uint8   (0-255)
 *     minClarityScore,         // uint16  (0-10000)
 *     minCredibilityScore,     // uint16  (0-10000)
 *     maxBounceRate,           // uint16  (0-10000)
 *     policyVersion            // uint16  (monotonically increasing)
 *   ))
 *
 * Policy versioning:
 *   - policyVersion starts at 1 and increments with each policy change.
 *   - Attestations reference a specific policyHash, so historical attestations
 *     remain valid even after policy updates.
 *   - The contract owner can register accepted policy hashes.
 */
interface ISimVibeGate {
    // ---------------------------------------------------------------
    // Structs
    // ---------------------------------------------------------------

    struct Attestation {
        bytes32 runId;           // keccak256 of off-chain run ID string
        bytes32 policyHash;      // keccak256 of encoded policy parameters
        bool    ready;           // true = passed gate, false = failed
        uint64  timestamp;       // block.timestamp when attested
        address attester;        // msg.sender (trusted publisher)
    }

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    /**
     * @notice Emitted when a readiness attestation is recorded.
     * @param runId       Indexed — keccak256 of off-chain run ID.
     * @param policyHash  Indexed — policy configuration hash.
     * @param ready       Whether the run passed the gate.
     * @param timestamp   Block timestamp.
     * @param attester    Indexed — address that submitted the attestation.
     */
    event ReadinessAttested(
        bytes32 indexed runId,
        bytes32 indexed policyHash,
        bool    ready,
        uint64  timestamp,
        address indexed attester
    );

    /**
     * @notice Emitted when a policy hash is registered or revoked.
     * @param policyHash  The policy hash.
     * @param accepted    True if registered, false if revoked.
     */
    event PolicyUpdated(
        bytes32 indexed policyHash,
        bool    accepted
    );

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    /// @notice Thrown when caller is not an authorized attester.
    error UnauthorizedAttester(address caller);

    /// @notice Thrown when the policy hash is not registered as accepted.
    error InvalidPolicyHash(bytes32 policyHash);

    /// @notice Thrown when an attestation for this runId already exists.
    error DuplicateAttestation(bytes32 runId);

    /// @notice Thrown when caller is not the owner.
    error NotOwner(address caller);

    // ---------------------------------------------------------------
    // Owner functions
    // ---------------------------------------------------------------

    /**
     * @notice Register a policy hash as accepted.
     * @param policyHash keccak256 of encoded policy parameters.
     */
    function registerPolicy(bytes32 policyHash) external;

    /**
     * @notice Revoke a previously registered policy hash.
     * @param policyHash keccak256 of encoded policy parameters.
     */
    function revokePolicy(bytes32 policyHash) external;

    /**
     * @notice Grant attester role to an address.
     * @param attester Address to authorize.
     */
    function addAttester(address attester) external;

    /**
     * @notice Revoke attester role from an address.
     * @param attester Address to revoke.
     */
    function removeAttester(address attester) external;

    // ---------------------------------------------------------------
    // Attester functions
    // ---------------------------------------------------------------

    /**
     * @notice Record a readiness attestation for a run.
     * @dev Only authorized attesters can call this.
     *      policyHash must be registered.
     *      Reverts on duplicate runId.
     * @param runId       keccak256 of the off-chain run ID string.
     * @param policyHash  keccak256 of the policy configuration used.
     * @param ready       Whether the run passed the readiness gate.
     */
    function attestReady(
        bytes32 runId,
        bytes32 policyHash,
        bool    ready
    ) external;

    // ---------------------------------------------------------------
    // Read functions
    // ---------------------------------------------------------------

    /**
     * @notice Check if a run has passed the readiness gate.
     * @param runId keccak256 of the off-chain run ID string.
     * @return ready True if an attestation exists with ready=true.
     */
    function isLaunchReady(bytes32 runId) external view returns (bool ready);

    /**
     * @notice Get the full attestation for a run.
     * @param runId keccak256 of the off-chain run ID string.
     * @return attestation The attestation struct (zero if not found).
     */
    function getAttestation(bytes32 runId) external view returns (Attestation memory attestation);

    /**
     * @notice Check if a policy hash is currently accepted.
     * @param policyHash The policy hash to check.
     * @return accepted True if the policy hash is registered.
     */
    function isPolicyAccepted(bytes32 policyHash) external view returns (bool accepted);

    /**
     * @notice Check if an address is an authorized attester.
     * @param attester The address to check.
     * @return authorized True if the address can submit attestations.
     */
    function isAttester(address attester) external view returns (bool authorized);
}
