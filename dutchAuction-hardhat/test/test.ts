import { ethers } from 'hardhat';
import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { BasicDutchAuction } from '../typechain/BasicDutchAuction';

chai.use(solidity);
const { expect } = chai;

describe("BasicDutchAuction", function() {
  it("Should initialize contract with the right values", async function() {
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    expect(await auction.reservePrice()).to.eq(1);
    expect(await auction.numBlocksAuctionOpen()).to.eq(2);
    expect(await auction.offerPriceDecrement()).to.eq(1);
    expect(await auction.initialPrice()).to.eq(3);
  });

  it("Should be able to submit a valid bid", async function() {
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    await auction.bid({ value: 3 });
    expect(await auction.winningBid()).to.eq(3);
  });

  it("Should reject a bid below the current price", async function() {
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    await expect(auction.bid({ value: 2 })).to.be.revertedWith("Bid is not high enough");
  });

  it("Should reject a bid after auction end", async function() {
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    await auction.bid({ value: 3 });
    await expect(auction.bid({ value: 3 })).to.be.revertedWith("Auction has ended.");
  });

  it("Should not be able to bid with a value of 0", async function() {
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    await expect(auction.bid({ value: 0 })).to.be.revertedWith("Bid is not high enough");
  });

  it("Should not be able to bid with a value below reserve price", async function() {
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    await expect(auction.bid({ value: 1 })).to.be.revertedWith("Bid is not high enough");
  });

  it("Should allow the owner to end the auction", async function() {
    const [_, other] = await ethers.getSigners();
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    expect(await auction.owner()).to.equal(await other.getAddress());
    await expect(auction.connect(other).endAuction()).to.not.be.reverted;
  });

  it("Should not allow a non-owner to end the auction", async function() {
    const [owner, other] = await ethers.getSigners();
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    expect(await auction.owner()).to.equal(await owner.getAddress());
    await expect(auction.connect(other).endAuction()).to.be.revertedWith("Only owner can call this function.");
  });

  it("Should end the auction after the specified number of blocks", async function() {
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    for(let i=0; i<5; i++) {
      await ethers.provider.send("evm_mine", []);
    }

    expect(await auction.getCurrentPrice()).to.eq(0);
  });

  it("Should decrease the price after each block", async function() {
    const BasicDutchAuctionFactory = await ethers.getContractFactory("BasicDutchAuction");
    const auction = await BasicDutchAuctionFactory.deploy(1, 2, 1) as BasicDutchAuction;

    expect(await auction.getCurrentPrice()).to.eq(3);
    await ethers.provider.send("evm_mine", []);
    expect(await auction.getCurrentPrice()).to.eq(2);
  });
});
