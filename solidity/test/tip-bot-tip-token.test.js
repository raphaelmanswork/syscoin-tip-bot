const { expect, use } = require("chai");
const {
  deployContract,
  MockProvider,
  solidity,
} = require("ethereum-waffle");

const ERC20Token = require("../build/contracts/EToken.json"); //TODO: Mock ERC20 contract
const TipBot = require("../build/contracts/TipBot.json");

use(solidity);

describe("TipBot tip token", () => {
  const [wallet, walletTo] = new MockProvider().getWallets();
  let erc20Token, tipbot;

  beforeEach(async () => {
    tipbot = await deployContract(wallet, TipBot);
    erc20Token = await deployContract(wallet, ERC20Token);
  });

  it("should tip by token", async () => {
    const amountEth = 100;
    const amountWei = web3.utils.toWei(amountEth.toString(), "ether");
    const senderAddress = wallet.address;
    const recieverAddress = walletTo.address;
    const approve = await erc20Token.approve(tipbot.address, amountWei, {
      from: senderAddress,
    });

    const tip = await tipbot.tipByToken(
      recieverAddress,
      erc20Token.address,
      amountWei,
      {
        from: senderAddress,
      }
    );

    const feeRate = await tipbot.feeRate();
    const feeRateEth = await web3.utils.fromWei(String(feeRate));

    const actualAmountReceived = amountEth * (1 - feeRateEth);
    const tipbotFeeAmount = amountEth * feeRateEth;

    const receieverBalance = await erc20Token.balanceOf(recieverAddress);
    const tipbotTokenBalance = await erc20Token.balanceOf(tipbot.address);

    expect(tip)
      .to.emit(tipbot, "TipToken")
      .withArgs(
        senderAddress,
        recieverAddress,
        web3.utils.toWei(String(actualAmountReceived), "ether")
      );

    expect(web3.utils.fromWei(String(receieverBalance))).to.be.equal(
      actualAmountReceived.toString()
    );
    expect(web3.utils.fromWei(String(tipbotTokenBalance))).to.be.equal(
      tipbotFeeAmount.toString()
    );
  });

  it("should not be able to tip amount not greater than 0", async () => {
    const amountEth = 0;
    const amountWei = web3.utils.toWei(amountEth.toString(), "ether");
    const senderAddress = wallet.address;
    const recieverAddress = walletTo.address;
    await erc20Token.approve(tipbot.address, amountWei, {
      from: senderAddress,
    });

    await expect(
      tipbot.tipByToken(recieverAddress, erc20Token.address, amountWei, {
        from: senderAddress,
      })
    ).to.be.revertedWith("Amount must be greater than 0");
  });
});
