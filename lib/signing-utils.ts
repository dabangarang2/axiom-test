import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Connection,
} from "@solana/web3.js";
import nacl from "tweetnacl";

/**
 * Result of a single signing operation
 */
export interface SigningResult {
  timeTaken: number; // How long the signing took in milliseconds
  signature: string; // The base64-encoded signature
  method: "local" | "privy-client" | "web-crypto";
}

/**
 * Performance data collected during testing
 */
export interface SigningPerformanceData {
  testId: string; // Unique identifier for this test run
  timestamp: number; // When this test was executed
  method: "local" | "privy-client" | "web-crypto"; // Which signing method was used
  timeTaken: number; // How long this signing operation took (ms)
}

/**
 * Utilities for testing different signing methods and measuring their performance
 */
export class SigningUtils {
  /**
   * METHOD 1: Local Solana Wallet Signing
   *
   * This is the fastest method - direct cryptographic operations using:
   * - Solana's Ed25519 keypair (@solana/web3.js)
   * - TweetNaCl for the actual signing (tweetnacl library)
   *
   * How it works:
   * 1. Convert string message to bytes
   * 2. Use Ed25519 algorithm to create a detached signature
   * 3. Return base64-encoded signature
   */
  static async signWithLocalWallet(
    keypair: Keypair,
    message: string
  ): Promise<SigningResult> {
    // Start timing the operation
    const startTime = performance.now();

    // Convert the message string to bytes that can be signed
    const messageBytes = new TextEncoder().encode(message);

    // Create an Ed25519 signature using the keypair's secret key
    // This is a "detached" signature (signature separate from message)
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    // Stop timing
    const endTime = performance.now();

    return {
      timeTaken: endTime - startTime,
      signature: Buffer.from(signature).toString("base64"),
      method: "local",
    };
  }

  /**
   * METHOD 2: Privy Embedded Wallet Signing
   *
   * This method uses Privy's embedded wallet infrastructure:
   * - Wallet keys are managed by Privy's secure infrastructure
   * - Signing happens through Privy's React hook (useSignMessage)
   * - May involve network calls and UI interactions
   * - Generally slower due to the abstraction layer
   *
   * How it works:
   * 1. Convert message to bytes
   * 2. Call Privy's signMessage function (from useSignMessage hook)
   * 3. Privy handles the cryptographic signing internally
   * 4. Return the signature as base64
   */
  static async signWithPrivyClient(
    signMessage: (params: {
      message: Uint8Array;
      options?: { address?: string };
    }) => Promise<Uint8Array>,
    message: string,
    walletAddress?: string
  ): Promise<SigningResult> {
    // Start timing the operation
    const startTime = performance.now();

    // Convert message to bytes for Privy's signing function
    const messageBytes = new TextEncoder().encode(message);

    // Call Privy's signing function with the message bytes
    // This may involve network requests to Privy's infrastructure
    const signatureUint8Array = await signMessage({
      message: messageBytes,
      options: walletAddress ? { address: walletAddress } : undefined,
    });

    // Stop timing
    const endTime = performance.now();

    return {
      timeTaken: endTime - startTime,
      signature: Buffer.from(signatureUint8Array).toString("base64"),
      method: "privy-client",
    };
  }

  /**
   * METHOD 3: Browser Web Crypto API Signing (Solana-compatible)
   *
   * This method uses the browser's built-in Web Crypto API with Ed25519:
   * - Uses Ed25519 (same curve used by Solana)
   * - All operations happen in the browser's secure crypto context
   * - Performance varies by browser implementation and support
   *
   * How it works:
   * 1. Generate keypair once (cached for consistent testing)
   * 2. Convert message to bytes
   * 3. Sign using Ed25519 algorithm
   * 4. Return signature as base64
   *
   * Note: Key generation happens once, then cached for fair comparison
   */
  /**
   * Initialize Web Crypto keypair - call this once at startup
   * This ensures the keypair is ready and timing only measures signing, not key generation
   */
  static async signWithWebCrypto(
    webCryptoKeyPair: CryptoKeyPair,
    message: string
  ): Promise<SigningResult> {
    // Start timing the signing operation (not key generation for fair comparison)
    const startTime = performance.now();

    // Convert message string to bytes
    const messageBytes = new TextEncoder().encode(message);

    // Create signature using Ed25519 (Solana-compatible)
    const signature = await crypto.subtle.sign(
      { name: "Ed25519" } as any,
      webCryptoKeyPair.privateKey,
      messageBytes
    );

    // Stop timing
    const endTime = performance.now();

    return {
      timeTaken: endTime - startTime,
      signature: Buffer.from(signature).toString("base64"),
      method: "web-crypto",
    };
  }

  // -------- Transaction (Memo) helpers --------

  static buildMemoTransaction(
    feePayer: PublicKey,
    recentBlockhash: string,
    memo: string
  ): Transaction {
    const memoProgramId = new PublicKey(
      "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
    );
    const instruction = new TransactionInstruction({
      programId: memoProgramId,
      keys: [],
      data: Buffer.from(memo, "utf8"),
    });

    const tx = new Transaction();
    tx.feePayer = feePayer;
    tx.recentBlockhash = recentBlockhash;
    tx.add(instruction);
    return tx;
  }

  static async signMemoTxWithLocalWallet(
    keypair: Keypair,
    recentBlockhash: string,
    memo: string
  ): Promise<SigningResult> {
    const tx = this.buildMemoTransaction(
      keypair.publicKey,
      recentBlockhash,
      memo
    );

    const startTime = performance.now();
    tx.sign(keypair);
    const endTime = performance.now();

    const sig = tx.signatures.find((s) =>
      s.publicKey.equals(keypair.publicKey)
    )?.signature;

    return {
      timeTaken: endTime - startTime,
      signature: sig ? Buffer.from(sig).toString("base64") : "",
      method: "local",
    };
  }

  static async signMemoTxWithPrivy(
    signTransaction: (params: {
      transaction: Transaction;
      connection: Connection;
      address?: string;
    }) => Promise<unknown>,
    connection: Connection,
    walletAddress: string,
    recentBlockhash: string,
    memo: string
  ): Promise<SigningResult> {
    const feePayer = new PublicKey(walletAddress);
    const tx = this.buildMemoTransaction(feePayer, recentBlockhash, memo);

    const startTime = performance.now();
    const signedTx = await signTransaction({
      transaction: tx,
      connection,
      address: walletAddress,
    });
    const endTime = performance.now();

    let sigBase64 = "";
    if (
      Array.isArray((signedTx as Transaction).signatures) &&
      (signedTx as any).signatures[0] &&
      typeof (signedTx as any).signatures[0] === "object" &&
      "publicKey" in (signedTx as any).signatures[0]
    ) {
      const match = (signedTx as Transaction).signatures.find((s) =>
        s.publicKey.equals(feePayer)
      )?.signature;
      sigBase64 = match ? Buffer.from(match).toString("base64") : "";
    } else if (
      Array.isArray((signedTx as any).signatures) &&
      ((signedTx as any).signatures[0] instanceof Uint8Array ||
        (signedTx as any).signatures[0] instanceof Buffer)
    ) {
      const first = (signedTx as any).signatures[0] as
        | Buffer
        | Uint8Array
        | null;
      sigBase64 = first ? Buffer.from(first).toString("base64") : "";
    }

    return {
      timeTaken: endTime - startTime,
      signature: sigBase64,
      method: "privy-client",
    };
  }

  static async signMemoTxWithWebCrypto(
    webCryptoKeyPair: CryptoKeyPair,
    recentBlockhash: string,
    memo: string
  ): Promise<SigningResult> {
    // Export raw public key bytes for fee payer
    const publicKeyRaw = (await crypto.subtle.exportKey(
      "raw",
      webCryptoKeyPair.publicKey
    )) as ArrayBuffer;
    const feePayer = new PublicKey(new Uint8Array(publicKeyRaw));
    const tx = this.buildMemoTransaction(feePayer, recentBlockhash, memo);

    // Serialize the message to sign
    const messageBytes = tx.serializeMessage();

    const startTime = performance.now();
    const signature = await crypto.subtle.sign(
      { name: "Ed25519" } as any,
      webCryptoKeyPair.privateKey,
      messageBytes
    );
    const endTime = performance.now();

    // Attach signature to the transaction (verifies internally)
    tx.addSignature(feePayer, Buffer.from(signature));

    return {
      timeTaken: endTime - startTime,
      signature: Buffer.from(signature).toString("base64"),
      method: "web-crypto",
    };
  }

  /**
   * Generate a unique test message for each signing operation
   *
   * Each message is unique to prevent any caching optimizations
   * that might skew performance results
   */
  static generateTestMessage(testId: string, iteration: number): string {
    return `Performance test ${testId} - iteration ${iteration} - timestamp ${Date.now()}`;
  }

  /**
   * Calculate performance statistics from test results
   *
   * Groups results by signing method and calculates:
   * - Average time (most important metric)
   * - Minimum time (best case performance)
   * - Maximum time (worst case performance)
   * - Median time (middle value, less affected by outliers)
   */
  static calculateStats(results: SigningPerformanceData[]) {
    // Group results by signing method (local, privy-client, web-crypto)
    const byMethod = results.reduce((acc, result) => {
      if (!acc[result.method]) {
        acc[result.method] = [];
      }
      acc[result.method]!.push(result);
      return acc;
    }, {} as Record<string, SigningPerformanceData[]>);

    // Calculate statistics for each method
    return Object.entries(byMethod).map(([method, methodResults]) => {
      const times = methodResults.map((r) => r.timeTaken);

      return {
        method,
        totalTests: methodResults.length,
        avgTime:
          times.length > 0
            ? times.reduce((a, b) => a + b, 0) / times.length
            : 0,
        minTime: times.length > 0 ? Math.min(...times) : 0,
        maxTime: times.length > 0 ? Math.max(...times) : 0,
        medianTime: times.length > 0 ? this.calculateMedian(times) : 0,
      };
    });
  }

  /**
   * Calculate the median (middle value) from a list of numbers
   *
   * Median is often more reliable than average because it's not
   * affected by extreme outliers (very slow or very fast results)
   */
  private static calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    // If even number of values, take average of two middle values
    // If odd number of values, take the exact middle value
    return sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  }
}
