import TelegramBot, { Update } from "node-telegram-bot-api";
import { groupMemberService, walletService } from "services";
import groupHandlerUtils from "./group-handler-utils";
import { Wallet } from "@db";
export const register = async (bot: TelegramBot, update: Update) => {
  const {
    chat: { id, title },
    from,
  } = update.message!;

  const userId = from?.id;

  if (!userId) {
    console.error("No User Id!", update);
    throw new Error("No User Id found");
  }

  const isAdmin = await groupHandlerUtils.isAdmin(userId, id, bot);

  if (isAdmin) {
    console.error("Is an admin", update);
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

  const isRegistered = await groupMemberService.checkMemberRegistered(update);

  if (isRegistered) {
    await bot.sendMessage(userId, `Already registered to ${title}'s airdrop`);
    return;
  }
  const registerUser = await groupMemberService.registerMember(update);

  if (!registerUser) {
    await bot.sendMessage(userId, `Failed to register to ${title}'s airdrop`);
    return;
  }

  await bot.sendMessage(
    userId,
    `You have participated to ${title}'s future airdrops!`
  );
};
