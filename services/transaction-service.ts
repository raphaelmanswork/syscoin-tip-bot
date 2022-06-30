import web3 from "services/web3";
import { TransactionConfig } from "web3-core";
import { GasEstimatorService } from "./gas-estimator-service";
import ContractJSON from "../solidity/build/contracts/TipBot.json";
import { AbiItem } from "web3-utils";
import { ERC20Contract, TipBotContract } from "./interfaces";
import { ERC20Token } from "types/supported-erc20-token";
import { Contract } from "web3-eth-contract/types";
import { SupportedTokenService } from "../services/supported-token-service";

export class TransactionService {
  private contractAddress = process.env.CONTRACT_ADDRESS;
  constructor(private gasEstimatorService: GasEstimatorService) {}

  getContract() {
    const contractAddress = this.contractAddress;
    if (!contractAddress) {
      throw new Error("SMART CONTRACT ADDRESS is undefined");
    }
    let contract;
    if (web3.utils.isAddress(contractAddress)) {
      contract = new web3.eth.Contract(
        ContractJSON.abi as AbiItem[],
        contractAddress
      );
    }
    return contract;
  }

  async getContractByToken(token: ERC20Token): Promise<Contract | null> {
    let contract: Contract | null = null;
    const abi = SupportedTokenService.getERC20ABI();
    const address = SupportedTokenService.getContractAddress(token);
    if (abi && address) {
      contract = new web3.eth.Contract(abi, address);
    }
    return contract;
  }

  approve(contract: ERC20Contract, spenderAddress: string, amount: number) {
    const amountToWei = web3.utils.toWei(String(amount), "ether");
    return contract.methods.approve(spenderAddress, amountToWei).encodeABI();
  }

  getAllowance(
    contract: ERC20Contract,
    ownerAddress: string,
    spenderAddress: string
  ) {
    return contract.methods.allowance(ownerAddress, spenderAddress).call();
  }

  async validateAllowance(
    amount: number,
    contract: ERC20Contract,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<boolean> {
    const allowance = await this.getAllowance(
      contract,
      ownerAddress,
      spenderAddress
    );
    const isValid = Number(web3.utils.fromWei(allowance, "ether")) >= amount;
    return isValid;
  }

  airDrop(addresses: string[]) {
    const contract: TipBotContract = this.getContract()!;
    return contract.methods.airDrop(addresses).encodeABI();
  }

  airDropByToken(addresses: string[], tokenAddress: string, amount: number) {
    const contract: TipBotContract = this.getContract()!;
    return contract.methods
      .airDropToken(
        addresses,
        tokenAddress,
        web3.utils.toWei(String(amount), "ether")
      )
      .encodeABI();
  }

  tipByContract(recipientAddress: string) {
    const contract: TipBotContract = this.getContract()!;
    return contract.methods.tip(recipientAddress).encodeABI();
  }

  tipByToken(recipientAddress: string, tokenAddress: string, amount: number) {
    const contract: TipBotContract = this.getContract()!;
    return contract.methods
      .tipByToken(
        recipientAddress,
        tokenAddress,
        web3.utils.toWei(String(amount), "ether")
      )
      .encodeABI();
  }

  async validateSufficientBalance(address: string, amount: number) {
    const balance = await web3.eth.getBalance(address);
    return Number(web3.utils.fromWei(balance, "ether")) > amount;
  }

  async validateSufficientBalanceByContract(
    contract: ERC20Contract,
    address: string,
    amount: number
  ) {
    const balance = await contract.methods
      .balanceOf(address)
      .call({ from: address });
    return Number(web3.utils.fromWei(balance, "ether")) > amount;
  }

  async getTransactionConfigForContract(
    amount: number,
    data?: any,
    from?: string,
    contract?: Contract
  ): Promise<TransactionConfig> {
    let contractAddress = this.getContract()!.options.address;
    if (contract) {
      contractAddress = contract.options.address;
    }

    const { maxFeePerGas, maxPriorityFeePerGas } =
      await this.gasEstimatorService.getMaxAndPriorityFeeEstimate();

    if (!maxFeePerGas || !maxPriorityFeePerGas) {
      throw new Error("Unable to estimate gas fees.");
    }
    let transactionConfig: TransactionConfig = {
      from,
      to: contractAddress,
      value: web3.utils.toWei(amount.toString(), "ether"),
      maxFeePerGas: Number(maxFeePerGas),
      maxPriorityFeePerGas: Number(maxPriorityFeePerGas),
      data,
    };

    const gas = web3.utils
      .toBN(await web3.eth.estimateGas(transactionConfig))
      .add(web3.utils.toBN(1000_000));

    return {
      ...transactionConfig,
      gas: `0x${gas.toString("hex")}`,
    };
  }

  async getTransactionConfig(toAddress: string, amount: number) {
    const { maxFeePerGas, maxPriorityFeePerGas } =
      await this.gasEstimatorService.getMaxAndPriorityFeeEstimate();

    if (!maxFeePerGas || !maxPriorityFeePerGas) {
      throw new Error("Unable to estimate gas fees.");
    }

    const transactionConfig: TransactionConfig = {
      to: toAddress,
      value: web3.utils.toWei(amount.toString(), "ether"),
      maxFeePerGas: Number(maxFeePerGas),
      maxPriorityFeePerGas: Number(maxPriorityFeePerGas),
      gas: 21000,
    };

    return transactionConfig;
  }

  async signTransaction(
    privateKey: string,
    transactionConfig: TransactionConfig
  ) {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const signedTransaction = await account.signTransaction(transactionConfig);
    return signedTransaction;
  }

  sendTransaction(rawTransaction: string) {
    return web3.eth.sendSignedTransaction(rawTransaction);
  }
}
