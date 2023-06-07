// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721Auction is Ownable {
    IERC721 public nftToken;
    uint256 public nftTokenId;
    uint256 public reservePrice;
    uint256 public numBlocksAuctionOpen;
    uint256 public auctionDuration;
    uint256 public offerPriceDecrement;
    uint256 public startPrice;
    uint256 public startBlock;
    address public highestBidder;
    bool public auctionEnded;

    // Events for better frontend interaction
    event AuctionStarted(uint256 startPrice);
    event NewBid(address indexed bidder, uint256 amount);
    event AuctionEnded(address indexed winner, uint256 winningBid);

    constructor (
        address erc721TokenAddress,
        uint256 _nftTokenId,
        uint256 _reservePrice,
        uint256 _numBlocksAuctionOpen,
        uint256 _offerPriceDecrement
        // uint256 _auctionDuration
        
    ){
        require(_reservePrice > 0, "Reserve price should be greater than 0");
        require(_offerPriceDecrement > 0, "Offer price decrement should be greater than 0");

        // reservePrice = _reservePrice;
        // auctionDuration = _auctionDuration;
        
        require(_numBlocksAuctionOpen > 0, "Auction must be open for at least one block");
        // require(_offerPriceDecrement >= 0, "Price decrement should be non-negative");

        nftToken = IERC721(erc721TokenAddress);
        nftTokenId = _nftTokenId;
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;
        startPrice = reservePrice + numBlocksAuctionOpen * offerPriceDecrement;
        startBlock = block.number;
        auctionEnded = false;

        emit AuctionStarted(startPrice);
    }

    function getCurrentPrice() public view returns (uint256) {
        if (block.number > startBlock) {
            uint256 priceDrop = offerPriceDecrement * (block.number - startBlock);
            return startPrice > priceDrop ? startPrice - priceDrop : reservePrice;
        } else {
            return startPrice;          
            
        }
        
    }
//     function getOfferPriceDecrement() public view returns (uint256) {
//     return offerPriceDecrement;
// }

// function getReservePrice() public view returns (uint256) {
//     return reservePrice;
// }


    function bid() external payable {
        
        require(!auctionEnded, "Auction has ended");
        require(block.number <= startBlock + numBlocksAuctionOpen, "Auction is closed");
        require(msg.value >= getCurrentPrice(), "Bid is lower than the reserve price");
        require(msg.sender != owner(), "Owner cannot place a bid");

        // If there's a previous bid, refund it
        if (highestBidder != address(0)) {
            payable(highestBidder).transfer(getCurrentPrice());
        }

        // Update new highest bidder
        highestBidder = msg.sender;

        // If a valid bid is made, end the auction immediately
        if (msg.value >= getCurrentPrice()) {
            endAuction();
        }

        emit NewBid(msg.sender, msg.value);
    }

    function endAuction() public {
        // require(!auctionEnded, "Auction has not finished yet");
        require(!auctionEnded, "Auction has already ended");

        // Revert if no bids received
        require(highestBidder != address(0), "No bids received");

        // Transfer the funds to the seller
        payable(owner()).transfer(getCurrentPrice());

        // Transfer the NFT to the highest bidder
        nftToken.transferFrom(owner(), highestBidder, nftTokenId);

        auctionEnded = true;

        emit AuctionEnded(highestBidder, getCurrentPrice());
    }
}



