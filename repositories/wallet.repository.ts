import db, { Wallet } from "@db";

const walletRepository = {
  deleteWalletByUserId: async (userId: bigint) =>
    await db.wallet.delete({
      where: {
        userId: userId,
      },
    }),
  getWalletByUserId: async (userId: bigint) =>
    db.wallet.findUnique({ where: { userId } }),
  saveWallet: async (wallet: Wallet) => {
    const { userId, address, privateKey, username } = wallet;
    return await db.wallet.create({
      data: {
        address,
        privateKey,
        username,
        userId,
      },
    });
  },
  updateWallet: async (userId: number, { firstname, username }: Wallet) =>
    db.wallet.update({
      data: {
        username,
        firstname,
      },
      where: {
        userId,
      },
    }),
  getWalletByAddress: async (address: string) =>
    db.wallet.findFirst({
      where: {
        address,
      },
    }),
};

export default walletRepository;
