import TelegramBot, { Update, SendMessageOptions } from "node-telegram-bot-api";
import { MessageHandler } from "./types";
import { ERC20Token } from "types/supported-erc20-token";

import { MessageConfigI } from "services/bot-message-service";
import { botMessageService, transactionService, walletService } from "services";
import web3 from "services/web3";
import { ERC20Contract } from "services/interfaces";

export class AllowanceMessageHandler implements MessageHandler {
  identifier = /\/allowance/g;

  explorerLink = process.env.EXPLORER_LINK ?? "https://explorer.syscoin.org";

  async handleMessage(bot: TelegramBot, update: Update): Promise<void> {
    const {
      chat: { id },
      text,
      message_id,
      from,
    } = update.message!;

    const sendMessageConfig: SendMessageOptions = {
      parse_mode: "Markdown",
      reply_to_message_id: message_id,
      disable_web_page_preview: true,
    };

    const botMessageConfig: MessageConfigI = {
      bot,
      chatId: id,
      sendMessageConfig,
    };

    const tokens = (text ?? "").split(" ");

    const properSyntax = "Must be: `/allowance <token> <amount>`";

    const [_, tokenSymbol, amountInText] = tokens;

    if (tokens.length !== 3) {
      await bot.sendMessage(
        id,
        `*Invalid Syntax*:\n${properSyntax}`,
        sendMessageConfig
      );
      return;
    }

    const amount = Number(amountInText);
    if (isNaN(amount) || amount <= 0) {
      await botMessageService.invalidAmountTextMsg(
        amountInText,
        botMessageConfig
      );
      return;
    }

    let tokenContract: ERC20Contract | null = null;

    if (!Object.values(ERC20Token).includes(tokenSymbol as ERC20Token)) {
      const message = "Invalid token.";
      await bot.sendMessage(id, message, sendMessageConfig);
      return;
    }

    tokenContract = await transactionService.getContractByToken(
      tokenSymbol as ERC20Token
    );
    if (!tokenContract) {
      console.error(`Failed to get ${tokenSymbol} contract`);
      return;
    }

    const wallet = await walletService.getWallet(from!.id);

    if (!wallet) {
      await botMessageService.noWalletMsg(botMessageConfig);
      return;
    }

    const botAddress = process.env.CONTRACT_ADDRESS!;

    const data = transactionService.approve(tokenContract, botAddress, amount);

    const transactionConfig =
      await transactionService.getTransactionConfigForContract(
        0,
        data,
        wallet.address,
        tokenContract
      );

    if (!transactionConfig) {
      console.error("Failed to create transaction config.");
      return;
    }

    const signedTransaction = await transactionService.signTransaction(
      wallet.privateKey,
      transactionConfig
    );

    if (!signedTransaction.rawTransaction) {
      console.error("Raw transaction not found", signedTransaction);
      return;
    }

    const sendEvent = web3.eth.sendSignedTransaction(
      signedTransaction.rawTransaction
    );

    await new Promise((resolve, reject) => {
      const txLink = `${this.explorerLink}/tx`;
      const addressLink = `${this.explorerLink}/address`;
      sendEvent
        .once("sent", async (_) => {
          const userId = from!.id!;
          const walletAddress = (await walletService.getWallet(userId))
            ?.address;
          await bot.sendMessage(
            id,
            `The transaction has been sent to the network.\n[Check pending transactions](${addressLink}/${walletAddress})`,
            sendMessageConfig
          );
        })
        .once("receipt", async (receipt) => {
          const txHash = receipt.transactionHash;
          await bot.sendMessage(
            id,
            `Transaction was successful\n\nTxHash: ${txHash}\n\nOpen in [explorer](${txLink}/${txHash})`,
            sendMessageConfig
          );
          resolve(receipt);
        })
        .once("error", async (err) => {
          console.log(err.message);
          await bot.sendMessage(id, `${err.message}`, sendMessageConfig);
          reject(err);
        });
    });
  }
}
