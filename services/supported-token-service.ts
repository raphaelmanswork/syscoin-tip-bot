import { ERC20Token } from "types/supported-erc20-token";
import { default as ERC20Json } from "../solidity/build/contracts/IERC20.json";
import { AbiItem } from "web3-utils";
import { supportedTokens } from "shared/utils/tokens-config";

export namespace SupportedTokenService {
  export function getERC20ABI(): AbiItem[] | null {
    return ERC20Json.abi as AbiItem[];
  }

  export function getContractAddress(token: ERC20Token): string {
    return supportedTokens[token]?.address ?? "";
  }
}
