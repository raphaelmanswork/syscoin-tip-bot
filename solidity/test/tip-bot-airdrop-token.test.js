const { expect, use } = require("chai");
const { deployContract, MockProvider, solidity } = require("ethereum-waffle");
const { BigNumber } = require("ethers");

const ERC20Token = require("../build/contracts/EToken.json"); //TODO: Mock ERC20 contract
const TipBot = require("../build/contracts/TipBot.json");

use(solidity);

describe("TipBot airdrop token", () => {
  const [wallet, wallet2, wallet3, wallet4] = new MockProvider().getWallets();
  let erc20Token, tipbot;

  beforeEach(async () => {
    tipbot = await deployContract(wallet, TipBot);
    erc20Token = await deployContract(wallet, ERC20Token);
  });

  it("should airdrop by token", async function () {
    this.timeout(10000);
    const amountEth = 100;
    const amountWei = web3.utils.toWei(amountEth.toString(), "ether");
    const senderAddress = wallet.address;
    const addresses = [wallet2.address, wallet3.address, wallet4.address];
    const approve = await erc20Token.approve(tipbot.address, amountWei, {
      from: senderAddress,
    });

    const tip = await tipbot.airDropToken(
      addresses,
      erc20Token.address,
      amountWei,
      {
        from: senderAddress,
      }
    );

    const feeRate = await tipbot.airdropRate();
    const feeRateEth = await web3.utils.fromWei(String(feeRate));

    const actualAmountDistributed =
      (amountEth * (1 - feeRateEth)) / addresses.length;
    const tipbotFeeAmount = amountEth * feeRateEth;

    const tipbotTokenBalance = await erc20Token.balanceOf(tipbot.address);

    expect(tip).to.emit(tipbot, "AirDropToken");

    for (let i = 0; i < addresses.length; i++) {
      const receieverBalance = await erc20Token.balanceOf(addresses[i]);
      expect(
        Number(web3.utils.fromWei(String(receieverBalance)))
      ).to.be.closeTo(Number(actualAmountDistributed), 1);
    }

    expect(
      Number(web3.utils.fromWei(String(tipbotTokenBalance)))
    ).to.be.closeTo(Number(tipbotFeeAmount), 1);
  });

  it("should not be able to airdrop if addresses is empty", async () => {
    const amountEth = 100;
    const amountWei = web3.utils.toWei(amountEth.toString(), "ether");
    const senderAddress = wallet.address;
    await erc20Token.approve(tipbot.address, amountWei, {
      from: senderAddress,
    });

    await expect(
      tipbot.airDropToken([], erc20Token.address, amountWei, {
        from: senderAddress,
      })
    ).to.be.revertedWith("Addresses cannot be empty");
  });

  it("should not be able to airdrop amount not greater than 0", async () => {
    const amountEth = 0;
    const amountWei = web3.utils.toWei(amountEth.toString(), "ether");
    const senderAddress = wallet.address;
    const addresses = [wallet2.address, wallet3.address, wallet4.address];
    await erc20Token.approve(tipbot.address, amountWei, {
      from: senderAddress,
    });

    await expect(
      tipbot.airDropToken(addresses, erc20Token.address, amountWei, {
        from: senderAddress,
      })
    ).to.be.revertedWith("Amount must be greater than 0");
  });
});
