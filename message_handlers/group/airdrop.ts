import TelegramBot, { SendMessageOptions, Update } from "node-telegram-bot-api";
import {
  botMessageService,
  groupMemberService,
  transactionService,
  walletService,
} from "services";
import { MessageConfigI } from "services/bot-message-service";
import { ERC20Contract } from "services/interfaces";
import { generateAirdropMessage, validateAllowance } from "shared/utils";
import { Contract } from "web3-eth-contract/types";
import { TransactionConfig } from "web3-core";
import { Wallet } from "@db";

import groupHandlerUtils from "./group-handler-utils";
import { ERC20Token } from "types/supported-erc20-token";
import { AllowanceError } from "shared/utils/AllowanceError";

export const airdrop = async (bot: TelegramBot, update: Update) => {
  const {
    chat: { id, title },
    from,
    text,
    message_id,
  } = update.message!;

  const userId = from?.id;

  if (!userId) {
    console.error("No User Id!", update);
    throw new Error("No User Id found");
  }

  const isAdmin = true; // await groupHandlerUtils.isAdmin(userId, id, bot);

  if (!isAdmin) {
    console.error("Not an admin.", update);
    return;
  }

  const sendMessageConfig: SendMessageOptions = {
    parse_mode: "Markdown",
  };

  const botMessageConfig: MessageConfigI = {
    bot,
    chatId: id,
    sendMessageConfig,
  };

  const tokens = (text ?? "").split(" ");

  const properSyntax =
    "Must be: `/airdrop <amount> <count>` or `/airdrop <token> <amount> <count>`";

  if (tokens.length !== 3 && tokens.length !== 4) {
    await bot.sendMessage(
      id,
      `*Invalid Syntax*:\n${properSyntax}`,
      sendMessageConfig
    );
    return;
  }

  const { amountInText, numberWinnersInText, tokenSymbol } =
    parseTokens(tokens);

  if (tokenSymbol) {
    if (!Object.values(ERC20Token).includes(tokenSymbol as ERC20Token)) {
      const message = "Invalid token.";
      await bot.sendMessage(id, message, sendMessageConfig);
      return;
    }
  }

  const amount = Number(amountInText);
  const numberOfWinners = Number(numberWinnersInText);
  if (isNaN(amount) || amount <= 0) {
    await botMessageService.invalidAmountTextMsg(
      amountInText,
      botMessageConfig
    );
    return;
  }

  if (isNaN(numberOfWinners) || numberOfWinners <= 0) {
    await botMessageService.invalidAmountTextMsg(
      numberWinnersInText,
      botMessageConfig
    );
    return;
  }

  let tokenContract: Contract | null = null;

  if (tokenSymbol) {
    tokenContract = await transactionService.getContractByToken(
      tokenSymbol as ERC20Token
    );
    if (!tokenContract) {
      console.error(`Failed to get ${tokenSymbol} contract`);
      return;
    }
  }

  const members = await groupMemberService.getGroupChatMembers(id);

  if (!members) {
    await bot.sendMessage(
      userId,
      `There are no users registered in the group chat: ${title}`
    );
    throw new Error("No members found");
  }

  if (members?.length < numberOfWinners) {
    await bot.sendMessage(
      id,
      "Number of currently registered members is lower than specified number of winners"
    );
    return;
  }

  const wallet = await walletService.getWallet(userId);

  if (!wallet) {
    await botMessageService.noWalletMsg(botMessageConfig);
    return;
  }

  const isBalanceSufficient = await validateBalance(
    tokens,
    wallet.address,
    amount,
    tokenContract
  );

  if (!isBalanceSufficient) {
    await botMessageService.insufficientBalance(botMessageConfig);
    return;
  }

  const addresses = await groupHandlerUtils.selectWinners(
    numberOfWinners,
    members
  );

  let transactionConfig: TransactionConfig | null;

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

  let message = generateAirdropMessage(
    addresses,
    transactionConfig,
    signedTransaction.rawTransaction!,
    amount,
    tokenSymbol
  );

  await bot.sendMessage(from!.id, message, {
    parse_mode: "Markdown",
    reply_markup: botMessageService.confirmTxReplyMarkupWithActionType(
      "airdrop",
      id,
      message_id
    ),
  });
};

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

async function validateBalance(
  tokens: string[],
  address: string,
  amount: number,
  contract?: ERC20Contract | null
): Promise<Boolean> {
  let isBalanceSufficient = false;

  if (contract) {
    isBalanceSufficient =
      await transactionService.validateSufficientBalanceByContract(
        contract,
        address,
        amount
      );
  } else {
    isBalanceSufficient = await transactionService.validateSufficientBalance(
      address,
      amount
    );
  }

  return isBalanceSufficient;
}

function parseTokens(tokens: string[]): {
  amountInText: string;
  numberWinnersInText: string;
  tokenSymbol?: string;
} {
  if (tokens.length === 4) {
    const [_, tokenSymbol, amountInText, numberWinnersInText] = tokens;
    return {
      tokenSymbol,
      amountInText,
      numberWinnersInText,
    };
  }
  const [_, amountInText, numberWinnersInText] = tokens;
  return {
    amountInText,
    numberWinnersInText,
  };
}
