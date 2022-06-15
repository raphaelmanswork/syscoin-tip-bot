import TelegramBot, {
  SendMessageOptions,
  Update,
  User,
} from "node-telegram-bot-api";
import { botMessageService, transactionService, walletService } from "services";
import { MessageConfigI } from "services/bot-message-service";
import web3 from "services/web3";
import { getUserTag } from "shared/utils/telegram-user";
import { TransactionConfig } from "web3-core";
import { ERC20Token } from "types/supported-erc20-token";
import { ERC20Contract } from "services/interfaces";
import { Wallet } from "@db";

export const tip = async (bot: TelegramBot, update: Update) => {
  const {
    chat: { id },
    message_id,
    reply_to_message,
    from,
    text,
  } = update.message!;

  if (!from) {
    console.error("from User not found", update);
    throw new Error("from User not found");
  }

  const fromUserTag = getUserTag(from);

  if (!reply_to_message) {
    await bot.sendMessage(
      id,
      `${fromUserTag} reply to a message and use \`\/tip <amount>\`\\.`,
      {
        reply_to_message_id: message_id,
        parse_mode: "MarkdownV2",
      }
    );
    return;
  }

  if (reply_to_message.from?.is_bot) {
    await bot.sendMessage(id, "You are trying to tip a bot.");
    return;
  }

  const tipperUser = from!;

  if (!tipperUser.id) {
    console.error("No User Id!", update);
    throw new Error("No User Id found");
  }

  const sendMessageConfig: SendMessageOptions = {
    parse_mode: "Markdown",
    reply_to_message_id: message_id,
  };

  const botMessageConfig: MessageConfigI = {
    bot,
    chatId: id,
    sendMessageConfig,
  };

  const tipperWallet = await walletService.getWallet(tipperUser.id);

  if (!tipperWallet) {
    await botMessageService.noWalletMsg(botMessageConfig);
    return;
  }

  if (!web3.utils.isAddress(tipperWallet.address)) {
    await botMessageService.invalidAddressMsg(
      tipperWallet.address,
      botMessageConfig
    );
    return;
  }

  const tokens = (text ?? "").split(" ");
  const properSyntax = "Must be: `/tip <amount>` or `/tip <token> <amount>`";
  if (tokens.length !== 2 && tokens.length !== 3) {
    await bot.sendMessage(
      id,
      `*Invalid Syntax*:\n${properSyntax}`,
      sendMessageConfig
    );
    return;
  }

  const { amountInText, tokenSymbol } = parseTokens(tokens);

  if (tokenSymbol) {
    if (!Object.values(ERC20Token).includes(tokenSymbol as ERC20Token)) {
      const message = "Invalid token.";
      await bot.sendMessage(id, message, sendMessageConfig);
      return;
    }
  }

  const { from: replyFrom } = reply_to_message;

  const amount = Number(amountInText);
  if (isNaN(amount) || amount <= 0) {
    await botMessageService.invalidAmountTextMsg(
      amountInText,
      botMessageConfig
    );
    return;
  }

  const isBalanceSufficient = await validateBalance(
    tokens,
    tipperWallet.address,
    amount
  );

  if (!isBalanceSufficient) {
    await botMessageService.insufficientBalance(botMessageConfig);
    return;
  }

  const recipientUser = replyFrom!;

  if (!recipientUser.id) {
    console.error("No User Id!", update);
    throw new Error("No User Id found");
  }
  let recipientWallet = await walletService.getOrCreateWallet(
    recipientUser.id,
    recipientUser.username
  );
  if (!recipientWallet) {
    const message = "Failed to get recipient wallet.";
    await bot.sendMessage(id, message, sendMessageConfig);
    return;
  }
  if (!web3.utils.isAddress(recipientWallet.address)) {
    await botMessageService.invalidAddressMsg(
      recipientWallet.address,
      botMessageConfig
    );
    return;
  }

  const transactionConfig = await buildTransactionConfig(
    tipperWallet,
    recipientWallet,
    amount,
    tokenSymbol as ERC20Token
  );
  if (!transactionConfig) {
    console.error("Failed to create transaction config.");
    return;
  }

  const signedTransaction = await transactionService.signTransaction(
    tipperWallet.privateKey,
    transactionConfig
  );
  let message = "";

  if (tokenSymbol) {
    message = generateMessageForTipToken(
      tipperUser!,
      recipientUser!,
      signedTransaction.rawTransaction!,
      tokenSymbol,
      amount
    );
  } else {
    message = generateBotMessage(
      tipperUser!,
      recipientUser!,
      transactionConfig,
      signedTransaction.rawTransaction!
    );
  }

  await bot.sendMessage(from!.id, message, {
    parse_mode: "Markdown",
    reply_markup: botMessageService.confirmTxReplyMarkupWithActionType(
      "tip",
      id,
      recipientUser.id,
      message_id
    ),
  });
};

async function buildTransactionConfig(
  tipperWallet: Wallet,
  recipientWallet: Wallet,
  amount: number,
  tokenSymbol?: ERC20Token
) {
  let data = null;
  let transactionConfig = null;
  if (tokenSymbol) {
    const tokenContract = await transactionService.getContractByToken(
      tokenSymbol
    );
    if (!tokenContract) {
      console.error(`Failed to get ${tokenSymbol} contract`);
      return;
    }
    await transactionService.approve(
      tokenContract,
      tipperWallet.address,
      process.env.CONTRACT_ADDRESS!,
      amount
    );

    data = transactionService.tipByToken(
      recipientWallet.address,
      tokenContract.options.address,
      amount
    );
  } else {
    data = transactionService.tipByContract(recipientWallet.address);
  }
  transactionConfig = await transactionService.getTransactionConfigForContract(
    tokenSymbol ? 0 : amount,
    data,
    tipperWallet.address
  );
  return transactionConfig;
}

async function validateBalance(
  tokens: string[],
  address: string,
  amount: number,
  contract?: ERC20Contract
) {
  let isBalanceSufficient = false;
  if (tokens.length !== 2) {
    isBalanceSufficient = await transactionService.validateSufficientBalance(
      address,
      amount
    );
  } else if (contract) {
    isBalanceSufficient =
      await transactionService.validateSufficientBalanceByContract(
        contract,
        address,
        amount
      );
  }
  return isBalanceSufficient;
}

function parseTokens(tokens: string[]): {
  amountInText: string;
  tokenSymbol?: string;
} {
  if (tokens.length === 3) {
    const [_, tokenSymbol, amountInText] = tokens;
    return {
      tokenSymbol,
      amountInText,
    };
  }
  const [_, amountInText] = tokens;
  return {
    amountInText,
  };
}

function generateBotMessage(
  tipperUser: User,
  recipientUser: User,
  transactionConfig: TransactionConfig,
  rawTransaction: string
) {
  const defaultToken = "SYS";
  const amountFromWei = web3.utils.fromWei(
    transactionConfig.value!.toString(),
    "ether"
  );

  const fromUsername = tipperUser?.username ? `(@${tipperUser.username})` : "";
  const from = `${tipperUser.first_name} ${tipperUser.last_name} ${fromUsername}`;

  const toUsername = recipientUser?.username
    ? `(@${recipientUser.username})`
    : "";
  const to = `${recipientUser.first_name} ${recipientUser.last_name} ${toUsername}`;

  return `Confirming your transaction:\n\nFrom: ${from}\nTo Username: ${to}\n\nAmount: ${amountFromWei} ${defaultToken}\n\nPlease reply "yes" to this message to confirm.\n\n\nRAW Transaction: ${rawTransaction}`;
}

function generateMessageForTipToken(
  tipperUser: User,
  recipientUser: User,
  rawTransaction: string,
  tokenSymbol: string,
  amount: number
) {
  const fromUsername = tipperUser?.username ? `(@${tipperUser.username})` : "";
  const from = `${tipperUser.first_name} ${tipperUser.last_name} ${fromUsername}`;

  const toUsername = recipientUser?.username
    ? `(@${recipientUser.username})`
    : "";
  const to = `${recipientUser.first_name} ${recipientUser.last_name} ${toUsername}`;

  return `Confirming your transaction:\n\nFrom: ${from}\nTo Username: ${to}\n\nAmount: ${amount} ${tokenSymbol}\n\nPlease reply "yes" to this message to confirm.\n\n\nRAW Transaction: ${rawTransaction}`;
}
