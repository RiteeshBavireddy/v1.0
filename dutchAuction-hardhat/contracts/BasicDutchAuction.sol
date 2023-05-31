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

    modifier onlyWhileOpen {
        require(block.number <= startingBlock + numBlocksAuctionOpen, "Auction is not open");
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
function getCurrentPrice() public view returns (uint256) {
    if (block.number > startingBlock + numBlocksAuctionOpen) {
        return 0;
    }
    return initialPrice - ((block.number - startingBlock) * offerPriceDecrement);
}
    // function getCurrentPrice() public view returns (uint256) {
    //     if (block.number > startingBlock + numBlocksAuctionOpen) {
    //         return 0;
    //     }
    //     return initialPrice - ((block.number - startingBlock) * offerPriceDecrement);
    // }

    function bid() public payable onlyBeforeEnd onlyWhileOpen {
    require(msg.sender != owner, "Owner cannot bid");
    uint256 currentPrice = getCurrentPrice();
    require(msg.value >= currentPrice, "Bid is below the current price");
    require(currentPrice >= reservePrice, "Bid is below the reserve price");

    // Ensure that the bidder has enough balance in their external account
    // require(address(msg.sender).balance >= msg.value, "Insufficient balance for bid");
    require(msg.sender.balance >= msg.value, "Insufficient balance for bid");


    if (msg.value > currentPrice) {
        payable(msg.sender).transfer(msg.value - currentPrice);
    }

    // Ensure the owner has enough balance to receive the funds
    require(address(owner).balance + currentPrice >= address(owner).balance, "Owner cannot receive funds");

    payable(owner).transfer(currentPrice);
    auctionEnd = true;
    winningBid = currentPrice;
    winningBidder = payable(msg.sender);

    emit AuctionEnded(winningBidder, winningBid);
}


    function endAuction() public onlyOwner {
        auctionEnd = true;
        winningBid = 0;
        winningBidder = payable(address(0));
        reservePrice = 0;

        emit AuctionEnded(owner, 0);
    }
}

