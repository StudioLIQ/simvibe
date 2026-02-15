// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISimVibeReceipt
 * @notice Interface for immutable simulation receipt publishing on Monad.
 *
 * Each simulation run produces a deterministic receipt containing:
 *   - runId:      keccak256 of the off-chain run identifier string
 *   - inputHash:  SHA-256 hash of canonical run input JSON (sorted keys)
 *   - reportHash: SHA-256 hash of canonical report JSON (sorted keys)
 *   - scoreBand:  traction band (0..4) from the simulation report
 *   - timestamp:  UNIX epoch second when the receipt was published
 *
 * Duplicate publish policy:
 *   Publishing a receipt with a runId that already exists MUST revert
 *   with DuplicateRunId(). Idempotency is handled at the app/API layer
 *   (check hasReceipt before calling publishReceipt).
 *
 * Score band mapping:
 *   0 = very_low
 *   1 = low
 *   2 = moderate
 *   3 = high
 *   4 = very_high
 */
interface ISimVibeReceipt {
    // ---------------------------------------------------------------
    // Structs
    // ---------------------------------------------------------------

    struct Receipt {
        bytes32 runId;
        bytes32 inputHash;
        bytes32 reportHash;
        uint8   scoreBand;    // 0..4  (see ScoreBand mapping above)
        uint64  timestamp;    // UNIX epoch seconds
        address publisher;    // msg.sender at publish time
    }

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------

    /**
     * @notice Emitted exactly once per runId when a receipt is published.
     * @param runId       Indexed — keccak256 of off-chain run ID string.
     * @param inputHash   Indexed — SHA-256 of canonical run input.
     * @param reportHash  SHA-256 of canonical report.
     * @param scoreBand   Traction band (0..4).
     * @param timestamp   UNIX epoch seconds.
     * @param publisher   Indexed — address that published the receipt.
     */
    event ReceiptPublished(
        bytes32 indexed runId,
        bytes32 indexed inputHash,
        bytes32 reportHash,
        uint8   scoreBand,
        uint64  timestamp,
        address indexed publisher
    );

    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------

    /// @notice Thrown when a receipt for this runId already exists.
    error DuplicateRunId(bytes32 runId);

    /// @notice Thrown when inputHash or reportHash is zero.
    error InvalidHash();

    /// @notice Thrown when scoreBand > 4.
    error InvalidScoreBand(uint8 scoreBand);

    // ---------------------------------------------------------------
    // Write
    // ---------------------------------------------------------------

    /**
     * @notice Publish an immutable simulation receipt.
     * @dev Reverts with DuplicateRunId if runId already published.
     *      Reverts with InvalidHash if inputHash or reportHash is zero.
     *      Reverts with InvalidScoreBand if scoreBand > 4.
     * @param runId       keccak256 of the off-chain run identifier string.
     * @param inputHash   SHA-256 hash of canonical run input JSON.
     * @param reportHash  SHA-256 hash of canonical report JSON.
     * @param scoreBand   Traction band (0..4).
     */
    function publishReceipt(
        bytes32 runId,
        bytes32 inputHash,
        bytes32 reportHash,
        uint8   scoreBand
    ) external;

    // ---------------------------------------------------------------
    // Read
    // ---------------------------------------------------------------

    /**
     * @notice Fetch a stored receipt by runId.
     * @param runId keccak256 of the off-chain run identifier string.
     * @return receipt The full receipt struct (zero struct if not found).
     */
    function getReceipt(bytes32 runId) external view returns (Receipt memory receipt);

    /**
     * @notice Check whether a receipt exists for a given runId.
     * @param runId keccak256 of the off-chain run identifier string.
     * @return exists True if a receipt has been published for this runId.
     */
    function hasReceipt(bytes32 runId) external view returns (bool exists);

    /**
     * @notice Return the total number of receipts published.
     * @return count Total receipt count.
     */
    function receiptCount() external view returns (uint256 count);
}
