import { ERC20Token } from "types/supported-erc20-token";
import { TokenInfo } from "types/token-info";

export const supportedTokens: Record<ERC20Token, TokenInfo> = {
  PSYS: {
    symbol: "PSYS",
    address: "0x81821498cD456c9f9239010f3A9F755F3A38A778",
  },
  ETK: {
    symbol: "ETK",
    address: "0xe2318b19B93f920838ec5fa2B4FD51bEe92B3e77",
  },
};
