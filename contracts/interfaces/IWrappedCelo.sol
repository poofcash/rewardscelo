//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWrappedCelo is IERC20 {
	/// @notice Returns amount of CELO that can be claimed for savingsAmount SavingsCELO tokens.
	/// @param savingsAmount amount of sCELO tokens.
	/// @return amount of CELO tokens.
	function savingsToCELO(uint256 savingsAmount) external view returns (uint256);

	/// @notice Returns amount of SavingsCELO tokens that can be received for depositing celoAmount CELO tokens.
	/// @param celoAmount amount of CELO tokens.
	/// @return amount of sCELO tokens.
	function celoToSavings(uint256 celoAmount) external view returns (uint256);
}


