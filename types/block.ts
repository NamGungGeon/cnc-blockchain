import { SHA256 } from "crypto-js";
import Transaction from "./transaction";

//Block
export default class Block {
  timestamp: number;
  transactions: Array<Transaction> | string;
  prevHash: string = "";
  nonce: number = 0;
  hash: string = "";

  constructor(
    timestamp: number,
    transactions: Array<Transaction> | string,
    prevHash: string = ""
  ) {
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.prevHash = prevHash;
    this.nonce = 0;
    this.hash = this.calcHash();
  }

  static restore(json: Block) {
    const block = new Block(
      json.timestamp,
      Array.isArray(json.transactions)
        ? json.transactions.map((tx) => Transaction.restore(tx))
        : "genesisBlock",
      json.prevHash
    );

    block.timestamp = json.timestamp;
    block.prevHash = json.prevHash;
    block.hash = json.hash;
    block.nonce = json.nonce;

    return block;
  }

  calcHash(): string {
    const txString = JSON.stringify(this.transactions);
    return SHA256(
      this.prevHash + this.timestamp + txString + this.nonce
    ).toString();
  }

  mining(difficulty: number): Block {
    const start = new Date();
    //difficulty개의 0으로 시작하는 hash가 발생될 때 까지 해시를 반복한다
    while (!this.isValidNonce(difficulty)) {
      this.nonce++;
      this.hash = this.calcHash();
    }
    const end = new Date();

    //조건을 만족했을 때 nonce 값 출력
    //이 때 nonce는 해시를 한 횟수와 동일하다
    console.log("block is mined", this.nonce);
    //걸린 시간 출력
    console.log("ellipsed time is ", end.getTime() - start.getTime(), "ms");

    return this;
  }
  miningAsync(difficulty: number, onMined: (block: Block) => void): void {
    const lazyExec = (callback: Function): void => {
      // console.log("lazyExec", this);
      setTimeout(callback.bind(this));
    };

    const stepping = (): void => {
      // console.log("stepping", this);
      if (!this.isValidNonce(difficulty)) {
        this.nonce++;
        this.hash = this.calcHash();

        lazyExec(stepping);
      } else {
        //mined!!
        console.log("block is mined", this.nonce);
        onMined(this);
      }
    };

    lazyExec(stepping);
  }
  isValid(prevBlock: Block, difficulty: number): boolean {
    if (this.hash !== this.calcHash()) {
      console.log("hash 불일치");
      return false;
    }
    if (this.prevHash !== prevBlock.hash) {
      console.log("prevHash 불일치");
      return false;
    }
    if (!this.isValidNonce(difficulty)) {
      console.log("nonce 불일치");
      return false;
    }
    if (!this.hasValidTransactions()) {
      return false;
    }
    return true;
  }
  isValidNonce(difficulty: number): boolean {
    //difficulty개의 0으로 시작하는 hash가 발생될 때 까지 해시를 반복한다
    return (
      this.hash.substring(0, difficulty) ===
      Array(difficulty).fill("0").join("")
    );
  }
  hasValidTransactions(): boolean {
    if (typeof this.transactions === "string") return true;

    if (this.transactions.length === 0) return true;

    return this.transactions.every((tx, idx) => {
      if (idx === 0 && !tx.fromAddr && tx.toAddr) {
        //채굴 보상은 반드시 0번에 위치한다
        return true;
      }
      return tx.isValid();
    });
  }
}

module.exports = Block;
