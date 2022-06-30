import { User } from "node-telegram-bot-api";

export const getUserTag = (user: User): string => {
  return user?.username ? `@${user.username}` : user.first_name;
};
