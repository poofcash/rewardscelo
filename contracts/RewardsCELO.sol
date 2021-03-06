//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IWrappedCelo.sol";

contract RewardsCELO is ERC20, Ownable, IWrappedCelo, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IWrappedCelo;

  // Maximum fee of 1%
  uint256 constant public MIN_FEE_DIVISOR = 100;

  /// @dev list of wrappedCelo addresses.
  IWrappedCelo[] public wrappedCelos;
  /// @dev map of wrappedCelo address to ban status.
  mapping (address => bool) public bans;
  /// @dev recipient of contract fees.
  address public feeTo;
  /// @dev divisor applied to withdrawals to generate fees.
  uint256 public feeDivisor;

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

  constructor() ERC20("RewardsCELO", "rCELO") {}

  /// @notice Adds support for another wrapped CELO token
  /// @param wrappedCelo address of the new wrapped CELO token to support
  function addWrappedCelo(address wrappedCelo) external onlyOwner {
    wrappedCelos.push(IWrappedCelo(wrappedCelo));
    emit WrappedCeloAdded(wrappedCelo);
  }

  /// @notice Deposits wrappedCelo to the contract in exchange for RewardsCELO (pCELO) tokens. 
  /// pCELO to mint is determined by the equivalence:
  /// savingsToCELO(toDeposit) / nextTotalSupplyCELO = toMint / (this.totalSupply() + toMint)
  /// and solving for `toMint`.
  /// @param toDeposit amount of wrappedCelo to deposit
  /// @param wrappedCeloIdx index of wrappedCelo that is supported by pCELO
  function deposit(uint256 toDeposit, uint256 wrappedCeloIdx) external nonReentrant {
    require(toDeposit > 0, "Can't deposit a zero amount");
    require(wrappedCeloIdx < wrappedCelos.length, "wrappedCeloIdx out of bounds");
    IWrappedCelo wrappedCelo = wrappedCelos[wrappedCeloIdx];
    require(bans[address(wrappedCelo)] == false, "Selected wrappedCelo is banned");

    uint256 totalSupplyCELO = getTotalSupplyCELO();

    uint256 celoToAdd = wrappedCelo.savingsToCELO(toDeposit);
    uint256 nextTotalSupplyCELO = totalSupplyCELO.add(celoToAdd);
    uint256 toMint;
    if (totalSupplyCELO == 0) {
      toMint = toDeposit;
    } else {
      toMint = celoToAdd.mul(this.totalSupply()).div(nextTotalSupplyCELO.sub(celoToAdd));
    }
    wrappedCelo.safeTransferFrom(_msgSender(), address(this), toDeposit);
    _mint(_msgSender(), toMint);
  }

  /// @notice Returns the total amount of CELO represented by all wrapped CELO tokens
  function getTotalSupplyCELO() public view returns (uint256) {
    uint256 totalSupplyCELO = 0;
    for (uint256 i = 0; i < wrappedCelos.length; i++) {
      IWrappedCelo wrappedCelo = wrappedCelos[i];
      totalSupplyCELO += wrappedCelo.savingsToCELO(wrappedCelo.balanceOf(address(this)));
    }
    return totalSupplyCELO;
  }

  /// @notice Withdraws wrappedCelo from the contract by returning RewardsCELO (pCELO) tokens.
  /// Every wrappedCelo token is proportionally withdrawn according to the toWithdraw:totalSupply ratio
  /// @param toWithdraw amount of pCELO to withdraw with
  function withdraw(uint256 toWithdraw) external nonReentrant {
    require(toWithdraw > 0, "Can't withdraw a zero amount");
    require(toWithdraw <= this.balanceOf(_msgSender()), "Can't withdraw more than user balance");

    uint256 totalSupplyCELO = getTotalSupplyCELO();

    for (uint256 i = 0; i < wrappedCelos.length; i++) {
      IWrappedCelo wrappedCelo = wrappedCelos[i];
      uint256 toReturn = wrappedCelo.balanceOf(address(this)).mul(toWithdraw).div(this.totalSupply());
      uint256 fee = 0;
      if (feeTo != address(0) && feeDivisor != 0) {
        fee = toReturn.div(feeDivisor);
        wrappedCelo.safeTransfer(feeTo, fee);
      }
      wrappedCelo.safeTransfer(_msgSender(), toReturn.sub(fee));
      totalSupplyCELO = totalSupplyCELO.sub(wrappedCelo.savingsToCELO(toReturn));
    }
    _burn(_msgSender(), toWithdraw);
  }

  /// @notice Sets the address that receives fees from this contract
  /// @param _feeTo address to receive fees from this contract
  function setFeeTo(address _feeTo) external onlyOwner {
    address previousFeeTo = feeTo;
    feeTo = _feeTo;
    emit FeeToChanged(previousFeeTo, feeTo);
  }

  /// @notice Sets the new fee rate
  /// @param _feeDivisor fee divisor to apply to all withdrawals
  function setFeeDivisor(uint256 _feeDivisor) external onlyOwner {
    require(_feeDivisor >= MIN_FEE_DIVISOR, "New fee rate is too high");
    uint256 previousFeeDivisor = feeDivisor;
    feeDivisor = _feeDivisor;
    emit FeeDivisorChanged(previousFeeDivisor, feeDivisor);
  }

  /// @notice Disables fees on this contract
  function clearFeeDivisor() external onlyOwner {
    uint256 previousFeeDivisor = feeDivisor;
    feeDivisor = 0;
    emit FeeDivisorChanged(previousFeeDivisor, feeDivisor);
  }

  /// @notice Bans a wrappedCelo from being deposited
  /// @param wrappedCeloIdx index of the wrappedCelo to ban
  function banWrappedCelo(uint256 wrappedCeloIdx) external onlyOwner {
    require(wrappedCeloIdx < wrappedCelos.length, "wrappedCeloIdx out of bounds");
    bans[address(wrappedCelos[wrappedCeloIdx])] = true;
  }

  /// @notice Unbans a wrappedCelo from being deposited
  /// @param wrappedCeloIdx index of the wrappedCelo to unban
  function unbanWrappedCelo(uint256 wrappedCeloIdx) external onlyOwner {
    require(wrappedCeloIdx < wrappedCelos.length, "wrappedCeloIdx out of bounds");
    bans[address(wrappedCelos[wrappedCeloIdx])] = false;
  }

  function celoToSavings(uint256 celoAmount) override external view returns (uint256) {
    uint256 totalSupplyCELO = getTotalSupplyCELO();
    return celoAmount.mul(this.totalSupply()).div(totalSupplyCELO);
  }

  function savingsToCELO(uint256 savingsAmount) override external view returns (uint256) {
    uint256 totalSupplyCELO = getTotalSupplyCELO();
    return savingsAmount.mul(totalSupplyCELO).div(this.totalSupply());
  }
} 
