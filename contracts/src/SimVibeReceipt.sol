// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISimVibeReceipt} from "../spec/ISimVibeReceipt.sol";

/**
 * @title SimVibeReceipt
 * @notice Immutable simulation receipt store for simvi.be on Monad.
 * @dev Each run can publish exactly one receipt. Duplicate publishes revert.
 */
contract SimVibeReceipt is ISimVibeReceipt {
    mapping(bytes32 => Receipt) private _receipts;
    uint256 private _count;

    /// @inheritdoc ISimVibeReceipt
    function publishReceipt(
        bytes32 runId,
        bytes32 inputHash,
        bytes32 reportHash,
        uint8   scoreBand
    ) external {
        if (_receipts[runId].publisher != address(0)) {
            revert DuplicateRunId(runId);
        }
        if (inputHash == bytes32(0) || reportHash == bytes32(0)) {
            revert InvalidHash();
        }
        if (scoreBand > 4) {
            revert InvalidScoreBand(scoreBand);
        }

        uint64 ts = uint64(block.timestamp);

        _receipts[runId] = Receipt({
            runId: runId,
            inputHash: inputHash,
            reportHash: reportHash,
            scoreBand: scoreBand,
            timestamp: ts,
            publisher: msg.sender
        });
        _count++;

        emit ReceiptPublished(runId, inputHash, reportHash, scoreBand, ts, msg.sender);
    }

    /// @inheritdoc ISimVibeReceipt
    function getReceipt(bytes32 runId) external view returns (Receipt memory) {
        return _receipts[runId];
    }

    /// @inheritdoc ISimVibeReceipt
    function hasReceipt(bytes32 runId) external view returns (bool) {
        return _receipts[runId].publisher != address(0);
    }

    /// @inheritdoc ISimVibeReceipt
    function receiptCount() external view returns (uint256) {
        return _count;
    }
}
