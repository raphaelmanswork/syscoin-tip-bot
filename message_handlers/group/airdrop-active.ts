import { CallbackData } from "callback_handlers/enums";
import TelegramBot, { SendMessageOptions, Update } from "node-telegram-bot-api";
import {
  activeAirdropService,
  botMessageService,
  transactionService,
  walletService,
} from "services";
import { MessageConfigI } from "services/bot-message-service";
import groupHandlerUtils from "./group-handler-utils";
import { Contract } from "web3-eth-contract/types";
import { ERC20Token } from "types/supported-erc20-token";
import { validateBalance } from "shared/utils";

export const createActiveAirdrop = async (bot: TelegramBot, update: Update) => {
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

  const isAdmin = await groupHandlerUtils.isAdmin(userId, id, bot);

  if (!isAdmin) {
    console.error("User is not an admin");
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
    "Must be: `/active_airdrop <amount> <count>` or `/active_airdrop <token> <amount> <count>`";

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
  if (isNaN(amount) || amount <= 0) {
    await botMessageService.invalidAmountTextMsg(
      amountInText,
      botMessageConfig
    );
    return;
  }

  const numberOfWinners = Number(numberWinnersInText);
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

  const wallet = await walletService.getWallet(userId);

  if (!wallet) {
    await botMessageService.noWalletMsg(botMessageConfig);
    return;
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

  const supportedToken = tokenSymbol ?? "SYS";

  const botMessage = await bot.sendMessage(
    id,
    `*An airdrop has been created.*\n*${amount} ${supportedToken}* will be shared among maximum of *${numberOfWinners}* lucky individual/s.\n\n_Join now for a chance to win ${supportedToken}!_`,
    {
      parse_mode: "Markdown",
      reply_to_message_id: message_id,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Join",
              callback_data: CallbackData.JoinAirdrop,
            },
          ],
          [
            {
              text: "Close",
              callback_data: `${CallbackData.CloseAirdrop}:${supportedToken}`,
            },
          ],
        ],
      },
    }
  );

  const activeAirdrop = await activeAirdropService.createActiveAirdrop(
    amount,
    numberOfWinners,
    botMessage
  );

  if (!activeAirdrop) {
    await bot.deleteMessage(
      botMessage.chat.id,
      botMessage.message_id.toString()
    );
    await bot.sendMessage(from!.id, `Failed to create an airdrop for ${title}`);
  }
};

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
