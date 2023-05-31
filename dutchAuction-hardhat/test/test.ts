import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

describe('BasicDutchAuction', function () {
  let auction: any;
  let owner: any;
  let bidder: any;
  let other: any;

  beforeEach(async function () {
    [owner, bidder, other] = await ethers.getSigners();
    const BasicDutchAuctionFactory = await ethers.getContractFactory('BasicDutchAuction');
    auction = await BasicDutchAuctionFactory.deploy(1, 2, 1);
    await auction.deployed();
  });

  it('Should initialize with correct values', async function () {
    expect(await auction.reservePrice()).to.equal(1);
    expect(await auction.owner()).to.equal(owner.address);
    expect(await auction.getCurrentPrice()).to.equal(3);
  });

  it('Should decrement the price on each block', async function () {
    expect(await auction.getCurrentPrice()).to.equal(3);
    await ethers.provider.send('evm_mine', []);
    expect(await auction.getCurrentPrice()).to.equal(2);
  });

  it('Should reject a bid below the current price', async function () {
    // Get the current price
    const currentPrice = await auction.getCurrentPrice();
    // Try to bid below the current price
    await expect(auction.connect(bidder).bid({ value: currentPrice - 1 }))
      .to.be.revertedWith('Bid is below the current price');
  });  
  

  it('Should accept a bid at or above the current price', async function () {
    await ethers.provider.send('evm_mine', []);
    await expect(auction.connect(bidder).bid({ value: 2 })).to.emit(auction, 'AuctionEnded').withArgs(bidder.address, 1);
  });


  it('Should allow the owner to end the auction', async function () {
    await ethers.provider.send('evm_mine', []);
    await auction.connect(bidder).bid({ value: 2 });
    expect(await auction.owner()).to.equal(await owner.getAddress());
    await expect(auction.connect(owner).endAuction()).to.emit(auction, 'AuctionEnded').withArgs(owner.address, 0);
  });

  it('Should not allow non-owner to end the auction', async function () {
    await ethers.provider.send('evm_mine', []);
    await auction.connect(bidder).bid({ value: 2 });
    await expect(auction.connect(other).endAuction()).to.be.revertedWith('Only owner can call this function.');
  });

  it('Should not allow bidding if auction has ended', async function () {
    await ethers.provider.send('evm_mine', []);
    await auction.connect(bidder).bid({ value: 2 });
    await ethers.provider.send('evm_mine', []);
    await expect(auction.connect(other).bid({ value: 2 })).to.be.revertedWith('Auction has ended.');
  });

  it('Should transfer funds to the seller immediately after a successful bid', async function () {
    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    await ethers.provider.send('evm_mine', []);
    await auction.connect(bidder).bid({ value: 2 });
    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
    expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(1);
  });

  it('Should not allow a bid from the owner', async function () {
    await ethers.provider.send('evm_mine', []);
    await expect(auction.connect(owner).bid({ value: 2 })).to.be.revertedWith('Owner cannot bid');
  });

  it('Should not allow bids less than reserve price', async function () {
    // wait for auction price to be less than reserve price
    await ethers.provider.send('evm_increaseTime', [300]);
    await ethers.provider.send('evm_mine', []);
    // bid at the current price which is below reserve price
    await expect(auction.connect(bidder).bid({ value: 0 })).to.be.revertedWith('Bid is below the reserve price');
  });

  it('Should reset the auction when ended', async function () {
    await ethers.provider.send('evm_mine', []);
    await auction.connect(bidder).bid({ value: 2 });
    await auction.connect(owner).endAuction();
    expect(await auction.reservePrice()).to.equal(0);
    expect(await auction.getCurrentPrice()).to.equal(0);
  });

  it('Should not accept a bid if auction is not open', async function () {
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);
    await ethers.provider.send('evm_mine', []);
    await expect(auction.connect(bidder).bid({ value: 2 })).to.be.revertedWith('Auction is not open');
  });

  it('Should allow a bid if auction is open', async function () {
    await ethers.provider.send('evm_mine', []);
    await expect(auction.connect(bidder).bid({ value: 2 })).to.emit(auction, 'AuctionEnded');
  });

  it('Should refund any excess amount sent with the bid', async function () {
    const bidderBalanceBefore = await ethers.provider.getBalance(bidder.address);
    await ethers.provider.send('evm_mine', []);
    await auction.connect(bidder).bid({ value: 3 });
    const bidderBalanceAfter = await ethers.provider.getBalance(bidder.address);
    expect(bidderBalanceBefore.sub(bidderBalanceAfter)).to.be.closeTo(BigNumber.from(1), BigNumber.from(10 ** 15));
  });

//   it('Should reject bids if the sender has insufficient balance', async function () {
//     await ethers.provider.send('evm_mine', []);
//     await expect(auction.connect(bidder).bid({ value: BigNumber.from(2).pow(256).sub(1) })).to.be.revertedWith('Bid is below the current price');
//   });
});
