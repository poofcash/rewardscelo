//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IWrappedCelo.sol";

contract PoofCELO is ERC20, Ownable {
	using SafeMath for uint256;
  // Maximum fee of 1%
  uint256 constant public MIN_FEE_DIVISOR = 100;

  /// @dev list of wrappedCelo addresses.
  IWrappedCelo[] public wrappedCelos;
  /// @dev recipient of contract fees.
  address public feeTo;
  /// @dev divisor applied to withdrawals to generate fees.
  uint256 public feeDivisor;
	/// @dev authorized governance address.
	address public governance;
	/// @dev authorized administrator address.
	address public admin;
  /// @dev total amount of CELO represented.
  uint256 public totalSupplyCELO;

	/// @dev emitted when a new WrappedCelo is added
	/// @param wrappedCelo address of the added WrappedCelo
  event WrappedCeloAdded(address indexed wrappedCelo);
	/// @dev emitted when `feeTo` changes
	/// @param previousFeeTo address of the previous `feeTo`
	/// @param newFeeTo address of the new `feeTo`
  event FeeToChanged(address indexed previousFeeTo, address indexed newFeeTo);
	/// @dev emitted when `feeDivisor` changes
	/// @param previousFeeDivisor address of the previous `feeDivisor`
	/// @param newFeeDivisor address of the new `feeDivisor`
  event FeeDivisorChanged(uint256 indexed previousFeeDivisor, uint256 indexed newFeeDivisor);
	/// @dev emitted when `feeDivisor` is cleared
  event FeeDivisorCleared();

  constructor(address _governance, address _admin) ERC20("PoofCELO", "pCELO") {
    governance = _governance;
    admin = _admin;
  }

	modifier governanceOnly() {
		require(governance == msg.sender, "caller must be the registered governance");
		_;
	}

	modifier adminOnly() {
		require(admin == msg.sender, "caller must be the registered admin");
		_;
	}

  function addWrappedCelo(address wrappedCelo) governanceOnly external {
    wrappedCelos.push(IWrappedCelo(wrappedCelo));
    emit WrappedCeloAdded(wrappedCelo);
  }

	/// @notice Deposits wrappedCELO to the contract in exchange for PoofCELO (pCELO) tokens. 
  /// pCELO to mint is determined by the equivalence:
  /// savingsToCELO(toDeposit) / nextTotalSupplyCELO = toMint / (this.totalSupply() + toMint)
  /// and solving for `toMint`.
  /// @param toDeposit amount of wrappedCELO to deposit
  /// @param wrappedCeloIdx index of wrappedCelo that is supported by pCELO
	function deposit(uint256 toDeposit, uint256 wrappedCeloIdx) external {
    require(toDeposit > 0, "Can't deposit a zero amount");
    require(wrappedCeloIdx < wrappedCelos.length, "wrappedCeloIdx out of bounds");
    IWrappedCelo wrappedCelo = wrappedCelos[wrappedCeloIdx];

    uint256 celoToAdd = wrappedCelo.savingsToCELO(toDeposit);
    uint256 nextTotalSupplyCELO = totalSupplyCELO.add(celoToAdd);
    uint256 toMint = toDeposit;
    if (totalSupplyCELO > 0) {
      toMint = celoToAdd.mul(this.totalSupply()).div(nextTotalSupplyCELO.sub(celoToAdd));
    }
    totalSupplyCELO = nextTotalSupplyCELO;
    wrappedCelo.transferFrom(msg.sender, address(this), toDeposit);
		_mint(msg.sender, toMint);
	}

	/// @notice Withdraws wrappedCELO from the contract in exchange for PoofCELO (pCELO) tokens.
  /// @param toWithdraw amount of pCELO to withdraw
  /// @param wrappedCeloIdx index of wrappedCelo to withdraw into
	function withdraw(uint256 toWithdraw, uint256 wrappedCeloIdx) external {
    require(toWithdraw > 0, "Can't withdraw a zero amount");
    require(toWithdraw <= this.balanceOf(msg.sender), "Can't withdraw more than user balance");
    require(wrappedCeloIdx < wrappedCelos.length, "wrappedCeloIdx out of bounds");
    IWrappedCelo wrappedCelo = wrappedCelos[wrappedCeloIdx];
    uint256 celoToReturn = toWithdraw.mul(totalSupplyCELO).div(this.totalSupply());
    uint256 toReturn = wrappedCelo.celoToSavings(celoToReturn);
    uint256 fee = 0;
    if (feeTo != address(0) && feeDivisor != 0) {
      fee = toReturn.div(feeDivisor);
      wrappedCelo.transfer(feeTo, fee);
    }
    wrappedCelo.transfer(msg.sender, toReturn - fee);
    totalSupplyCELO = totalSupplyCELO.sub(celoToReturn);
		_burn(msg.sender, toWithdraw);
	}

  function addCeloSupply(uint256 toAdd) adminOnly external {
    totalSupplyCELO = totalSupplyCELO.add(toAdd);
  }

  function setFeeTo(address _feeTo) governanceOnly external {
    address previousFeeTo = feeTo;
    feeTo = _feeTo;
    emit FeeToChanged(previousFeeTo, feeTo);
  }

  function setFeeDivisor(uint256 _feeDivisor) governanceOnly external {
    require(_feeDivisor >= MIN_FEE_DIVISOR, 'New fee rate is too high');
    uint256 previousFeeDivisor = feeDivisor;
    feeDivisor = _feeDivisor;
    emit FeeDivisorChanged(previousFeeDivisor, feeDivisor);
  }

  function clearFeeDivisor() governanceOnly external {
    feeDivisor = 0;
    emit FeeDivisorCleared();
  }
} 
