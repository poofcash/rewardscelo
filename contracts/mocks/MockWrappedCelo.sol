//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../interfaces/IWrappedCelo.sol";

contract MockWrappedCelo is IWrappedCelo, ERC20 {
	using SafeMath for uint256;

  uint256 public exchangeRate;

  constructor() ERC20("MockWrappedCelo", "mwCELO") {
    exchangeRate = 1;
  }

	function savingsToCELO(uint256 savingsAmount) override external view returns (uint256) {
    return savingsAmount.mul(exchangeRate);
  }

	function celoToSavings(uint256 celoAmount) override external view returns (uint256) {
    return celoAmount.div(exchangeRate);
  }

  function setExchangeRate(uint256 _exchangeRate) external {
    exchangeRate = _exchangeRate;
  }

  function mint(uint256 amount) external {
    _mint(msg.sender, amount);
  }
}



