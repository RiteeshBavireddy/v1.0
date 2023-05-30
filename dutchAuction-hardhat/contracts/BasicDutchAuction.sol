// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract BasicDutchAuction {
    address payable public owner;
    uint256 public reservePrice;
    uint256 public numBlocksAuctionOpen;
    uint256 public offerPriceDecrement;
    uint256 public initialPrice;
    bool public auctionEnd;
    uint256 public winningBid;
    address payable public winningBidder;
    uint256 public startingBlock;

    event AuctionEnded(address winner, uint256 amount);

    modifier onlyOwner {
        require(msg.sender == owner, "Only owner can call this function.");
        _;
    }

    modifier onlyBeforeEnd {
        require(!auctionEnd, "Auction has ended.");
        _;
    }

    constructor(uint256 _reservePrice, uint256 _numBlocksAuctionOpen, uint256 _offerPriceDecrement) {
        owner = payable(msg.sender);
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;
        initialPrice = _reservePrice + _numBlocksAuctionOpen * _offerPriceDecrement;
        startingBlock = block.number;
        auctionEnd = false;
    }

    function getCurrentPrice() public view returns(uint256) {
        if(block.number > startingBlock + numBlocksAuctionOpen) {
            return 0;
        }
        return initialPrice - ((block.number - startingBlock) * offerPriceDecrement);
    }

    function bid() public payable onlyBeforeEnd {
        uint256 currentPrice = getCurrentPrice();
        require(msg.value >= currentPrice, "Bid is not high enough");

        owner.transfer(msg.value);
        auctionEnd = true;
        winningBid = msg.value;
        winningBidder = payable(msg.sender);

        emit AuctionEnded(winningBidder, winningBid);
    }

    function endAuction() public onlyOwner {
        selfdestruct(owner);
    }
}
