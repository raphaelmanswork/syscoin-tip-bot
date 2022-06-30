import TelegramBot, { SendMessageOptions, Update } from "node-telegram-bot-api";
import { CallbackData } from "./enums";
import { CallbackHandler } from "./types";
import web3 from "services/web3";
import { callbackUtils } from "callback_handlers";
import { WalletService } from "services/wallet-service";
import { getAirdropWinners, getContractAddressLink } from "shared/utils";
import { getUserTag } from "shared/utils/telegram-user";

type AdditionalMessage = {
  messageId: number;
  chatId: number;
  message: string;
};

export class ConfirmTransactionCallbackHandler implements CallbackHandler {
  constructor(private walletService: WalletService) {}
  callbackData = CallbackData.ConfirmTransaction;
  explorerLink = process.env.EXPLORER_LINK ?? "https://explorer.syscoin.org";

  async handleCallback(bot: TelegramBot, update: Update): Promise<void> {
    await callbackUtils.removeInlineKeyboardOptions(bot, update);
    const { message, id, from, data } = update.callback_query!;
    let sendMessageConfig: SendMessageOptions = {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    };

    const chatId = message!.chat!.id;

    const tokens = (message!.text ?? "").split("\n");
    const rawTransaction = tokens.pop()?.split(":").pop()?.trim();
    if (!rawTransaction) {
      bot.sendMessage(id, "Something went wrong.", sendMessageConfig);
      return;
    }

    let additionalMessage!: AdditionalMessage;

    const parsedData = data?.split(":");
    if (parsedData && parsedData?.length > 2) {
      additionalMessage = await this.getAdditionalMessage(
        parsedData,
        tokens,
        bot
      );
    }

    const sendEvent = web3.eth.sendSignedTransaction(rawTransaction);

    const addressLink = `${this.explorerLink}/address`;

    await new Promise((resolve, reject) => {
      const txLink = `${this.explorerLink}/tx`;
      sendEvent
        .once("sent", async (_) => {
          const userId = from.id!;
          const walletAddress = (await this.walletService.getWallet(userId))
            ?.address;
          await bot.sendMessage(
            chatId,
            `The transaction has been sent to the network.\n[Check pending transactions](${addressLink}/${walletAddress})`,
            {
              parse_mode: "Markdown",
              disable_web_page_preview: true,
            }
          );
          if (additionalMessage) {
            await bot.sendMessage(
              additionalMessage.chatId,
              `${additionalMessage.message}`,
              {
                ...sendMessageConfig,
                reply_to_message_id: additionalMessage.messageId,
              }
            );
          }
        })
        .once("receipt", async (receipt) => {
          const txHash = receipt.transactionHash;
          await bot.sendMessage(
            chatId,
            `Transaction was successful\n\nTxHash: ${txHash}\n\nOpen in [explorer](${txLink}/${txHash})`,
            sendMessageConfig
          );
          resolve(receipt);
        })
        .once("error", async (err) => {
          console.log(err.message);
          await bot.sendMessage(chatId, `${err.message}`);
          reject(err);
        });
    });
  }

  async getAdditionalMessage(
    parsedData: string[],
    tokens: string[],
    bot: TelegramBot
  ) {
    let additionalMessage!: AdditionalMessage;

    try {
      const [_, type, ...propsString] = parsedData;
      const props = propsString.join(",").split(",");
      if (type === "tip") {
        const [chatId, userId, messageId] = props;
        const recipientUser = await bot.getChatMember(chatId, userId);
        const userTag = getUserTag(recipientUser.user);
        additionalMessage = {
          message: `${userTag}'s tip is sent to the network.`,
          chatId: Number(chatId),
          messageId: Number(messageId),
        };
      } else if (parsedData!.includes("airdrop")) {
        const [chatId, messageId] = props;
        const winnerAddresses = await getAirdropWinners(tokens);
        const link = getContractAddressLink();
        additionalMessage = {
          message: `Winners:\n${winnerAddresses}\n\n${link}`,
          chatId: Number(chatId),
          messageId: Number(messageId),
        };
      }
    } catch (e) {
      console.error(e);
    }

    return additionalMessage;
  }
}
