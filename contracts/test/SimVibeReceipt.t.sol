// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SimVibeReceipt} from "../src/SimVibeReceipt.sol";
import {ISimVibeReceipt} from "../spec/ISimVibeReceipt.sol";

contract SimVibeReceiptTest is Test {
    SimVibeReceipt public receipt;

    bytes32 constant RUN_ID = keccak256("run_abc123");
    bytes32 constant INPUT_HASH = bytes32(uint256(0xaa));
    bytes32 constant REPORT_HASH = bytes32(uint256(0xbb));
    uint8 constant SCORE_BAND = 2; // moderate

    address constant PUBLISHER = address(0xBEEF);

    function setUp() public {
        receipt = new SimVibeReceipt();
    }

    // ---------------------------------------------------------------
    // Success cases
    // ---------------------------------------------------------------

    function test_publishReceipt_success() public {
        vm.prank(PUBLISHER);
        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, SCORE_BAND);

        assertTrue(receipt.hasReceipt(RUN_ID));
        assertEq(receipt.receiptCount(), 1);

        ISimVibeReceipt.Receipt memory r = receipt.getReceipt(RUN_ID);
        assertEq(r.runId, RUN_ID);
        assertEq(r.inputHash, INPUT_HASH);
        assertEq(r.reportHash, REPORT_HASH);
        assertEq(r.scoreBand, SCORE_BAND);
        assertEq(r.publisher, PUBLISHER);
        assertGt(r.timestamp, 0);
    }

    function test_publishReceipt_emitsEvent() public {
        vm.prank(PUBLISHER);

        vm.expectEmit(true, true, true, true);
        emit ISimVibeReceipt.ReceiptPublished(
            RUN_ID,
            INPUT_HASH,
            REPORT_HASH,
            SCORE_BAND,
            uint64(block.timestamp),
            PUBLISHER
        );

        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, SCORE_BAND);
    }

    function test_publishReceipt_allScoreBands() public {
        for (uint8 i = 0; i <= 4; i++) {
            bytes32 rid = keccak256(abi.encodePacked("run_", i));
            receipt.publishReceipt(rid, INPUT_HASH, REPORT_HASH, i);
            ISimVibeReceipt.Receipt memory r = receipt.getReceipt(rid);
            assertEq(r.scoreBand, i);
        }
        assertEq(receipt.receiptCount(), 5);
    }

    function test_publishReceipt_multipleDistinctRuns() public {
        bytes32 rid1 = keccak256("run_1");
        bytes32 rid2 = keccak256("run_2");
        bytes32 rid3 = keccak256("run_3");

        receipt.publishReceipt(rid1, INPUT_HASH, REPORT_HASH, 0);
        receipt.publishReceipt(rid2, INPUT_HASH, REPORT_HASH, 2);
        receipt.publishReceipt(rid3, INPUT_HASH, REPORT_HASH, 4);

        assertEq(receipt.receiptCount(), 3);
        assertTrue(receipt.hasReceipt(rid1));
        assertTrue(receipt.hasReceipt(rid2));
        assertTrue(receipt.hasReceipt(rid3));
    }

    function test_publishReceipt_timestampIsBlockTimestamp() public {
        uint256 expectedTs = 1700000000;
        vm.warp(expectedTs);
        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, SCORE_BAND);

        ISimVibeReceipt.Receipt memory r = receipt.getReceipt(RUN_ID);
        assertEq(r.timestamp, uint64(expectedTs));
    }

    // ---------------------------------------------------------------
    // Duplicate publish
    // ---------------------------------------------------------------

    function test_publishReceipt_revertsDuplicate() public {
        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, SCORE_BAND);

        vm.expectRevert(abi.encodeWithSelector(ISimVibeReceipt.DuplicateRunId.selector, RUN_ID));
        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, SCORE_BAND);
    }

    function test_publishReceipt_duplicateDoesNotIncrementCount() public {
        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, SCORE_BAND);
        assertEq(receipt.receiptCount(), 1);

        vm.expectRevert();
        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, SCORE_BAND);
        assertEq(receipt.receiptCount(), 1);
    }

    // ---------------------------------------------------------------
    // Invalid params
    // ---------------------------------------------------------------

    function test_publishReceipt_revertsZeroInputHash() public {
        vm.expectRevert(ISimVibeReceipt.InvalidHash.selector);
        receipt.publishReceipt(RUN_ID, bytes32(0), REPORT_HASH, SCORE_BAND);
    }

    function test_publishReceipt_revertsZeroReportHash() public {
        vm.expectRevert(ISimVibeReceipt.InvalidHash.selector);
        receipt.publishReceipt(RUN_ID, INPUT_HASH, bytes32(0), SCORE_BAND);
    }

    function test_publishReceipt_revertsInvalidScoreBand() public {
        vm.expectRevert(abi.encodeWithSelector(ISimVibeReceipt.InvalidScoreBand.selector, uint8(5)));
        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, 5);
    }

    function test_publishReceipt_revertsScoreBand255() public {
        vm.expectRevert(abi.encodeWithSelector(ISimVibeReceipt.InvalidScoreBand.selector, uint8(255)));
        receipt.publishReceipt(RUN_ID, INPUT_HASH, REPORT_HASH, 255);
    }

    // ---------------------------------------------------------------
    // Read: not found
    // ---------------------------------------------------------------

    function test_getReceipt_returnsZeroIfNotFound() public view {
        ISimVibeReceipt.Receipt memory r = receipt.getReceipt(RUN_ID);
        assertEq(r.publisher, address(0));
        assertEq(r.runId, bytes32(0));
    }

    function test_hasReceipt_falseIfNotFound() public view {
        assertFalse(receipt.hasReceipt(RUN_ID));
    }

    function test_receiptCount_zeroInitially() public view {
        assertEq(receipt.receiptCount(), 0);
    }

    // ---------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------

    function testFuzz_publishReceipt(
        bytes32 runId,
        bytes32 inputHash,
        bytes32 reportHash,
        uint8 scoreBand
    ) public {
        vm.assume(inputHash != bytes32(0));
        vm.assume(reportHash != bytes32(0));
        vm.assume(scoreBand <= 4);
        // runId=0 is valid (unusual but not disallowed)

        receipt.publishReceipt(runId, inputHash, reportHash, scoreBand);
        assertTrue(receipt.hasReceipt(runId));

        ISimVibeReceipt.Receipt memory r = receipt.getReceipt(runId);
        assertEq(r.inputHash, inputHash);
        assertEq(r.reportHash, reportHash);
        assertEq(r.scoreBand, scoreBand);
    }
}
