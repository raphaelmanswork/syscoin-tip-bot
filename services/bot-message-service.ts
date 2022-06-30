import { CallbackData } from "callback_handlers/enums";
import TelegramBot, {
  InlineKeyboardMarkup,
  SendMessageOptions,
} from "node-telegram-bot-api";

export interface MessageConfigI {
  bot: TelegramBot;
  chatId: number;
  sendMessageConfig: SendMessageOptions;
}

export class BotMessageService {
  async noWalletMsg(config: MessageConfigI): Promise<void> {
    const message = "No wallet created yet.";

    await config.bot.sendMessage(
      config.chatId,
      message,
      config.sendMessageConfig
    );
    return;
  }

  async insufficientBalance(config: MessageConfigI): Promise<void> {
    const message = "Insufficient balance.";

    await config.bot.sendMessage(
      config.chatId,
      message,
      config.sendMessageConfig
    );
    return;
  }

  async invalidAddressMsg(
    address: string,
    config: MessageConfigI
  ): Promise<void> {
    const message = `Invalid address found: *\"${address}\"*`;

    await config.bot.sendMessage(
      config.chatId,
      message,
      config.sendMessageConfig
    );
    return;
  }

  async invalidArgumentLengthMsg(
    text: string,
    config: MessageConfigI
  ): Promise<void> {
    const message = `Invalid # of arguments found on: *\"${text}\"*`;
    await config.bot.sendMessage(
      config.chatId,
      message,
      config.sendMessageConfig
    );
  }

  async invalidAmountTextMsg(
    amountInText: string,
    config: MessageConfigI
  ): Promise<void> {
    const message = `Invalid amount found: *\"${amountInText}\"*`;
    await config.bot.sendMessage(
      config.chatId,
      message,
      config.sendMessageConfig
    );
  }

  async invalidAllowance(
    amount: number,
    config: MessageConfigI
  ): Promise<void> {
    await config.bot.sendMessage(
      config.chatId,
      `Allowance that has been set is less than the specified amount: ${amount}.\nPlease type command \`/allowance <token> <amount>\` to set new allowance.`,
      {
        parse_mode: "Markdown",
      }
    );
  }

  get confirmTxReplyMarkup(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: "yes",
            callback_data: CallbackData.ConfirmTransaction,
          },
          {
            text: "cancel",
            callback_data: CallbackData.None,
          },
        ],
      ],
    };
  }

  confirmTxReplyMarkupWithActionType(
    actionType: string,
    ...data: any
  ): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: "yes",
            callback_data: `${CallbackData.ConfirmTransaction}:${actionType}:${data}`,
          },
          {
            text: "cancel",
            callback_data: CallbackData.None,
          },
        ],
      ],
    };
  }

  confirmAirdropReplyMarkup(messageId: number): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: "yes",
            callback_data: `${CallbackData.ConfirmAirdropTransaction}:${messageId} `,
          },
          {
            text: "cancel",
            callback_data: CallbackData.None,
          },
        ],
      ],
    };
  }

  async actionNotAllowed(msg: string, config: MessageConfigI) {
    return await config.bot.sendMessage(
      config.chatId,
      `*Action not allowed*\n${msg}.`,
      config.sendMessageConfig
    );
  }
}
