// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISimVibeGate} from "../spec/ISimVibeGate.sol";

/**
 * @title SimVibeGate
 * @notice On-chain launch-readiness gate for simvi.be on Monad.
 * @dev Trusted attesters record pass/fail verdicts; launch contracts check isLaunchReady().
 */
contract SimVibeGate is ISimVibeGate {
    address public owner;
    mapping(address => bool) private _attesters;
    mapping(bytes32 => bool) private _acceptedPolicies;
    mapping(bytes32 => Attestation) private _attestations;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    modifier onlyAttester() {
        if (!_attesters[msg.sender]) revert UnauthorizedAttester(msg.sender);
        _;
    }

    constructor() {
        owner = msg.sender;
        _attesters[msg.sender] = true; // owner is also an attester
    }

    // ---------------------------------------------------------------
    // Owner functions
    // ---------------------------------------------------------------

    /// @inheritdoc ISimVibeGate
    function registerPolicy(bytes32 policyHash) external onlyOwner {
        _acceptedPolicies[policyHash] = true;
        emit PolicyUpdated(policyHash, true);
    }

    /// @inheritdoc ISimVibeGate
    function revokePolicy(bytes32 policyHash) external onlyOwner {
        _acceptedPolicies[policyHash] = false;
        emit PolicyUpdated(policyHash, false);
    }

    /// @inheritdoc ISimVibeGate
    function addAttester(address attester) external onlyOwner {
        _attesters[attester] = true;
    }

    /// @inheritdoc ISimVibeGate
    function removeAttester(address attester) external onlyOwner {
        _attesters[attester] = false;
    }

    // ---------------------------------------------------------------
    // Attester functions
    // ---------------------------------------------------------------

    /// @inheritdoc ISimVibeGate
    function attestReady(
        bytes32 runId,
        bytes32 policyHash,
        bool    ready
    ) external onlyAttester {
        if (!_acceptedPolicies[policyHash]) revert InvalidPolicyHash(policyHash);
        if (_attestations[runId].attester != address(0)) revert DuplicateAttestation(runId);

        _attestations[runId] = Attestation({
            runId: runId,
            policyHash: policyHash,
            ready: ready,
            timestamp: uint64(block.timestamp),
            attester: msg.sender
        });

        emit ReadinessAttested(runId, policyHash, ready, uint64(block.timestamp), msg.sender);
    }

    // ---------------------------------------------------------------
    // Read functions
    // ---------------------------------------------------------------

    /// @inheritdoc ISimVibeGate
    function isLaunchReady(bytes32 runId) external view returns (bool) {
        Attestation storage a = _attestations[runId];
        return a.attester != address(0) && a.ready;
    }

    /// @inheritdoc ISimVibeGate
    function getAttestation(bytes32 runId) external view returns (Attestation memory) {
        return _attestations[runId];
    }

    /// @inheritdoc ISimVibeGate
    function isPolicyAccepted(bytes32 policyHash) external view returns (bool) {
        return _acceptedPolicies[policyHash];
    }

    /// @inheritdoc ISimVibeGate
    function isAttester(address attester) external view returns (bool) {
        return _attesters[attester];
    }
}
