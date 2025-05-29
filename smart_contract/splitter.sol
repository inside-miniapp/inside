// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Splitter is Ownable {
    using SafeERC20 for IERC20;

    uint16 public ownerShare;

    IERC20 public immutable token;

    event Paid(address indexed payer, address indexed recipient, uint256 total);
    event OwnerShareChanged(uint16 oldShare, uint16 newShare);

    constructor(address _token, uint16 _ownerShare) Ownable(_msgSender()) {
        require(_ownerShare <= 100, "Share>100");
        require(_token != address(0), "Zero token");
        token = IERC20(_token);
        ownerShare = _ownerShare;
    }

    function setOwnerShare(uint16 _newShare) external onlyOwner {
        require(_newShare <= 100, "Share>100");
        emit OwnerShareChanged(ownerShare, _newShare);
        ownerShare = _newShare;
    }

    function pay(address recipient, uint256 amount) external {
        require(amount > 0, "Zero payment");
        token.safeTransferFrom(msg.sender, address(this), amount);

        uint256 oAmount = (amount * ownerShare) / 100;
        uint256 rAmount = amount - oAmount;

        token.safeTransfer(owner(), oAmount);
        token.safeTransfer(recipient, rAmount);

        emit Paid(msg.sender, recipient, amount);
    }
}