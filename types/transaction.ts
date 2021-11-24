import { SHA256 } from "crypto-js";
import { ec as EC } from "elliptic";
import * as crypto from "crypto";

const ec = new EC("secp256k1");

interface Payload {
  op: string;
  data: any;
}
export default class Transaction {
  timestamp: number = new Date().getTime();
  fromAddr: string | null;
  toAddr: string;
  amount: number = 0;
  nft: string | null = null;
  signiture: string | null = null;
  payload: Payload | null = null;

  constructor(
    fromAddr: string | null,
    toAddr: string,
    amount: number,
    nft: string | null = null
  ) {
    this.fromAddr = fromAddr;
    this.toAddr = toAddr;
    this.amount = amount;
    this.nft = nft;
  }

  setPayload(op: string, data: any): Payload {
    this.payload = {
      op,
      data,
    };
    return this.payload;
  }

  static restore(json: Transaction): Transaction {
    const tx: Transaction = new Transaction(
      json.fromAddr,
      json.toAddr,
      json.amount,
      json.nft
    );
    tx.signiture = json.signiture;
    tx.timestamp = json.timestamp;
    if (json.payload) tx.payload = json.payload;
    return tx;
  }
  static async createTxWithNFT(fromAddr: string, toAddr: string, data: any) {
    const nft = crypto.createHash("sha256").update(data).digest("hex");
    return new Transaction(fromAddr, toAddr, 0, nft);
  }

  calcFee(): number {
    return 0;
  }

  calcHash(): string {
    return SHA256(
      this.timestamp +
        (this.fromAddr ?? "") +
        this.toAddr +
        this.amount +
        this.nft +
        JSON.stringify(this.payload)
    ).toString();
  }

  signTransaction(signKey: EC.KeyPair): void {
    if (signKey.getPublic("hex") !== this.fromAddr) {
      throw "다른 사람의 지갑 정보를 사용하여 트랜잭션에 사인할 수 없습니다";
    }

    const hashTranscation: string = this.calcHash();
    this.signiture = signKey.sign(hashTranscation, "base64").toDER("hex");
  }

  isValid(): Boolean {
    //채굴 보상을 수여받는 경우, fromAddr은 null이다
    // if (!this.fromAddr) return true;

    if (!this.fromAddr) {
      throw "송신자 정보가 없습니다";
    }
    if (!this.toAddr) {
      throw "수신자 정보가 없습니다";
    }
    if (this.amount < 0) {
      throw "음수 금액은 지정할 수 없습니다";
    }
    if (!this.signiture) {
      throw "서명되지 않은 트랜잭션입니다";
    }

    const publicKey = ec.keyFromPublic(this.fromAddr, "hex");
    return publicKey.verify(this.calcHash(), this.signiture);
  }
}

module.exports = Transaction;
