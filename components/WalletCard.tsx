import { useSignMessage } from "@privy-io/react-auth/solana";
import { useEffect } from "react";

interface WalletCardProps {
  walletAddress: string;
  walletType: "privy" | "local" | "web-crypto";
}

export default function WalletCard({
  walletAddress,
  walletType,
}: WalletCardProps) {
  const { signMessage } = useSignMessage();

  useEffect(() => {
    if (walletType === "privy") {
      signMessage({
        message: new TextEncoder().encode(
          "Caching wallet data for future signatures"
        ),
      });
    }
  }, [walletType]);

  const getWalletTitle = () => {
    switch (walletType) {
      case "privy":
        return "Privy Embedded Wallet";
      case "local":
        return "Local Solana Wallet";
      case "web-crypto":
        return "Web Crypto API Wallet";
      default:
        return "Wallet";
    }
  };

  const getWalletDescription = () => {
    switch (walletType) {
      case "privy":
        return "Embedded wallet managed by Privy";
      case "local":
        return "Local keypair using @solana/web3.js";
      case "web-crypto":
        return "Browser Web Crypto API (Ed25519)";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-gray-200 rounded-lg">
      <div className="text-sm text-violet-700">{getWalletTitle()}</div>

      <div className="space-y-2">
        <div className="text-sm">
          <span className="font-medium text-gray-600">Address:</span>
          <div className="font-mono text-xs mt-1 break-all">
            {walletAddress}
          </div>
        </div>

        <div className="text-sm">
          <span className="font-medium text-gray-600">Type:</span>
          <span className="ml-2">{getWalletDescription()}</span>
        </div>

        <div className="text-sm">
          <span className="font-medium text-gray-600">Chain:</span>
          <span className="ml-2">
            {walletType === "web-crypto" ? "Solana" : "Solana"}
          </span>
        </div>
      </div>
      {walletType === "web-crypto" ? (
        <p className="text-xs text-gray-500">
          Uses Ed25519 via Web Crypto (SubtleCrypto) for Solana-compatible
          signatures.
        </p>
      ) : null}
    </div>
  );
}
