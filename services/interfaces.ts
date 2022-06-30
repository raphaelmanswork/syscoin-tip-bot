import { Contract, ContractSendMethod } from "web3-eth-contract";
import BN from "bn.js";

export interface TipBotContract extends Contract {
  methods: {
    tip: (address: string) => ContractSendMethod;
    airDrop: (address: string[]) => ContractSendMethod;
    tipByToken: (
      recipientAddress: string,
      tokenAddress: string,
      amount: BN | string
    ) => ContractSendMethod;
    airDropToken: (
      addresses: string[],
      tokenAddress: string,
      amount: BN | string
    ) => ContractSendMethod;
  };
}

export interface ERC20Contract extends Contract {
  methods: {
    approve: (
      spenderAddress: string,
      amount: BN | string
    ) => ContractSendMethod;
    balanceOf: (address: string) => ContractSendMethod;
    allowance: (
      ownerAddress: string,
      spenderAddress: string
    ) => ContractSendMethod;
  };
}

type encodeABI = () => string;
