// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";


contract TipBot is Initializable, AccessControlEnumerable, ReentrancyGuardUpgradeable {
  using ECDSA for bytes32;
  using AddressUpgradeable for address;


  // Start of events declaration
  event Tip ( address indexed from,  address indexed toAddress, uint256 amount );
  event TipToken ( address indexed from,  address indexed toAddress, uint256 amount );
  event AirDrop ( address indexed from, address indexed toAddress, uint256 amount);
  event AirDropToken ( address indexed from, address indexed toAddress, uint256 amount);
  event Withdraw ( uint256 amount, bytes32 indexed reason);

  // Global variables used in contract
  uint256 public feeRate;
  uint256 public airdropRate;

  mapping( bytes => mapping(address => bool)) signatureLookup;

  function init(uint256 _feeRate, uint256 _airdropRate) external initializer {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    feeRate = _feeRate;
    airdropRate = _airdropRate;
  }

  function setFeeRate( uint256 _feeRate ) public onlyRole(DEFAULT_ADMIN_ROLE) {
    require( _feeRate < 1 ether, "Invalid amount, cannot be greater than 1 ether");
    feeRate = _feeRate;
  }

  function setAirdropRate( uint256 _feeRate ) public onlyRole(DEFAULT_ADMIN_ROLE) {
    require( _feeRate < 1 ether, "Invalid amount, cannot be greater than 1 ether");
    airdropRate = _feeRate;
  }

  function tip( address payable toAddress ) public payable nonReentrant {

    uint256 newBalance = ((1 ether - feeRate) * msg.value)/1 ether;
    (bool success, ) = toAddress.call{value: newBalance }("");
    require(success, "Failed to send Token");

    emit Tip( 
      msg.sender,
      toAddress,
      newBalance
    );
  }

  function tipByToken(address toAddress, IERC20 token,  uint256 amount) public nonReentrant{

    require(amount > 0, "Amount must be greater than 0");
    
    bool success = token.transferFrom(msg.sender, address(this), amount);
    require(success, "Transfer failed");

    uint256 newBalance = ((1 ether - feeRate) * amount)/1 ether;

    bool successTransfer = token.transfer(toAddress,newBalance);
    require(successTransfer, "Transfer to recipient failed");

    emit TipToken(
      msg.sender,
      toAddress,
      newBalance
    );
  }


  function airDrop ( 
    address payable[] memory accountAddress
  ) public payable nonReentrant {

    require(accountAddress.length > 0, "Addresses cannot be empty");
    uint256 distributedAmount = ( ((1 ether - airdropRate) * msg.value ) / 1 ether ) / accountAddress.length;

    for(uint8 i = 0; i < accountAddress.length; i++){

    (bool success, ) = accountAddress[i].call{value: distributedAmount }("");
    require(success, "Failed to send Token");

      emit AirDrop(
        msg.sender,
        accountAddress[i],
        distributedAmount
      );
    }
  }
  
  function airDropToken ( 
    address[] memory accountAddress,
    IERC20 token,  uint256 amount
  ) public nonReentrant {
    require(amount > 0, "Amount must be greater than 0");
    require(accountAddress.length > 0, "Addresses cannot be empty");
    
    bool success = token.transferFrom(msg.sender, address(this), amount);
    require(success, "Transfer failed");

    uint256 distributedAmount = ( ((1 ether - airdropRate) * amount ) / 1 ether ) / accountAddress.length;


    for(uint8 i = 0; i < accountAddress.length; i++){
      bool successTransfer = token.transfer(accountAddress[i], distributedAmount);
      require(successTransfer, "Failed to send Token");

      emit AirDropToken(
        msg.sender,
        accountAddress[i],
        distributedAmount
      );
    }
  }

  function withdraw (
    uint256 amount, 
    bytes32 reason,
    bytes memory data,
    bytes[] calldata signatures
  ) public nonReentrant {

    require( getRoleMemberCount(DEFAULT_ADMIN_ROLE) == signatures.length, "Not enough signatures");

    // Extract and verify each signature is valid
    bytes32 message = keccak256(data);
    bytes32 hashed = message.toEthSignedMessageHash();

    uint8 validSignatures = 0;

    for (uint8 i = 0; i < signatures.length; i++) {
        bytes calldata signature = signatures[i];
        (address signer) = hashed.recover(signature);

        require(hasRole(DEFAULT_ADMIN_ROLE, signer), "Signer is not admin");
        require(!signatureLookup[signature][signer], "Repeating admin signature not valid");

        validSignatures += 1;
        signatureLookup[signature][signer] = true;
    }

    require( validSignatures == getRoleMemberCount(DEFAULT_ADMIN_ROLE), "Not all signatures are valid");

    (uint256 decode_amount, bytes32 decode_reason) = abi.decode(data, (uint256, bytes32) );

    require( decode_amount == amount, "Hashed amount not valid");
    require( decode_reason == reason, "Hashed reason not valid");
    
    //Perform withdraw action
    uint contractAmount = address(this).balance;
    require( amount <= contractAmount, "Not enough balance to withdraw" );

    uint256 distributedAmount =  amount / getRoleMemberCount(DEFAULT_ADMIN_ROLE);

    for(uint8 i = 0; i < getRoleMemberCount(DEFAULT_ADMIN_ROLE); i++){
      (bool success, ) = getRoleMember(DEFAULT_ADMIN_ROLE, i).call{value: distributedAmount }("");
      require( success, "Failed to withdraw" );
    }

    emit Withdraw(
      distributedAmount, 
      reason
    );
  }

}
