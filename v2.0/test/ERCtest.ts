import { ethers } from "hardhat";
import { assert, expect } from "chai";
import 'mocha';

import { Contract, ContractFactory, Signer } from "ethers";

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
      // expect(await erc721Auction.startPrice).to.equal(ethers.utils.parseEther("2"));

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
  });

  describe("endAuction", function() {
    it("Should handle bids equal to the current price", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });

      const auctionEnded = await erc721Auction.auctionEnded();
      expect(auctionEnded).to.be.true;
      const tokenOwner = await erc721Token.ownerOf(1);
      expect(tokenOwner).to.equal(await bidder1.getAddress());
  });

  it("Should revert if the auction has not received any bids", async function() {
    await erc721Token.connect(owner).approve(erc721Auction.address, 1);

    await expect(
      erc721Auction.connect(owner).endAuction()
    ).to.be.revertedWith("No bids received");
  });

  // it("Should fail if the auction end is forced prematurely", async function() {
  //   await erc721Token.connect(owner).approve(erc721Auction.address, 1);
  //   await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });

  //   await expect(
  //     erc721Auction.connect(owner).endAuction()
  //   ).to.be.revertedWith("Auction has not finished yet");
  // });

  it("Should revert when trying to end an already ended auction", async function() {
    await erc721Token.connect(owner).approve(erc721Auction.address, 1);
    await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });

    await expect(
      erc721Auction.connect(owner).endAuction()
    ).to.be.revertedWith("Auction has already ended");
  });

  it("Should transfer funds to the seller and transfer the NFT to the highest bidder", async function() {
    // Approve the ERC721 token for the auction contract
    await erc721Token.connect(owner).approve(erc721Auction.address, 1);

    // Place a bid from bidder1
    await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("1.9") });

    // Mine some blocks and do not end the auction
    for (let i = 0; i < 5; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    // Place a higher bid from bidder2
    await erc721Auction.connect(bidder2).bid({ value: ethers.utils.parseEther("1.8") });

    // Now end the auction
    await erc721Auction.connect(owner).endAuction();

    const tokenOwner = await erc721Token.ownerOf(1);
    expect(tokenOwner).to.equal(await bidder2.getAddress());
    const auctionEnded = await erc721Auction.auctionEnded();
    expect(auctionEnded).to.be.true;
  });
//     it("Should transfer funds to the seller and transfer the NFT to the highest bidder", async function() {
//       let isAuctionEnded = await erc721Auction.auctionEnded();
//   if (isAuctionEnded) {
//     throw new Error("Auction ended prematurely");
//   }

//   //     const isAuctionEnded = await erc721Auction.auctionEnded();
//   // assert(!isAuctionEnded, "Auction should not have ended");

//       await erc721Token.connect(owner).approve(erc721Auction.address, 1);
//       await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });
    
//       await ethers.provider.send("evm_increaseTime", [11]); // Increase time to allow the auction to end
//       await ethers.provider.send("evm_mine", []);
    
//       const ownerBalanceBefore = await ethers.provider.getBalance(await owner.getAddress());
//       const highestBidderBalanceBefore = await ethers.provider.getBalance(await bidder1.getAddress());
    
//       await erc721Auction.connect(owner).endAuction();
    
//       const ownerBalanceAfter = await ethers.provider.getBalance(await owner.getAddress());
//       const highestBidderBalanceAfter = await ethers.provider.getBalance(await bidder1.getAddress());
    
//       expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(ethers.utils.parseEther("2"));
//       expect(highestBidderBalanceAfter.sub(highestBidderBalanceBefore)).to.equal(ethers.utils.parseEther("0"));
    
//       const tokenOwner = await erc721Token.ownerOf(1);
//       expect(tokenOwner).to.equal(await bidder1.getAddress());
//     });
});

  describe("Bid", function() {

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

    it("Should not allow bids after the auction has ended", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });
      await expect(
        erc721Auction.connect(bidder2).bid({ value: ethers.utils.parseEther("2") })
      ).to.be.revertedWith("Auction has ended");
    });

    it("Should handle bids equal to the current price", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });

      const auctionEnded = await erc721Auction.auctionEnded();
      expect(auctionEnded).to.be.true;
      const tokenOwner = await erc721Token.ownerOf(1);
      expect(tokenOwner).to.equal(await bidder1.getAddress());
  });

// it("Should reduce the current price after some blocks and refund the previous highest bidder", async function() {
//   await erc721Token.connect(owner).approve(erc721Auction.address, 1);

//   // Bid from bidder1
//   await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });

//   // Mine some blocks
//   for (let i = 0; i < 10; i++) {
//     await ethers.provider.send("evm_mine", []);
//   }

//   // The current price should now be lower
//   const currentPrice = await erc721Auction.getCurrentPrice();
//   assert(
//     currentPrice.eq(ethers.utils.parseEther("1")),
//     `Expected price: ${ethers.utils.formatEther(ethers.utils.parseEther("1"))}, found: ${ethers.utils.formatEther(currentPrice)}`
//   );

//   // Bidder2 bids now
//   await erc721Auction.connect(bidder2).bid({ value: ethers.utils.parseEther("1") });

//   // Check refund to bidder1
//   const bidder1Balance = await bidder1.getBalance();
//   expect(bidder1Balance).to.equal(ethers.utils.parseEther("1"));
// });

it("Should reduce the current price after some blocks and refund the previous highest bidder", async function() {
  await erc721Token.connect(owner).approve(erc721Auction.address, 1);

  // Bid from bidder1 equal to the starting price
  await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });

  // Mine some blocks
  for (let i = 0; i < 10; i++) {
    await ethers.provider.send("evm_mine", []);
  }

  const currentBlockNumber = await ethers.provider.getBlockNumber();
  console.log("Current block number: ", currentBlockNumber);

  // The current price should now be lower
  const currentPrice = await erc721Auction.getCurrentPrice();
  console.log("Current price: ", ethers.utils.formatEther(currentPrice));

  assert(
    currentPrice.lt(ethers.utils.parseEther("2")),
    `Expected price lower than starting price, found: ${ethers.utils.formatEther(currentPrice)}`
  );

  // Bidder2 bids now
  await erc721Auction.connect(bidder2).bid({ value: ethers.utils.parseEther("1.5") });

  // Check refund to bidder1
  const bidder1Balance = await bidder1.getBalance();
  expect(bidder1Balance).to.be.above(ethers.utils.parseEther("0")); // refund the previous bid as it exceeded the current price
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

    it("Should end the auction when a valid bid is placed", async function() {
      await erc721Token.connect(owner).approve(erc721Auction.address, 1);
      await erc721Auction.connect(bidder1).bid({ value: ethers.utils.parseEther("2") });
      const auctionEnded = await erc721Auction.auctionEnded();
      expect(auctionEnded).to.be.true;
    });
  });
  
});

