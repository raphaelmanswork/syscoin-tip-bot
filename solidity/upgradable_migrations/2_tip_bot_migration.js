const { deployProxy } = require("@openzeppelin/truffle-upgrades");

var TipBot = artifacts.require("TipBot");

module.exports = async function (deployer) {
  await deployProxy(TipBot, [
    web3.utils.toWei('0.1','ether'),
    web3.utils.toWei('0.2','ether'),
  ], {
    deployer,
    initializer: "init",
  });
};
