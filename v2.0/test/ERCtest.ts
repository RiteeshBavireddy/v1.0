import { ethers } from "hardhat";
import { assert, expect } from "chai";
import 'mocha';

import { Contract, ContractFactory, Signer } from "ethers";
import {  MockERC721 } from "../typechain-types";

describe("ERC721Auction", function() {
  let ERC721Token: ContractFactory;
  let ERC721Auction: ContractFactory;
  let erc721Token: Contract;
  let erc721Auction: Contract;
  let owner: Signer;
  let bidder1: Signer;
  let bidder2: Signer;

  beforeEach(async function() {
    await ethers.provider.send("hardhat_reset", []);
    [owner, bidder1, bidder2] = await ethers.getSigners();

    // Deploy the ERC721 token
    ERC721Token = await ethers.getContractFactory("MockERC721");
    erc721Token = await ERC721Token.connect(owner).deploy("My NFT", "NFT");
    await erc721Token.deployed();
    await erc721Token.mint(await owner.getAddress(), 1);

    // Deploy the ERC721Auction contract
    ERC721Auction = await ethers.getContractFactory("ERC721Auction");
    erc721Auction = await ERC721Auction.connect(owner).deploy(
      erc721Token.address,
      1,
      ethers.utils.parseEther("1"),
      10,
      ethers.utils.parseEther("0.1")
    );
    await erc721Auction.deployed();
  });

  
  describe("Construction", function() {
    it("Should correctly initialize constructor variables", async function() {
      expect(await erc721Auction.nftToken()).to.equal(erc721Token.address);
      expect(await erc721Auction.nftTokenId()).to.equal(1);
      expect(await erc721Auction.reservePrice()).to.equal(ethers.utils.parseEther("1"));
      expect(await erc721Auction.numBlocksAuctionOpen()).to.equal(10);
      expect(await erc721Auction.offerPriceDecrement()).to.equal(ethers.utils.parseEther("0.1"));
      expect(await erc721Auction.getCurrentPrice()).to.equal(ethers.utils.parseEther("2"));
      expect(await erc721Auction.auctionEnded()).to.be.false;

    });

    it("Should fail with zero reserve price", async function() {
      await expect(
        ERC721Auction.connect(owner).deploy(
          erc721Token.address,
          1,
          ethers.utils.parseEther("0"),
          10,
          ethers.utils.parseEther("0.1")
        )
      ).to.be.revertedWith("Reserve price should be greater than 0");
    });

    it("Should fail with zero blocks duration", async function() {
      await expect(
        ERC721Auction.connect(owner).deploy(
          erc721Token.address,
          1,
          ethers.utils.parseEther("1"),
          0,
          ethers.utils.parseEther("0.1")
        )
      ).to.be.revertedWith("Auction must be open for at least one block");
    });

    it("Should fail with zero offer price decrement", async function() {
      await expect(
        ERC721Auction.connect(owner).deploy(
          erc721Token.address,
          1,
          ethers.utils.parseEther("1"),
          10,
          ethers.utils.parseEther("0")
        )
      ).to.be.revertedWith("Offer price decrement should be greater than 0");
    });
    it("Should emit the correct event on creation", async function() {
      const auction = await ERC721Auction.deploy(
          erc721Token.address,
          1,
          ethers.utils.parseEther("1"),
          10,
          ethers.utils.parseEther("0.1")
      );
      await expect(auction.deployTransaction)
          .to.emit(auction, 'AuctionStarted')
          .withArgs(ethers.utils.parseEther("2"));
  });
  
  });

  
  describe("Bid", function() {
    it("Should refund the previous highest bidder when a higher bid is placed", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });
      await expect(erc721Auction.connect(bidder2).bid({ value: ethers.utils.parseEther("3") }))
          .to.emit(erc721Auction, 'BidRefunded')
          .withArgs(await bidder1.getAddress(), ethers.utils.parseEther("2"));
  });
  
  it("Should not refund the highest bidder when a lower bid is placed", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });
      await expect(erc721Auction.connect(bidder2).bid({ value: ethers.utils.parseEther("1.5") }))
          .to.be.revertedWith('Bid is lower than the reserve price');
  });
  
    
    it('Should fail to transfer funds when owner places a bid', async () => {
      const initialBalanceOwner = await owner.getBalance();
      const bidAmount = ethers.utils.parseEther('2.0');
    
      // Place a bid from the owner's address
      await expect(erc721Auction.connect(owner).bid({ value: bidAmount }))
        .to.be.revertedWith('Owner cannot place a bid');
    
      // Get the final balance of the owner
      const finalBalanceOwner = await owner.getBalance();
    
      // Compare balances within a tolerance of 0.01 ETH
      expect(finalBalanceOwner).to.be.approximately(initialBalanceOwner, ethers.utils.parseEther('0.01'));
    });


    it("Should revert for bids from the contract owner", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);

      await expect(
        erc721Auction.connect(owner).bid({ value: ethers.utils.parseEther("2") })
      ).to.be.revertedWith("Owner cannot place a bid");
    });

    it("Should revert for bids lower than the reserve price", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);

      await expect(
        erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("0.5") })
      ).to.be.revertedWith("Bid is lower than the reserve price");
    });


  it("Should not allow bids when the auction is closed", async function() {
  const currentBlockNumber = await ethers.provider.getBlockNumber();
  const currentBlock = await ethers.provider.getBlock(currentBlockNumber);
  const auctionEndBlockNumber = currentBlockNumber + 10;

  // Mine blocks until the auction is closed
  while (await ethers.provider.getBlockNumber() < auctionEndBlockNumber) {
    await ethers.provider.send("evm_mine", []);
  }

  await expect(
    erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("1") })
  ).to.be.revertedWith("Auction is closed");
  });

    it("Should not allow bids less than the current price", async function() {
      await expect(
        erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("1.5") })
      ).to.be.revertedWith("Bid is lower than the reserve price");
    });

    it("Should not end the auction if the bid is not enough", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("3") });
      const auctionEnded = await erc721Auction.auctionEnded();
      expect(auctionEnded).to.be.false;
  });

    it("Should correctly calculate the current price based on block number", async function() {
      expect(await erc721Auction.getCurrentPrice()).to.equal(ethers.utils.parseEther("2"));
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine", []);
      expect(await erc721Auction.getCurrentPrice()).to.equal(ethers.utils.parseEther("1.9"));
  });
  
  });

  describe("endAuction", function() {

    it("Should end auction if called by the owner", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("3") });
      expect(await erc721Auction.auctionEnded()).to.be.false;
      await erc721Auction.connect(owner).endAuction();
      expect(await erc721Auction.auctionEnded()).to.be.true;
  });

  it("Should fail if non-owner tries to end the auction after a bid", async function() {
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("3") });
      await expect(erc721Auction.connect(bidder1).endAuction()).to.be.revertedWith("ERC721: caller is not token owner or approved");
      expect(await erc721Auction.auctionEnded()).to.be.false;
  });
  it("Should fail if no bids have been placed", async function() {
      await expect(erc721Auction.connect(owner).endAuction()).to.be.revertedWith("No bids received");
      expect(await erc721Auction.auctionEnded()).to.be.false;
  });

    it("Should emit the correct event when the auction ends", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });
  
      await expect(erc721Auction.connect(owner).endAuction())
          .to.emit(erc721Auction, 'AuctionEnded')
          .withArgs(await bidder1.getAddress(), ethers.utils.parseEther("2"));
  });

  it("Should revert if the auction has not received any bids", async function() {
    await erc721Token.connect(owner).approve(erc721Auction.address, 1);

    await expect(
      erc721Auction.connect(owner).endAuction()
    ).to.be.revertedWith("No bids received");
  });
  
});

  
});

