/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * trufflesuite.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require("@truffle/hdwallet-provider");
const fs = require("fs");
const mnemonic = fs.readFileSync(".secret").toString().trim();
const privateKey = fs.readFileSync(".privatekey").toString().trim();

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
    },
    mainnet: {
      provider: function () {
        return new HDWalletProvider([privateKey], "https://rpc.syscoin.org");
      },
      websocket: true, // Enable EventEmitter interface for web3 (default: false)
      network_id: 57,
      gas: 8000000, // gas should be no higher than 8m
    },
    tanenbaum: {
      provider: function () {
        return new HDWalletProvider(mnemonic, "https://rpc.tanenbaum.io/");
      },
      websocket: true, // Enable EventEmitter interface for web3 (default: false)
      network_id: 5700,
      gas: 8000000, // gas should be no higher than 8m
      maxFeePerGas: 1500010000,
      maxPriorityFeePerGas: 15000000000,
    },
    maticTestnet: {
      provider: function () {
        return new HDWalletProvider(
          mnemonic,
          `https://matic-mumbai.chainstacklabs.com/`
        );
      },
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },
  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.10", // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      // settings: {          // See the solidity docs for advice about optimization and evmVersion
      //  optimizer: {
      //    enabled: false,
      //    runs: 200
      //  },
      //  evmVersion: "byzantium"
      // }
    },
  },
  plugins: ["truffle-flatten", "truffle-plugin-verify"],
};
