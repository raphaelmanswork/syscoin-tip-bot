import { Account } from "web3-core";
import web3 from "./web3";

import db, { Wallet } from "@db";
import walletRepository from "../repositories/wallet.repository";

export class WalletService {
  constructor() {}

  public async getWallet(userId: number) {
    let wallet;
    try {
      wallet = await walletRepository.getWalletByUserId(BigInt(userId));
    } catch (e) {
      console.error(e);
    }
    return wallet;
  }

  public async getWalletByAddress(address: string) {
    let wallet;
    try {
      if (web3.utils.isAddress(address)) {
        wallet = await walletRepository.getWalletByAddress(address);
      } else {
        console.error("Invalid wallet address");
      }
    } catch (e) {
      console.error(e);
    }
    return wallet;
  }

  public async checkIfExist(userId: number) {
    const wallet = await this.getWallet(userId);
    return Boolean(wallet);
  }

  public async saveWallet(userId: number, account: Account, username?: string) {
    const { address, privateKey } = account;
    let wallet;
    try {
      wallet = await db.wallet.create({
        data: {
          address,
          privateKey,
          username,
          userId,
        },
      });
    } catch (e) {
      console.error(e);
    }

    return wallet;
  }

  public async updateWallet(userId: number, walletUpdate: Wallet) {
    let wallet;
    try {
      wallet = await walletRepository.updateWallet(userId, walletUpdate);
    } catch (e) {
      console.error(e);
    }
    return wallet;
  }

  public async deleteWallet(userId: number) {
    let isDeleted = false;
    try {
      isDeleted = Boolean(
        await walletRepository.deleteWalletByUserId(BigInt(userId))
      );
    } catch (e) {
      console.error(e);
    }
    return isDeleted;
  }

  async getOrCreateWallet(userId: number, username?: string) {
    let wallet = await this.getWallet(userId);

    if (!wallet) {
      const recipientAccount = web3.eth.accounts.create();
      wallet = await this.saveWallet(userId, recipientAccount, username);
    }

    return wallet;
  }
}
