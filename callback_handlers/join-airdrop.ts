import { Wallet } from "@db";
import groupHandlerUtils from "message_handlers/group/group-handler-utils";
import TelegramBot, { Update } from "node-telegram-bot-api";
import { walletService } from "services";
import { ActiveAirdropService } from "services/active-airdrop-service";
import { AirdropMemberService } from "services/airdrop-member-service";
import { BotMessageService } from "services/bot-message-service";
import { CallbackData } from "./enums";
import { CallbackHandler } from "./types";

export class JoinAirdropCallbackHandler implements CallbackHandler {
  constructor(
    private botMessageService: BotMessageService,
    private activeAirdropService: ActiveAirdropService,
    private airdropMemberService: AirdropMemberService
  ) {}
  callbackData = CallbackData.JoinAirdrop;
  async handleCallback(bot: TelegramBot, update: Update): Promise<void> {
    const callbackQuery = update.callback_query!;

    if (!callbackQuery) {
      throw new Error("Callback Query not found");
    }
    const { message, from } = callbackQuery;
    const chatId = message!.chat.id;
    const chatTitle = message!.chat.title;
    const userId = from!.id;

    const isAdmin = await groupHandlerUtils.isAdmin(userId, chatId, bot);

    if (isAdmin) {
      console.error("Is an admin.", update);
      return;
    }

    const isRegistered = await this.airdropMemberService.isRegisteredToAirdrop(
      callbackQuery
    );

    if (isRegistered) {
      await bot.sendMessage(
        userId,
        `Already registered to ${chatTitle}'s airdrop`
      );
      return;
    }

    const wallet = await walletService.getWallet(userId);

    if (
      wallet &&
      (!wallet.firstname ||
        !wallet.username ||
        from.username !== wallet.username ||
        from.first_name !== wallet.firstname)
    ) {
      let updateWallet: Wallet = {
        ...wallet,
        firstname: from.first_name,
        username: from.username ?? "",
      };
      await walletService.updateWallet(userId, updateWallet);
    }

    const joined = await this.activeAirdropService.registerToActiveAirdrop(
      callbackQuery
    );

    if (!joined) {
      bot.sendMessage(userId, `Failed to register to ${chatTitle}'s airdrop`);
      return;
    }

    bot.sendMessage(userId, `You have participated to ${chatTitle}'s airdrop!`);
  }
}
