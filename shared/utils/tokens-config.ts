import { ERC20Token } from "types/supported-erc20-token";
import { TokenInfo } from "types/token-info";

export const supportedTokens: Record<ERC20Token, TokenInfo> = {
  PSYS: {
    symbol: "PSYS",
    address: "0xE90D470a0f763dF0a917828fDe152753DcA99aA2",
  },
  ETK: {
    symbol: "ETK",
    address: "0xe2318b19B93f920838ec5fa2B4FD51bEe92B3e77",
  },
};
