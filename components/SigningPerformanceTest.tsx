import React from "react";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { useSigningPerformance } from "../hooks/useSigningPerformance";
import SigningPerformanceChart from "./SigningPerformanceChart";
import { useEffect, useMemo, useState } from "react";
import { SigningUtils } from "../lib/signing-utils";

interface SigningPerformanceTestProps {
  localWallet: Keypair;
  privyWalletAddress?: string;
  webCryptoKeyPair: CryptoKeyPair;
  connection: Connection;
  recentBlockhash: string;
}

export default function SigningPerformanceTest({
  localWallet,
  privyWalletAddress,
  webCryptoKeyPair,
  connection,
  recentBlockhash,
}: SigningPerformanceTestProps) {
  const testConfig = {
    numTests: 15,
  };

  const [sampleTxs, setSampleTxs] = useState<
    {
      method: "local" | "privy-client" | "web-crypto";
      label: string;
      preview: { feePayer: string; recentBlockhash: string; memo: string };
    }[]
  >([]);

  const {
    results,
    isRunning,
    progress,
    stats,
    runPerformanceTest,
    clearResults,
  } = useSigningPerformance({
    localWallet,
    privyWalletAddress,
    webCryptoKeyPair,
    connection,
    recentBlockhash,
  });

  const sampleMemo = useMemo(() => "Example memo transaction", []);

  useEffect(() => {
    async function buildSamples() {
      if (!recentBlockhash) return;

      const localTx = SigningUtils.buildMemoTransaction(
        localWallet.publicKey,
        recentBlockhash,
        sampleMemo
      );

      const previews: {
        method: "local" | "privy-client" | "web-crypto";
        label: string;
        preview: { feePayer: string; recentBlockhash: string; memo: string };
      }[] = [
        {
          method: "local",
          label: "Local Wallet Memo TX",
          preview: {
            feePayer: localTx.feePayer!.toBase58(),
            recentBlockhash: localTx.recentBlockhash!,
            memo: sampleMemo,
          },
        },
      ];

      if (privyWalletAddress) {
        const privyTx = SigningUtils.buildMemoTransaction(
          new PublicKey(privyWalletAddress),
          recentBlockhash,
          sampleMemo
        );
        previews.push({
          method: "privy-client",
          label: "Privy Wallet Memo TX",
          preview: {
            feePayer: privyTx.feePayer!.toBase58(),
            recentBlockhash: privyTx.recentBlockhash!,
            memo: sampleMemo,
          },
        });
      }

      // Web Crypto fee payer derived from Ed25519 public key
      const publicKeyRaw = (await crypto.subtle.exportKey(
        "raw",
        webCryptoKeyPair.publicKey
      )) as ArrayBuffer;
      const webCryptoFeePayer = new PublicKey(new Uint8Array(publicKeyRaw));
      const webTx = SigningUtils.buildMemoTransaction(
        webCryptoFeePayer,
        recentBlockhash,
        sampleMemo
      );
      previews.push({
        method: "web-crypto",
        label: "Web Crypto (Ed25519) Memo TX",
        preview: {
          feePayer: webTx.feePayer!.toBase58(),
          recentBlockhash: webTx.recentBlockhash!,
          memo: sampleMemo,
        },
      });

      setSampleTxs(previews);
    }
    buildSamples();
  }, [
    localWallet.publicKey,
    privyWalletAddress,
    webCryptoKeyPair,
    recentBlockhash,
    sampleMemo,
  ]);

  const handleRunTest = (): void => {
    runPerformanceTest(testConfig);
  };

  const progressPercentage =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Test Configuration */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        {/* Control Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRunTest}
            disabled={isRunning}
            className={`px-6 py-3 rounded-md font-medium text-lg ${
              isRunning
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-700 text-white shadow-lg"
            }`}
          >
            {isRunning
              ? "Running Performance Test..."
              : "🚀 Start Performance Test"}
          </button>

          <button
            onClick={clearResults}
            disabled={isRunning || results.length === 0}
            className={`px-4 py-2 rounded-md font-medium ${
              isRunning || results.length === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gray-600 hover:bg-gray-700 text-white"
            }`}
          >
            Clear Results
          </button>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Testing {progress.currentMethod} wallet...</span>
              <span>
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {stats.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Quick Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {stats.map((stat) => (
              <div key={stat.method} className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  {stat.method === "local"
                    ? "Local Wallet"
                    : stat.method === "privy-client"
                    ? "Privy Wallet"
                    : "Web Crypto API"}
                </h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Average Time:</span>
                    <span className="font-mono">
                      {stat.avgTime.toFixed(2)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Time:</span>
                    <span className="font-mono">
                      {stat.minTime.toFixed(2)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tests:</span>
                    <span>{stat.totalTests}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Example Transaction Preview */}
      {sampleTxs.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">
            Example Memo Transaction (per method)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleTxs.map((t) => (
              <div key={t.method} className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-900 mb-2">
                  {t.label}
                </div>
                <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-auto">
                  {JSON.stringify(t.preview, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts and Detailed Results */}
      <SigningPerformanceChart data={results} stats={stats} />
    </div>
  );
}
