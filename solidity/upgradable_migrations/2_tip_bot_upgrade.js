const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

var TipBotV2 = artifacts.require("TipBotV2");

module.exports = async function (deployer) {
  const previousDeployedAddress = '0xcf4399168f4526F7a6cf6111ECE4bE0A66ffc51E';
  await upgradeProxy(previousDeployedAddress, TipBotV2, { deployer });
};