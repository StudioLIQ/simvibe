// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SimVibeReceipt} from "../src/SimVibeReceipt.sol";

/**
 * @title DeploySimVibeReceipt
 * @notice Deploy the SimVibeReceipt contract to any EVM chain.
 *
 * Usage (testnet):
 *   forge script script/Deploy.s.sol:DeploySimVibeReceipt \
 *     --rpc-url $RECEIPT_RPC_URL \
 *     --private-key $RECEIPT_PUBLISHER_KEY \
 *     --broadcast \
 *     --verify
 *
 * Usage (dry run):
 *   forge script script/Deploy.s.sol:DeploySimVibeReceipt \
 *     --rpc-url $RECEIPT_RPC_URL
 */
contract DeploySimVibeReceipt is Script {
    function run() external {
        vm.startBroadcast();

        SimVibeReceipt receipt = new SimVibeReceipt();

        console.log("SimVibeReceipt deployed at:", address(receipt));
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", msg.sender);

        vm.stopBroadcast();
    }
}
