// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SimVibeGate} from "../src/SimVibeGate.sol";
import {ISimVibeGate} from "../spec/ISimVibeGate.sol";

contract SimVibeGateTest is Test {
    SimVibeGate public gate;

    bytes32 constant RUN_ID = keccak256("run_abc123");
    bytes32 constant POLICY_HASH = keccak256("policy_v1");

    address constant OWNER = address(0xAAAA);
    address constant ATTESTER = address(0xBBBB);
    address constant NOBODY = address(0xCCCC);

    function setUp() public {
        vm.prank(OWNER);
        gate = new SimVibeGate();
    }

    // ---------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------

    function test_constructor_ownerIsAttester() public view {
        assertTrue(gate.isAttester(OWNER));
    }

    function test_constructor_ownerIsOwner() public view {
        assertEq(gate.owner(), OWNER);
    }

    // ---------------------------------------------------------------
    // Policy management
    // ---------------------------------------------------------------

    function test_registerPolicy() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);
        assertTrue(gate.isPolicyAccepted(POLICY_HASH));
    }

    function test_registerPolicy_emitsEvent() public {
        vm.prank(OWNER);
        vm.expectEmit(true, false, false, true);
        emit ISimVibeGate.PolicyUpdated(POLICY_HASH, true);
        gate.registerPolicy(POLICY_HASH);
    }

    function test_revokePolicy() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);
        vm.prank(OWNER);
        gate.revokePolicy(POLICY_HASH);
        assertFalse(gate.isPolicyAccepted(POLICY_HASH));
    }

    function test_registerPolicy_revertsNonOwner() public {
        vm.prank(NOBODY);
        vm.expectRevert(abi.encodeWithSelector(ISimVibeGate.NotOwner.selector, NOBODY));
        gate.registerPolicy(POLICY_HASH);
    }

    // ---------------------------------------------------------------
    // Attester management
    // ---------------------------------------------------------------

    function test_addAttester() public {
        vm.prank(OWNER);
        gate.addAttester(ATTESTER);
        assertTrue(gate.isAttester(ATTESTER));
    }

    function test_removeAttester() public {
        vm.prank(OWNER);
        gate.addAttester(ATTESTER);
        vm.prank(OWNER);
        gate.removeAttester(ATTESTER);
        assertFalse(gate.isAttester(ATTESTER));
    }

    function test_addAttester_revertsNonOwner() public {
        vm.prank(NOBODY);
        vm.expectRevert(abi.encodeWithSelector(ISimVibeGate.NotOwner.selector, NOBODY));
        gate.addAttester(ATTESTER);
    }

    // ---------------------------------------------------------------
    // Attest ready: success
    // ---------------------------------------------------------------

    function test_attestReady_success() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);

        vm.prank(OWNER);
        gate.attestReady(RUN_ID, POLICY_HASH, true);

        assertTrue(gate.isLaunchReady(RUN_ID));

        ISimVibeGate.Attestation memory a = gate.getAttestation(RUN_ID);
        assertEq(a.runId, RUN_ID);
        assertEq(a.policyHash, POLICY_HASH);
        assertTrue(a.ready);
        assertEq(a.attester, OWNER);
        assertGt(a.timestamp, 0);
    }

    function test_attestReady_notReady() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);

        vm.prank(OWNER);
        gate.attestReady(RUN_ID, POLICY_HASH, false);

        assertFalse(gate.isLaunchReady(RUN_ID));

        ISimVibeGate.Attestation memory a = gate.getAttestation(RUN_ID);
        assertFalse(a.ready);
        assertEq(a.attester, OWNER);
    }

    function test_attestReady_emitsEvent() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);

        vm.prank(OWNER);
        vm.expectEmit(true, true, true, true);
        emit ISimVibeGate.ReadinessAttested(RUN_ID, POLICY_HASH, true, uint64(block.timestamp), OWNER);
        gate.attestReady(RUN_ID, POLICY_HASH, true);
    }

    function test_attestReady_byNonOwnerAttester() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);
        vm.prank(OWNER);
        gate.addAttester(ATTESTER);

        vm.prank(ATTESTER);
        gate.attestReady(RUN_ID, POLICY_HASH, true);

        assertTrue(gate.isLaunchReady(RUN_ID));
        ISimVibeGate.Attestation memory a = gate.getAttestation(RUN_ID);
        assertEq(a.attester, ATTESTER);
    }

    // ---------------------------------------------------------------
    // Attest ready: failure cases
    // ---------------------------------------------------------------

    function test_attestReady_revertsUnauthorized() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);

        vm.prank(NOBODY);
        vm.expectRevert(abi.encodeWithSelector(ISimVibeGate.UnauthorizedAttester.selector, NOBODY));
        gate.attestReady(RUN_ID, POLICY_HASH, true);
    }

    function test_attestReady_revertsInvalidPolicy() public {
        bytes32 unknownPolicy = keccak256("unknown_policy");

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(ISimVibeGate.InvalidPolicyHash.selector, unknownPolicy));
        gate.attestReady(RUN_ID, unknownPolicy, true);
    }

    function test_attestReady_revertsDuplicate() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);

        vm.prank(OWNER);
        gate.attestReady(RUN_ID, POLICY_HASH, true);

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(ISimVibeGate.DuplicateAttestation.selector, RUN_ID));
        gate.attestReady(RUN_ID, POLICY_HASH, true);
    }

    function test_attestReady_revertsRevokedPolicy() public {
        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);
        vm.prank(OWNER);
        gate.revokePolicy(POLICY_HASH);

        vm.prank(OWNER);
        vm.expectRevert(abi.encodeWithSelector(ISimVibeGate.InvalidPolicyHash.selector, POLICY_HASH));
        gate.attestReady(RUN_ID, POLICY_HASH, true);
    }

    // ---------------------------------------------------------------
    // Read: not found
    // ---------------------------------------------------------------

    function test_isLaunchReady_falseIfNotFound() public view {
        assertFalse(gate.isLaunchReady(RUN_ID));
    }

    function test_getAttestation_zeroIfNotFound() public view {
        ISimVibeGate.Attestation memory a = gate.getAttestation(RUN_ID);
        assertEq(a.attester, address(0));
    }

    function test_isAttester_falseForUnknown() public view {
        assertFalse(gate.isAttester(NOBODY));
    }

    function test_isPolicyAccepted_falseForUnknown() public view {
        assertFalse(gate.isPolicyAccepted(POLICY_HASH));
    }

    // ---------------------------------------------------------------
    // Multiple attestations
    // ---------------------------------------------------------------

    function test_multipleRuns() public {
        bytes32 run1 = keccak256("run_1");
        bytes32 run2 = keccak256("run_2");
        bytes32 run3 = keccak256("run_3");

        vm.prank(OWNER);
        gate.registerPolicy(POLICY_HASH);

        vm.prank(OWNER);
        gate.attestReady(run1, POLICY_HASH, true);
        vm.prank(OWNER);
        gate.attestReady(run2, POLICY_HASH, false);
        vm.prank(OWNER);
        gate.attestReady(run3, POLICY_HASH, true);

        assertTrue(gate.isLaunchReady(run1));
        assertFalse(gate.isLaunchReady(run2));
        assertTrue(gate.isLaunchReady(run3));
    }
}
