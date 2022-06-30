import groupHandlerUtils from "message_handlers/group/group-handler-utils";
import TelegramBot, { SendMessageOptions, Update } from "node-telegram-bot-api";
import {
  activeAirdropService,
  botMessageService,
  transactionService,
  walletService,
} from "services";
import { MessageConfigI } from "services/bot-message-service";
import {
  generateAirdropMessage,
  validateAllowance,
  validateBalance,
} from "shared/utils";
import { CallbackData } from "./enums";
import { CallbackHandler } from "./types";
import { TransactionConfig } from "web3-core";
import { Wallet } from "@db";
import { Contract } from "web3-eth-contract/types";
import { ERC20Token } from "types/supported-erc20-token";
import { AllowanceError } from "shared/utils/AllowanceError";

export class CloseAirdropCallbackHandler implements CallbackHandler {
  callbackData = CallbackData.CloseAirdrop;
  async handleCallback(bot: TelegramBot, update: Update): Promise<void> {
    const callbackQuery = update.callback_query!;

    if (!callbackQuery) {
      throw new Error("Callback Query not found");
    }
    const { message, from } = callbackQuery;

    const userId = from?.id;
    const chatId = message!.chat.id;
    const sendMessageConfig: SendMessageOptions = {
      parse_mode: "Markdown",
    };

    const botMessageConfig: MessageConfigI = {
      bot,
      chatId,
      sendMessageConfig,
    };

    if (!userId) {
      console.error("No User Id!", update);
      throw new Error("No User Id found");
    }
    const isAdmin = await groupHandlerUtils.isAdmin(userId, chatId, bot);

    if (!isAdmin) {
      await botMessageService.actionNotAllowed(
        "Only admins can close active-airdops",
        {
          bot,
          sendMessageConfig,
          chatId: userId,
        }
      );
      console.error("User is not an admin");
      return;
    }

    const parsedData = callbackQuery.data?.split(":");

    if (parsedData?.length !== 2) {
      console.error("Token symbol not found");
      return;
    }

    const tokenSymbol = parsedData[parsedData.length - 1];

    const messageId = message!.message_id;
    const activeAirdrop = await activeAirdropService.getActiveAirdrop(
      messageId
    );

    if (!activeAirdrop) {
      console.error(`No active airdrop with message_id: ${messageId}`);
      return;
    }

    const airdropMembers = activeAirdrop.ActiveAirdropMember;

    if (!airdropMembers || airdropMembers.length === 0) {
      await bot.editMessageText(
        "*Active Airdroped Canceled* ❌\nNo participants joined",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
        }
      );
      await activeAirdropService.removeActiveAirdrop(messageId);
      return;
    }

    const addresses = await groupHandlerUtils.selectWinners(
      activeAirdrop.count,
      airdropMembers
    );

    const wallet = await walletService.getWallet(userId);

    if (!wallet) {
      await botMessageService.noWalletMsg(botMessageConfig);
      return;
    }

    const amount = Number(activeAirdrop.amount);
    if (isNaN(amount) || amount <= 0) {
      console.error(`Invalid amount: ${amount}`);
      return;
    }

    let tokenContract: Contract | null = null;

    if (Object.values(ERC20Token).includes(tokenSymbol as ERC20Token)) {
      tokenContract = await transactionService.getContractByToken(
        tokenSymbol as ERC20Token
      );
      if (!tokenContract) {
        console.error(`Failed to get ${tokenSymbol} contract`);
        return;
      }
    }

    const isBalanceSufficient = await validateBalance(
      wallet.address,
      amount,
      tokenContract
    );

    if (!isBalanceSufficient) {
      await botMessageService.insufficientBalance(botMessageConfig);
      return;
    }

    let data = transactionService.airDrop(addresses);

    let transactionConfig;

    try {
      transactionConfig = await buildTransactionConfig(
        wallet,
        addresses,
        amount,
        tokenContract
      );
    } catch (error) {
      if (error instanceof AllowanceError) {
        await botMessageService.invalidAllowance(amount, {
          ...botMessageConfig,
          chatId: from.id,
        });
      }
      throw error;
    }

    const signedTransaction = await transactionService.signTransaction(
      wallet.privateKey,
      transactionConfig
    );

    let botMessage = generateAirdropMessage(
      addresses,
      transactionConfig,
      signedTransaction.rawTransaction!,
      amount,
      tokenSymbol
    );

    await bot.sendMessage(from!.id, botMessage, {
      parse_mode: "Markdown",
      reply_markup: botMessageService.confirmAirdropReplyMarkup(messageId),
    });
  }
}

async function buildTransactionConfig(
  wallet: Wallet,
  winnerAddresses: string[],
  amount: number,
  tokenContract?: Contract | null
): Promise<TransactionConfig> {
  let data = transactionService.airDrop(winnerAddresses);

  if (tokenContract) {
    await validateAllowance(amount, tokenContract, wallet);
    data = transactionService.airDropByToken(
      winnerAddresses,
      tokenContract.options.address,
      amount
    );
  }

  let transactionConfig =
    await transactionService.getTransactionConfigForContract(
      tokenContract ? 0 : amount,
      data,
      wallet.address
    );

  return transactionConfig;
}
